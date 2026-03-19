import { useState, useEffect, useRef, useCallback } from 'react';
import { NanobotGatewayClient, type NanobotOutboundEvent } from '../lib/nanobotGateway';
import { NanobotApiClient } from '../lib/nanobotApi';
import { genId } from '../lib/utils';
import { getStoredCredentials, storeCredentials, clearCredentials } from '../lib/credentials';
import type { ChatMessage, MessageBlock, ConnectionStatus, Session } from '../types';

export function useGateway() {
  const wsClientRef = useRef<NanobotGatewayClient | null>(null);
  const apiClientRef = useRef<NanobotApiClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
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
  const sessionsRef = useRef(sessions);
  const currentEventIdRef = useRef<string | null>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

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

    wsClientRef.current?.ack(event.eventId);

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
            return prev;
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
      if (event.content) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.isStreaming) {
            return [...prev.slice(0, -1), { ...last, isStreaming: false, content: event.content }];
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
  }, []);

  function extractToolInfo(hint: unknown): { name: string; args: Record<string, unknown> } | null {
    if (typeof hint !== 'string') return null;
    const match = hint.match(/^(\w+)\("(.*)"\)$/);
    if (match) {
      return { name: match[1], args: { input: match[2] } };
    }
    return { name: 'tool', args: { input: String(hint) } };
  }

  const loadSessions = useCallback(async () => {
    if (!apiClientRef.current) return;
    try {
      const res = await apiClientRef.current.getSessions();
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
  }, []);

  const loadHistory = useCallback(async (sessionKey: string) => {
    if (!apiClientRef.current) return;
    setIsLoadingHistory(true);
    try {
      const res = await apiClientRef.current.getSessionHistory(sessionKey, 1, 100, 'asc');
      if (res.applied && res.data.messages) {
        const msgs: ChatMessage[] = res.data.messages.map((m, i) => ({
          id: `${sessionKey}-${i}`,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.timestamp).getTime(),
          blocks: [{ type: 'text' as const, text: m.content }],
        }));
        setMessages(msgs);
      }
    } catch {
      setMessages([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const setupClient = useCallback((wsUrl: string, token?: string, restUrl?: string) => {
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
    }
    const apiUrl = restUrl || `http://${new URL(wsUrl).hostname}:18790`;
    if (!apiClientRef.current) {
      apiClientRef.current = new NanobotApiClient(apiUrl, token);
    } else {
      apiClientRef.current.setCredentials(apiUrl, token);
    }

    const client = new NanobotGatewayClient(wsUrl, token);
    wsClientRef.current = client;

    client.onStatus((s) => {
      setStatus(s);
      if (s === 'connected') {
        setAuthenticated(true);
        setConnectError(null);
        setIsConnecting(false);
        isConnectingRef.current = false;
        storeCredentials(wsUrl, token, restUrl);
        loadSessions();
        loadHistory(activeSessionRef.current);
      } else if (s === 'disconnected' && !client.isConnected) {
        if (isConnectingRef.current) {
          setConnectError('Connection failed — check URL');
          setIsConnecting(false);
          isConnectingRef.current = false;
          setAuthenticated(false);
        }
      }
    });

    client.onEvent(handleEvent);

    setIsConnecting(true);
    isConnectingRef.current = true;
    setConnectError(null);
    client.connect();
  }, [handleEvent, loadHistory, loadSessions]);

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const stored = getStoredCredentials();
    if (stored) {
      setupClient(stored.url, stored.token, stored.restUrl);
    } else {
      setAuthenticated(false);
    }
  }, [setupClient]);

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
      wsClientRef.current?.send(text, attachments);
      currentEventIdRef.current = genId('event');
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, sendStatus: 'sent' as const } : m));
    } catch {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, sendStatus: 'error' as const } : m));
      setIsGenerating(false);
    }
  }, []);

  const abort = useCallback(async () => {
    setIsGenerating(false);
  }, []);

  const switchSession = useCallback((key: string) => {
    setActiveSession(key);
    activeSessionRef.current = key;
    setMessages([]);
    loadHistory(key);
  }, [loadHistory]);

  const createNewSession = useCallback(async () => {
    const newChatId = `web-${Date.now()}`;
    const newSessionKey = `transport:${newChatId}`;
    switchSession(newSessionKey);
  }, [switchSession]);

  const login = useCallback((url: string, token?: string, restUrl?: string) => {
    setupClient(url, token, restUrl);
  }, [setupClient]);

  const logout = useCallback(() => {
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
      wsClientRef.current = null;
    }
    clearCredentials();
    setAuthenticated(false);
    setMessages([]);
    setSessions([]);
    setStatus('disconnected');
    setConnectError(null);
  }, []);

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

  const getClient = useCallback(() => wsClientRef.current, []);
  const getApiClient = useCallback(() => apiClientRef.current, []);

  return {
    status, messages, sessions: enrichedSessions, activeSession, isGenerating, isLoadingHistory,
    sendMessage, abort, switchSession, createNewSession, loadSessions,
    authenticated, login, logout, connectError, isConnecting,
    getClient, getApiClient,
  };
}
