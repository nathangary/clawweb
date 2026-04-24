import { useRef, useCallback, useState } from 'react';
import type { NanobotGatewayClient, NanobotOutboundEvent } from '../lib/nanobotGateway';

export interface StreamMessage {
  id: string;
  type: 'progress' | 'tool_use' | 'tool_result' | 'thinking' | 'text' | 'final';
  content: string;
  name?: string;
  input?: Record<string, unknown>;
}

function extractToolInfo(toolHint: string): { name: string; args: Record<string, unknown> } | null {
  try {
    if (toolHint.startsWith('{')) {
      const parsed = JSON.parse(toolHint);
      if (parsed.name || parsed.tool) {
        return { name: parsed.name || parsed.tool, args: parsed.input || parsed.arguments || parsed.args || {} };
      }
    }
    const match = toolHint.match(/^(\w+)\s*\(([\s\S]*)\)$/);
    if (match) {
      const name = match[1];
      let args: Record<string, unknown> = {};
      if (match[2].trim()) {
        try {
          args = JSON.parse(match[2].replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":'));
        } catch {
          args = { _raw: match[2] };
        }
      }
      return { name, args };
    }
  } catch {}
  return null;
}

function applyProgress(event: NanobotOutboundEvent, prev: StreamMessage[]): StreamMessage[] {
  const msgs = [...prev];
  const text = event.content;
  const toolHint = event.metadata?._tool_hint;
  const thinking = event.metadata?._thinking as string | undefined;

  if (thinking) {
    const thinkIdx = msgs.findIndex(m => m.type === 'thinking');
    if (thinkIdx >= 0) {
      msgs[thinkIdx] = { ...msgs[thinkIdx], content: thinking };
    } else {
      msgs.push({ id: `thinking-${event.eventId}`, type: 'thinking', content: thinking });
    }
  }
  if (toolHint && typeof toolHint === 'string') {
    const toolInfo = extractToolInfo(toolHint);
    if (toolInfo) {
      const existingIdx = msgs.findIndex(m => m.type === 'tool_use' && m.id === `tool-${event.eventId}`);
      if (existingIdx < 0) {
        msgs.push({ id: `tool-${event.eventId}`, type: 'tool_use', content: '', name: toolInfo.name, input: toolInfo.args });
      }
    }
  }
  if (text) {
    const textTarget = msgs[msgs.length - 1];
    if (textTarget && textTarget.type === 'text' && textTarget.id.startsWith('text-')) {
      msgs[msgs.length - 1] = { ...textTarget, content: textTarget.content + text };
    } else {
      msgs.push({ id: `text-${event.eventId}`, type: 'text', content: text });
    }
  }
  return msgs;
}

function applyToolHint(event: NanobotOutboundEvent, prev: StreamMessage[]): StreamMessage[] {
  const toolContent = event.content;
  if (!toolContent) return prev;
  const toolInfo = extractToolInfo(toolContent);
  if (!toolInfo) return prev;
  const existingIdx = prev.findIndex(m => m.type === 'tool_use' && m.id === `tool-${event.eventId}`);
  if (existingIdx < 0) {
    return [...prev, { id: `tool-${event.eventId}`, type: 'tool_use', content: '', name: toolInfo.name, input: toolInfo.args }];
  }
  return prev;
}

export type StreamFinalHandler = (event: NanobotOutboundEvent) => void;

export interface UseAgentEventStreamReturn {
  messages: StreamMessage[];
  clearMessages: () => void;
  startStream: (
    client: NanobotGatewayClient,
    message: string,
    attachments: Array<{ mimeType: string; fileName: string; content: string }> | undefined,
    onFinal: StreamFinalHandler,
    onError: (event: NanobotOutboundEvent) => void,
    options?: { session_params?: Record<string, unknown> },
  ) => void;
  cancelStream: () => void;
}

export function useAgentEventStream(): UseAgentEventStreamReturn {
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const handledRef = useRef(false);

  const clearMessages = useCallback(() => setMessages([]), []);

  const cancelStream = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    handledRef.current = true;
  }, []);

  const startStream = useCallback(
    (client: NanobotGatewayClient, message: string, attachments: Array<{ mimeType: string; fileName: string; content: string }> | undefined, onFinal: StreamFinalHandler, onError: (event: NanobotOutboundEvent) => void, options?: { session_params?: Record<string, unknown> }) => {
      cancelStream();
      handledRef.current = false;
      setMessages([]);

      client.setChatId(`agentloop-${Date.now()}`);
      client.send(message, attachments, options);

      const handler = (event: NanobotOutboundEvent) => {
        if (handledRef.current) return;

        if (event.eventType === 'progress') {
          setMessages(prev => applyProgress(event, prev));
          client.ack(event.eventId);
        } else if (event.eventType === 'tool_hint') {
          setMessages(prev => applyToolHint(event, prev));
          client.ack(event.eventId);
        } else if (event.eventType === 'final') {
          handledRef.current = true;
          client.ack(event.eventId);
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
          onFinal(event);
        } else if (event.eventType === 'error') {
          handledRef.current = true;
          onError(event);
        }
      };

      unsubscribeRef.current = client.onEvent(handler);
    },
    [cancelStream],
  );

  return { messages, clearMessages, startStream, cancelStream };
}
