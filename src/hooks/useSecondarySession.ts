import { useState, useCallback, useEffect, useRef } from 'react';
import type { NanobotGatewayClient, NanobotOutboundEvent } from '../lib/nanobotGateway';
import type { ChatMessage } from '../types';
import { NanobotApiClient } from '../lib/nanobotApi';

export function useSecondarySession(
  getClient: () => NanobotGatewayClient | null,
  sessionKey: string | null,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const sessionKeyRef = useRef(sessionKey);
  const apiClientRef = useRef<NanobotApiClient | null>(null);
  const currentEventIdRef = useRef<string | null>(null);

  useEffect(() => { sessionKeyRef.current = sessionKey; }, [sessionKey]);

  const loadHistory = useCallback(async (key: string) => {
    if (!apiClientRef.current) return;
    setIsLoadingHistory(true);
    try {
      const res = await apiClientRef.current.getSessionHistory(key, 1, 100, 'asc');
      if (res.applied && res.data.messages) {
        const msgs: ChatMessage[] = res.data.messages.map((m, i) => ({
          id: `${key}-${i}`,
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

  useEffect(() => {
    if (!sessionKey) {
      setMessages([]);
      return;
    }
    loadHistory(sessionKey);
  }, [sessionKey, loadHistory]);

  const handleEvent = useCallback((event: NanobotOutboundEvent) => {
    if (!sessionKeyRef.current) return;
    if (event.sessionKey !== sessionKeyRef.current) return;

    if (event.eventType === 'progress') {
      setIsGenerating(true);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.isStreaming) {
          return [...prev.slice(0, -1), { ...last, content: event.content, blocks: [{ type: 'text', text: event.content }] }];
        }
        return [...prev, { id: event.eventId, role: 'assistant' as const, content: event.content, timestamp: Date.now(), blocks: [{ type: 'text' as const, text: event.content }], isStreaming: true, runId: event.eventId }];
      });
    } else if (event.eventType === 'final') {
      currentEventIdRef.current = null;
      setIsGenerating(false);
      if (sessionKeyRef.current) loadHistory(sessionKeyRef.current);
    } else if (event.eventType === 'error') {
      currentEventIdRef.current = null;
      setIsGenerating(false);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.isStreaming) {
          return [...prev.slice(0, -1), { ...last, isStreaming: false }];
        }
        return [...prev, { id: 'error-' + Date.now(), role: 'assistant' as const, content: `Error: ${event.content || 'Unknown error'}`, timestamp: Date.now(), blocks: [{ type: 'text' as const, text: `Error: ${event.content || 'Unknown error'}` }] }];
      });
    }
  }, [loadHistory]);

  useEffect(() => {
    const client = getClient();
    if (!client || !sessionKey) return;
    if (!apiClientRef.current) {
      const wsUrl = '';
      apiClientRef.current = new NanobotApiClient(wsUrl);
    }
    const unsub = client.onEvent(handleEvent);
    return unsub;
  }, [sessionKey, getClient, handleEvent]);

  const sendMessage = useCallback(async (text: string, attachments?: Array<{ mimeType: string; fileName: string; content: string }>) => {
    if (!sessionKeyRef.current) return;
    const msgId = 'user-' + Date.now();
    const userMsg: ChatMessage = {
      id: msgId,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      blocks: [{ type: 'text', text }],
      sendStatus: 'sending',
    };
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);
    try {
      getClient()?.send(text, attachments);
      currentEventIdRef.current = msgId;
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, sendStatus: 'sent' as const } : m));
    } catch {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, sendStatus: 'error' as const } : m));
      setIsGenerating(false);
    }
  }, [getClient]);

  const abort = useCallback(async () => {
    setIsGenerating(false);
  }, []);

  return { messages, isLoadingHistory, isGenerating, sendMessage, abort };
}
