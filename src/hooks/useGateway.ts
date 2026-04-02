import { useState, useEffect, useRef, useCallback } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { getStoredCredentials } from '../lib/credentials';
import { genId } from '../lib/utils';
import type { ChatMessage, MessageBlock, Session } from '../types';
import type { NanobotOutboundEvent } from '../lib/nanobotGateway';

export function useGateway() {
  const status = useConnectionStore(s => s.status);
  const getClient = useConnectionStore(s => s.getClient);
  const getApiClient = useConnectionStore(s => s.getApiClient);
  const disconnect = useConnectionStore(s => s.disconnect);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState('transport:web');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const isConnectingRef = useRef(false);
  const messagesRef = useRef(messages);
  const activeSessionRef = useRef(activeSession);
  const currentEventIdRef = useRef<string | null>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const stored = getStoredCredentials();
    if (stored?.url && (stored.url.startsWith('ws://') || stored.url.startsWith('wss://'))) {
      login(stored.url, stored.token);
    } else {
      setAuthenticated(false);
    }
  }, []);

  const handleEvent = useCallback((event: NanobotOutboundEvent) => {
    const eventSession = event.sessionKey;
    const eventChatId = event.chatId;
    const activeSess = activeSessionRef.current;
    
    if (activeSess.startsWith('transport:')) {
      const activeChatId = activeSess.replace('transport:', '');
      if (eventChatId !== activeChatId) {
        if (eventChatId && eventChatId.startsWith('web-')) {
          const newSession = `transport:${eventChatId}`;
          setActiveSession(newSession);
          activeSessionRef.current = newSession;
        } else {
          return;
        }
      }
    } else if (eventSession && eventSession !== activeSess) {
      return;
    }

    getClient()?.ack(event.eventId);

    if (event.eventType === 'progress') {
      const text = event.content;
      const toolHint = event.metadata?._tool_hint;

      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.isStreaming && last.runId === event.eventId) {
          const updated = { ...last };
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
          return [...prev.slice(0, -1), updated];
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
        return [...prev, msg];
      });
    } else if (event.eventType === 'tool_hint') {
      const toolContent = event.content;
      if (toolContent) {
        const toolInfo = extractToolInfo(toolContent);
        if (toolInfo) {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant' && last.isStreaming) {
              const updated = { ...last, blocks: [...last.blocks] };
              const existingToolIndex = updated.blocks.findIndex(
                b => b.type === 'tool_use' && b.id === event.eventId
              );
              if (existingToolIndex === -1) {
                updated.blocks.push({ type: 'tool_use', name: toolInfo.name, input: toolInfo.args, id: event.eventId });
              }
              return [...prev.slice(0, -1), updated];
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
            return [...prev, msg];
          });
        }
      }
    } else if (event.eventType === 'final') {
      if (currentEventIdRef.current) {
        const lastMsg = messagesRef.current[messagesRef.current.length - 1];
        if (lastMsg?.role === 'assistant' && lastMsg.streamStartedAt) {
          const genTime = Date.now() - lastMsg.streamStartedAt;
          lastMsg.generationTimeMs = genTime;
        }
      }
      currentEventIdRef.current = null;
      setIsGenerating(false);

      const processMedia = (media?: string[]): MessageBlock[] => {
        if (!media || !Array.isArray(media)) return [];
        const blocks: MessageBlock[] = [];
        for (const path of media) {
          if (path.startsWith('data:')) {
            const match = path.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              blocks.push({ type: 'image' as const, mediaType: match[1], data: match[2] });
            }
          } else if (path.startsWith('http')) {
            blocks.push({ type: 'image' as const, mediaType: 'image/jpeg', url: path });
          }
        }
        return blocks;
      };

      const newImageBlocks = processMedia(event.media);

      if (event.content || newImageBlocks.length > 0) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.isStreaming) {
            const mergedBlocks = [...last.blocks, ...newImageBlocks];
            return [...prev.slice(0, -1), { 
              ...last, 
              isStreaming: false, 
              content: event.content,
              blocks: mergedBlocks.length > 0 ? mergedBlocks : last.blocks
            }];
          }
          return prev;
        });
      } else {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.isStreaming) {
            return [...prev.slice(0, -1), { ...last, isStreaming: false }];
          }
          return prev;
        });
      }
      loadHistory(activeSessionRef.current);
    } else if (event.eventType === 'error') {
      currentEventIdRef.current = null;
      setIsGenerating(false);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.isStreaming) {
          return [...prev.slice(0, -1), { ...last, isStreaming: false }];
        }
        return [...prev, {
          id: 'error-' + Date.now(),
          role: 'assistant' as const,
          content: `Error: ${event.content || 'Unknown error'}`,
          timestamp: Date.now(),
          blocks: [{ type: 'text' as const, text: `Error: ${event.content || 'Unknown error'}` }],
        }];
      });
    }
  }, [getClient]);

  function extractToolInfo(hint: unknown): { name: string; args: Record<string, unknown> } | null {
    if (typeof hint !== 'string') return null;
    const match = hint.match(/^(\w+)\("(.*)"\)$/);
    if (match) {
      return { name: match[1], args: { input: match[2] } };
    }
    return { name: 'tool', args: { input: String(hint) } };
  }

  const loadSessions = useCallback(async () => {
    const api = getApiClient();
    if (!api) return;
    try {
      const res = await api.getSessions();
      if (res.applied && res.data.sessions) {
        setSessions(res.data.sessions.map(s => ({
          key: s.key,
          label: s.key,
          messageCount: s.message_count || s.messageCount,
        })));
      }
    } catch {
      setSessions([]);
    }
  }, [getApiClient]);

  const loadHistory = useCallback(async (sessionKey: string) => {
    const api = getApiClient();
    if (!api) return;
    setIsLoadingHistory(true);
    try {
      const res = await api.getSessionHistory(sessionKey, 1, 100, 'asc');
      if (res.applied && res.data.messages) {
        const baseUrl = api.getBaseUrl().replace('/api', '');
        const msgs: ChatMessage[] = res.data.messages.map((m, i) => {
          const blocks: MessageBlock[] = [];
          if (m.media && Array.isArray(m.media)) {
            for (const path of m.media) {
              if (path.startsWith('data:')) {
                const match = path.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                  blocks.push({ type: 'image' as const, mediaType: match[1], data: match[2] });
                }
              } else if (path.startsWith('http')) {
                blocks.push({ type: 'image' as const, mediaType: 'image/jpeg', url: path });
              } else {
                const match = path.match(/workspace[/\\](.+)$/);
                const relativePath = match ? match[1] : path;
                const url = `${baseUrl}/api/v1/files/${encodeURIComponent(relativePath)}`;
                blocks.push({ type: 'image' as const, mediaType: 'image/jpeg', url });
              }
            }
          }
          blocks.push({ type: 'text' as const, text: m.content });
          return {
            id: `${sessionKey}-${i}`,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(m.timestamp).getTime(),
            blocks,
          };
        });
        setMessages(msgs);
      }
    } catch {
      setMessages([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [getApiClient]);

  useEffect(() => {
    const unsub = useConnectionStore.subscribe((state, prevState) => {
      if (state.status !== prevState.status) {
        if (state.status === 'connected') {
          setAuthenticated(true);
          setConnectError(null);
          setIsConnecting(false);
          isConnectingRef.current = false;
          loadSessions();
          loadHistory(activeSessionRef.current);
        } else if (state.status === 'disconnected' && isConnectingRef.current) {
          setConnectError('Connection failed — check URL');
          setIsConnecting(false);
          isConnectingRef.current = false;
          setAuthenticated(false);
        }
      }
    });
    return unsub;
  }, [loadHistory, loadSessions]);

  const sendMessage = useCallback(async (text: string, attachments?: Array<{ mimeType: string; fileName: string; content: string }>) => {
    const msgId = 'user-' + Date.now();
    const imageBlocks: MessageBlock[] = (attachments ?? [])
      .filter(a => a.mimeType.startsWith('image/'))
      .map(a => ({ type: 'image' as const, mediaType: a.mimeType, data: a.content }));
    const userMsg: ChatMessage = {
      id: msgId,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      blocks: [...imageBlocks, { type: 'text', text }],
      sendStatus: 'sending',
    };
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      getClient()?.send(text, attachments);
      currentEventIdRef.current = genId('event');
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, sendStatus: 'sent' as const } : m));
    } catch {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, sendStatus: 'error' as const } : m));
      setIsGenerating(false);
    }
  }, [getClient]);

  const abort = useCallback(async () => {
    setIsGenerating(false);
  }, []);

  const switchSession = useCallback((key: string) => {
    setActiveSession(key);
    activeSessionRef.current = key;
    setMessages([]);
    loadHistory(key);
    if (key.startsWith('transport:')) {
      const chatId = key.replace('transport:', '');
      getClient()?.setChatId(chatId);
    }
  }, [loadHistory, getClient]);

  const createNewSession = useCallback(async () => {
    const newChatId = `web-${Date.now()}`;
    const newSessionKey = `transport:${newChatId}`;
    switchSession(newSessionKey);
  }, [switchSession]);

  const login = useCallback((url: string, token?: string) => {
    setIsConnecting(true);
    isConnectingRef.current = true;
    setConnectError(null);
    useConnectionStore.getState().connect(url, token, undefined, handleEvent);
  }, [handleEvent]);

  const logout = useCallback(() => {
    disconnect();
    setAuthenticated(false);
    setMessages([]);
    setSessions([]);
    setConnectError(null);
  }, [disconnect]);

  useEffect(() => {
    if (status !== 'connected') return;
    const interval = setInterval(loadSessions, 30000);
    return () => clearInterval(interval);
  }, [status, loadSessions]);

  const enrichedSessions = sessions.map(s => ({
    ...s,
    isActive: false,
    hasUnread: false,
    unreadCount: 0,
  }));

  return {
    status, messages, sessions: enrichedSessions, activeSession, isGenerating, isLoadingHistory,
    sendMessage, abort, switchSession, createNewSession, loadSessions,
    authenticated, login, logout, connectError, isConnecting,
    getClient, getApiClient,
  };
}
