import { create } from 'zustand';
import type { ChatMessage, Session } from '../types';
import type { NanobotOutboundEvent } from '../lib/nanobotGateway';
import type { NanobotApiClient } from '../lib/nanobotApi';
import { applyEventToMessages } from '../lib/messageHandler';
import { mergeWithCache, setCachedMessages, getCachedMessages } from '../lib/messageCache';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface ChatState {
  messages: ChatMessage[];
  sessions: Session[];
  activeSession: string;
  isGenerating: boolean;
  isLoadingHistory: boolean;
  authenticated: boolean | null;
  connectError: string | null;
  isConnecting: boolean;
  currentStreamingId: string | null;

  setMessages: (msgs: ChatMessage[]) => void;
  updateMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  setSessions: (sessions: Session[]) => void;
  setActiveSession: (key: string) => void;
  setIsGenerating: (v: boolean) => void;
  setIsLoadingHistory: (v: boolean) => void;
  setAuthenticated: (v: boolean | null) => void;
  setConnectError: (v: string | null) => void;
  setIsConnecting: (v: boolean) => void;
  setCurrentStreamingId: (v: string | null) => void;

  handleEvent: (event: NanobotOutboundEvent) => void;
  loadHistory: (sessionKey: string, api: NanobotApiClient | null) => Promise<void>;
  loadSessions: (api: NanobotApiClient | null) => Promise<void>;
  switchSession: (key: string, setChatId: (chatId: string) => void) => Promise<void>;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  sessions: [],
  activeSession: 'transport:web',
  isGenerating: false,
  isLoadingHistory: false,
  authenticated: null,
  connectError: null,
  isConnecting: false,
  currentStreamingId: null,

  setMessages: (msgs) => set({ messages: msgs }),
  updateMessages: (updater) => set((state) => ({ messages: updater(state.messages) })),
  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (key) => set({ activeSession: key }),
  setIsGenerating: (v: boolean) => set({ isGenerating: v }),
  setIsLoadingHistory: (v: boolean) => set({ isLoadingHistory: v }),
  setAuthenticated: (v: boolean | null) => set({ authenticated: v }),
  setConnectError: (v: string | null) => set({ connectError: v }),
  setIsConnecting: (v: boolean) => set({ isConnecting: v }),
  setCurrentStreamingId: (v: string | null) => set({ currentStreamingId: v }),

  handleEvent: (event) => {
    const state = get();
    const activeSess = state.activeSession;
    const eventChatId = event.chatId;
    const eventSession = event.sessionKey;

    if (activeSess.startsWith('transport:')) {
      const activeChatId = activeSess.replace('transport:', '');
      if (eventChatId !== activeChatId) {
        return;
      }
    } else if (eventSession && eventSession !== activeSess) {
      return;
    }

    const newMessages = applyEventToMessages(event, state.messages, {
      currentStreamingId: state.currentStreamingId,
    });

    const isTerminalEvent = event.eventType === 'final' || event.eventType === 'error';

    const patch: Partial<ChatState> = {
      messages: newMessages,
      currentStreamingId: isTerminalEvent ? null : (event.eventType === 'progress' ? event.eventId : state.currentStreamingId),
      ...(isTerminalEvent ? { isGenerating: false } : {}),
    };

    set(patch);
  },

  loadHistory: async (sessionKey, api) => {
    if (!api) return;
    const currentState = get();
    if (currentState.isLoadingHistory) return;
    set({ isLoadingHistory: true });
    try {
      const res = await api.getSessionHistory(sessionKey, 1, 100, 'asc');
      if (res.applied && res.data.messages) {
        const baseUrl = api.getBaseUrl().replace('/api', '');
        const msgs: ChatMessage[] = await Promise.all(res.data.messages.map(async (m, i) => {
          const blocks: ChatMessage['blocks'] = [];
          if (m.media && Array.isArray(m.media)) {
            for (const path of m.media) {
              if (path.startsWith('data:')) {
                const match = path.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                  blocks.push({ type: 'image', mediaType: match[1], data: match[2] });
                }
              } else if (path.startsWith('http')) {
                blocks.push({ type: 'image', mediaType: 'image/jpeg', url: path });
              } else {
                const match = path.match(/workspace[/\\](.+)$/);
                const relativePath = match ? match[1] : path;
                const url = `${baseUrl}/api/v1/files/${encodeURIComponent(relativePath)}`;
                blocks.push({ type: 'image', mediaType: 'image/jpeg', url });
              }
            }
          }
          if (m.multimodal_response?.media) {
            for (const item of m.multimodal_response.media) {
              if (item.type === 'image' && item.asset_id) {
                try {
                  const blob = await api.downloadAsset(item.asset_id);
                  const base64 = await blobToBase64(blob);
                  blocks.push({ type: 'image', mediaType: item.mime_type || 'image/jpeg', data: base64 });
                } catch {
                  blocks.push({ type: 'image', mediaType: item.mime_type || 'image/jpeg', url: `/api/v1/admin/assets/${item.asset_id}/download` });
                }
              } else if (item.type === 'image' && item.url) {
                blocks.push({ type: 'image', mediaType: item.mime_type || 'image/jpeg', url: item.url });
              }
            }
          }
          blocks.push({ type: 'text', text: m.content });
          return {
            id: `${sessionKey}-${i}`,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(m.timestamp).getTime(),
            blocks,
            multimodalResponse: m.multimodal_response,
          };
        }));
        const cached = await getCachedMessages(sessionKey);
        const { messages: merged, wasCompacted } = mergeWithCache(msgs, cached);
        const serverMessages = wasCompacted ? merged : msgs;
        const currentMessages = get().messages;
        const streamingOrPending = currentMessages.filter(
          m => m.sendStatus === 'sending' || m.sendStatus === 'sent' || m.isStreaming
        );
        const streamingIds = new Set(streamingOrPending.map(m => m.id));
        const finalMessages = [
          ...serverMessages.filter(m => !streamingIds.has(m.id)),
          ...streamingOrPending,
        ];
        set({ messages: finalMessages, isLoadingHistory: false });
        if (wasCompacted) {
          void setCachedMessages(sessionKey, finalMessages);
        } else {
          void setCachedMessages(sessionKey, serverMessages);
        }
      }
    } catch {
      set({ messages: [], isLoadingHistory: false });
    }
  },

  loadSessions: async (api) => {
    if (!api) return;
    try {
      const res = await api.getSessions();
      if (res.applied && res.data.sessions) {
        set({
          sessions: res.data.sessions.map(s => ({
            key: s.key,
            label: s.display_key || s.key,
            messageCount: s.message_count || s.messageCount,
          })),
        });
      }
    } catch {
      set({ sessions: [] });
    }
  },

  switchSession: async (key, setChatId) => {
    set({ activeSession: key, messages: [] });
    if (key.startsWith('transport:')) {
      const chatId = key.replace('transport:', '');
      setChatId(chatId);
    }
  },

  reset: () => set({
    messages: [],
    sessions: [],
    activeSession: 'transport:web',
    isGenerating: false,
    isLoadingHistory: false,
    authenticated: false,
    connectError: null,
    isConnecting: false,
    currentStreamingId: null,
  }),
}));

