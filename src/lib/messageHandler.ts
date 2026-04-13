import type { ChatMessage, MessageBlock } from '../types';
import type { NanobotOutboundEvent, NanobotMediaItem } from '../lib/nanobotGateway';

export function extractToolInfo(hint: unknown): { name: string; args: Record<string, unknown> } | null {
  if (typeof hint !== 'string') return null;
  const match = hint.match(/^(\w+)\("(.*)"\)$/);
  if (match) {
    return { name: match[1], args: { input: match[2] } };
  }
  return { name: 'tool', args: { input: String(hint) } };
}

export function processMedia(media?: string[] | NanobotMediaItem[]): MessageBlock[] {
  if (!media || !Array.isArray(media)) return [];
  const blocks: MessageBlock[] = [];
  for (const item of media) {
    if (typeof item === 'string') {
      if (item.startsWith('data:')) {
        const match = item.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          blocks.push({ type: 'image' as const, mediaType: match[1], data: match[2] });
        }
      } else if (item.startsWith('http')) {
        blocks.push({ type: 'image' as const, mediaType: 'image/jpeg', url: item });
      }
    } else if (item.type === 'image' && item.asset_id) {
      blocks.push({ type: 'image' as const, mediaType: item.mime_type || 'image/jpeg', url: `/api/v1/admin/assets/${item.asset_id}/download` });
    } else if (item.type === 'image' && item.url) {
      blocks.push({ type: 'image' as const, mediaType: item.mime_type || 'image/jpeg', url: item.url });
    }
  }
  return blocks;
}

interface StreamState {
  currentStreamingId: string | null;
}

export function applyEventToMessages(
  event: NanobotOutboundEvent,
  prevMessages: ChatMessage[],
  streamState: StreamState,
): ChatMessage[] {
  const { currentStreamingId } = streamState;

  if (event.eventType === 'progress') {
    return handleProgress(event, prevMessages, currentStreamingId);
  }

  if (event.eventType === 'tool_hint') {
    return handleToolHint(event, prevMessages);
  }

  if (event.eventType === 'final') {
    return handleFinal(event, prevMessages);
  }

  if (event.eventType === 'error') {
    return handleError(event, prevMessages);
  }

  return prevMessages;
}

function handleProgress(
  event: NanobotOutboundEvent,
  prevMessages: ChatMessage[],
  currentStreamingId: string | null,
): ChatMessage[] {
  const text = event.content;
  const toolHint = event.metadata?._tool_hint;

  const existingStreaming = currentStreamingId
    ? prevMessages.find(m => m.role === 'assistant' && m.isStreaming && m.id === currentStreamingId)
    : null;

  if (existingStreaming && existingStreaming.runId === event.eventId) {
    const idx = prevMessages.findIndex(m => m.id === existingStreaming.id);
    if (idx === -1) return prevMessages;

    const updated: ChatMessage = { ...existingStreaming };
    if (text) updated.content = text;

    const blocks: MessageBlock[] = [];
    if (toolHint) {
      const toolInfo = extractToolInfo(toolHint);
      if (toolInfo) {
        blocks.push({ type: 'tool_use', name: toolInfo.name, input: toolInfo.args, id: event.eventId });
      }
    }
    if (text) blocks.push({ type: 'text', text });
    updated.blocks = blocks;

    const newMsgs = [...prevMessages];
    newMsgs[idx] = updated;
    return newMsgs;
  }

  const blocks: MessageBlock[] = [];
  if (toolHint) {
    const toolInfo = extractToolInfo(toolHint);
    if (toolInfo) {
      blocks.push({ type: 'tool_use', name: toolInfo.name, input: toolInfo.args, id: event.eventId });
    }
  }
  if (text) blocks.push({ type: 'text', text });

  const msg: ChatMessage = {
    id: event.eventId,
    role: 'assistant',
    content: text || '',
    timestamp: Date.now(),
    blocks,
    isStreaming: true,
    runId: event.eventId,
    streamStartedAt: Date.now(),
  };

  return [...prevMessages, msg];
}

function handleToolHint(
  event: NanobotOutboundEvent,
  prevMessages: ChatMessage[],
): ChatMessage[] {
  const toolContent = event.content;
  if (!toolContent) return prevMessages;

  const toolInfo = extractToolInfo(toolContent);
  if (!toolInfo) return prevMessages;

  const last = prevMessages[prevMessages.length - 1];
  if (last && last.role === 'assistant' && last.isStreaming) {
    const updated = { ...last, blocks: [...last.blocks] };
    const existingToolIndex = updated.blocks.findIndex(
      b => b.type === 'tool_use' && b.id === event.eventId
    );
    if (existingToolIndex === -1) {
      updated.blocks.push({ type: 'tool_use', name: toolInfo.name, input: toolInfo.args, id: event.eventId });
    }
    return [...prevMessages.slice(0, -1), updated];
  }

  const msg: ChatMessage = {
    id: event.eventId,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    blocks: [{ type: 'tool_use', name: toolInfo.name, input: toolInfo.args, id: event.eventId }],
    isStreaming: true,
    runId: event.eventId,
    streamStartedAt: Date.now(),
  };
  return [...prevMessages, msg];
}

function handleFinal(
  event: NanobotOutboundEvent,
  prevMessages: ChatMessage[],
): ChatMessage[] {
  const newImageBlocks = processMedia(event.media);
  const multimodalResponse = event.multimodalResponse || event.multimodal_response;

  if (event.content || newImageBlocks.length > 0 || multimodalResponse) {
    for (let i = prevMessages.length - 1; i >= 0; i--) {
      const m = prevMessages[i];
      if (m.role === 'assistant' && m.isStreaming) {
        const finalBlocks: MessageBlock[] = event.content ? [{ type: 'text' as const, text: event.content }] : [];
        const mergedBlocks = [...finalBlocks, ...newImageBlocks];
        const updated: ChatMessage[] = [...prevMessages];
        const generationTimeMs = m.streamStartedAt ? Date.now() - m.streamStartedAt : undefined;
        updated[i] = {
          ...m,
          isStreaming: false,
          content: event.content,
          blocks: mergedBlocks,
          multimodalResponse,
          ...(generationTimeMs != null ? { generationTimeMs } : {}),
        };
        return updated;
      }
    }
    const blocks: MessageBlock[] = [...newImageBlocks, { type: 'text' as const, text: event.content }];
    return [...prevMessages, {
      id: event.eventId,
      role: 'assistant' as const,
      content: event.content,
      timestamp: Date.now(),
      blocks,
      isStreaming: false,
      multimodalResponse,
    }];
  }

  for (let i = prevMessages.length - 1; i >= 0; i--) {
    const m = prevMessages[i];
    if (m.role === 'assistant' && m.isStreaming) {
      const updated: ChatMessage[] = [...prevMessages];
      const generationTimeMs = m.streamStartedAt ? Date.now() - m.streamStartedAt : undefined;
      updated[i] = { ...m, isStreaming: false, ...(generationTimeMs != null ? { generationTimeMs } : {}) };
      return updated;
    }
  }
  return prevMessages;
}

function handleError(
  event: NanobotOutboundEvent,
  prevMessages: ChatMessage[],
): ChatMessage[] {
  for (let i = prevMessages.length - 1; i >= 0; i--) {
    const m = prevMessages[i];
    if (m.role === 'assistant' && m.isStreaming) {
      const updated: ChatMessage[] = [...prevMessages];
      updated[i] = { ...m, isStreaming: false };
      return updated;
    }
  }
  return [...prevMessages, {
    id: 'error-' + Date.now(),
    role: 'assistant' as const,
    content: `Error: ${event.content || 'Unknown error'}`,
    timestamp: Date.now(),
    blocks: [{ type: 'text' as const, text: `Error: ${event.content || 'Unknown error'}` }],
  }];
}