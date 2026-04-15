import { useEffect, useRef, useCallback } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { useChatStore } from '../stores/chatStore';
import { getStoredCredentials } from '../lib/credentials';
import type { ChatMessage, MessageBlock } from '../types';

export function useGateway() {
  const effectiveStatus = useConnectionStore(s => s.effectiveStatus);
  const getClient = useConnectionStore(s => s.getClient);
  const getApiClient = useConnectionStore(s => s.getApiClient);
  const disconnect = useConnectionStore(s => s.disconnect);

  const messages = useChatStore(s => s.messages);
  const sessions = useChatStore(s => s.sessions);
  const activeSession = useChatStore(s => s.activeSession);
  const isGenerating = useChatStore(s => s.isGenerating);
  const isLoadingHistory = useChatStore(s => s.isLoadingHistory);
  const authenticated = useChatStore(s => s.authenticated);
  const connectError = useChatStore(s => s.connectError);
  const isConnecting = useChatStore(s => s.isConnecting);

  const isConnectingRef = useRef(false);
  const initRef = useRef(false);
  const prevEffectiveStatusRef = useRef<string>(effectiveStatus);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const stored = getStoredCredentials();
    if (stored?.url && (stored.url.startsWith('ws://') || stored.url.startsWith('wss://') || stored.url.startsWith('/'))) {
      useChatStore.getState().setIsConnecting(true);
      isConnectingRef.current = true;
      useChatStore.getState().setConnectError(null);
      useConnectionStore.getState().connect(stored.url, stored.token, undefined, (e) => {
        const client = useConnectionStore.getState().getClient();
        if (client) client.ack(e.eventId);
        useChatStore.getState().handleEvent(e);
      });
    } else {
      useChatStore.getState().setAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    const prev = prevEffectiveStatusRef.current;
    if (effectiveStatus === prev) return;
    prevEffectiveStatusRef.current = effectiveStatus;

    if (effectiveStatus === 'connected') {
      const chat = useChatStore.getState();
      chat.setAuthenticated(true);
      chat.setConnectError(null);
      chat.setIsConnecting(false);
      isConnectingRef.current = false;
      chat.updateMessages(prev =>
        prev.map(m =>
          m.sendStatus === 'sending'
            ? { ...m, sendStatus: 'sent' as const }
            : m
        )
      );
      const api = useConnectionStore.getState().getApiClient();
      chat.loadSessions(api);
      chat.loadHistory(chat.activeSession, api);
    } else if (effectiveStatus === 'disconnected') {
      const chat = useChatStore.getState();
      if (isConnectingRef.current) {
        chat.setConnectError('Connection failed — check URL');
        chat.setIsConnecting(false);
        isConnectingRef.current = false;
        chat.setAuthenticated(false);
      } else {
        chat.updateMessages(prev =>
          prev.map(m =>
            m.sendStatus === 'sending'
              ? { ...m, sendStatus: 'error' as const }
              : m
          )
        );
        chat.setIsGenerating(false);
      }
    }
  }, [effectiveStatus]);

  const sendMessage = useCallback(async (text: string, attachments?: Array<{ mimeType: string; fileName: string; content: string }>) => {
    const msgId = 'user-' + Date.now();
    const blocks: MessageBlock[] = [];
    for (const a of attachments ?? []) {
      if (a.mimeType.startsWith('image/')) {
        blocks.push({ type: 'image', mediaType: a.mimeType, data: a.content });
      } else {
        blocks.push({ type: 'file', fileName: a.fileName, mediaType: a.mimeType, data: a.content });
      }
    }
    blocks.push({ type: 'text', text });
    const userMsg: ChatMessage = {
      id: msgId,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      blocks,
      sendStatus: 'sending',
    };

    useChatStore.getState().updateMessages(prev => [...prev, userMsg]);
    useChatStore.getState().setIsGenerating(true);

    try {
      getClient()?.send(text, attachments);
      useChatStore.getState().updateMessages(prev => prev.map(m => m.id === msgId ? { ...m, sendStatus: 'sent' as const } : m));
    } catch {
      useChatStore.getState().updateMessages(prev => prev.map(m => m.id === msgId ? { ...m, sendStatus: 'error' as const } : m));
      useChatStore.getState().setIsGenerating(false);
    }
  }, [getClient]);

  const abort = useCallback(async () => {
    const client = getClient();
    if (client) {
      const sent = client.stop();
      if (!sent) {
        console.warn('[Gateway] stop() failed — WebSocket not connected');
      }
    }
    useChatStore.getState().setIsGenerating(false);
  }, [getClient]);

  const switchSession = useCallback((key: string) => {
    const chat = useChatStore.getState();
    const client = getClient();
    const api = getApiClient();
    chat.setActiveSession(key);
    chat.setMessages([]);
    chat.loadHistory(key, api);
    if (key.startsWith('transport:') && client) {
      const chatId = key.replace('transport:', '');
      client.setChatId(chatId);
    } else if (client) {
      client.setChatId('web');
    }
  }, [getClient, getApiClient]);

  const createNewSession = useCallback(async () => {
    const newChatId = `web-${Date.now()}`;
    const newSessionKey = `transport:${newChatId}`;
    switchSession(newSessionKey);
  }, [switchSession]);

  const login = useCallback((url: string, token?: string) => {
    useChatStore.getState().setIsConnecting(true);
    isConnectingRef.current = true;
    useChatStore.getState().setConnectError(null);
    useConnectionStore.getState().connect(url, token, undefined, (e) => {
      const client = useConnectionStore.getState().getClient();
      if (client) client.ack(e.eventId);
      useChatStore.getState().handleEvent(e);
    });
  }, []);

  const logout = useCallback(() => {
    disconnect();
    useChatStore.getState().reset();
  }, [disconnect]);

  const deleteSession = useCallback(async (key: string) => {
    const api = getApiClient();
    if (!api) return;
    const res = await api.deleteSession(key);
    if (res.applied) {
      useChatStore.getState().setSessions(sessions.filter(s => s.key !== key));
      if (activeSession === key) {
        const remaining = sessions.filter(s => s.key !== key);
        if (remaining.length > 0) {
          switchSession(remaining[0].key);
        }
      }
    }
  }, [getApiClient, sessions, activeSession, switchSession]);

  const enrichedSessions = sessions.map(s => ({
    ...s,
    isActive: false,
    hasUnread: false,
    unreadCount: 0,
  }));

  return {
    status: effectiveStatus, messages, sessions: enrichedSessions, activeSession, isGenerating, isLoadingHistory,
    sendMessage, abort, switchSession, createNewSession, deleteSession,
    authenticated, login, logout, connectError, isConnecting,
    getClient, getApiClient,
  };
}