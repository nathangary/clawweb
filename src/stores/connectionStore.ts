import { create } from 'zustand';
import { NanobotGatewayClient, type NanobotEventHandler } from '../lib/nanobotGateway';
import { NanobotApiClient } from '../lib/nanobotApi';
import { setRulesApiClient } from '../lib/rules';
import { storeCredentials, clearCredentials } from '../lib/credentials';
import type { ConnectionStatus } from '../types';

const RECONNECT_DEBOUNCE_MS = 3000;

interface ConnectionState {
  wsClient: NanobotGatewayClient | null;
  apiClient: NanobotApiClient | null;
  status: ConnectionStatus;
  effectiveStatus: ConnectionStatus;
  gatewayUrl: string;
  token: string;
  clientId: string;
  isAuthenticated: boolean;
  wasConnected: boolean;

  connect: (url: string, token?: string, clientId?: string, eventHandler?: NanobotEventHandler) => void;
  disconnect: () => void;
  setClientId: (id: string) => void;
  getClient: () => NanobotGatewayClient | null;
  getApiClient: () => NanobotApiClient | null;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleEffectiveStatus(status: ConnectionStatus, set: (partial: Partial<ConnectionState>) => void, get: () => ConnectionState) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (status === 'disconnected') {
    const state = get();
    if (state.wasConnected) {
      set({ effectiveStatus: 'connecting' });
      debounceTimer = setTimeout(() => {
        const current = get();
        if (current.status === 'disconnected') {
          set({ effectiveStatus: 'disconnected' });
        }
      }, RECONNECT_DEBOUNCE_MS);
      return;
    }
    set({ effectiveStatus: 'disconnected' });
    return;
  }

  if (status === 'connected') {
    set({ effectiveStatus: 'connected', wasConnected: true });
    return;
  }

  if (status === 'connecting') {
    const state = get();
    if (state.wasConnected) {
      set({ effectiveStatus: 'connecting' });
    } else {
      set({ effectiveStatus: 'connecting' });
    }
    return;
  }

  set({ effectiveStatus: status });
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  wsClient: null,
  apiClient: null,
  status: 'disconnected',
  effectiveStatus: 'disconnected',
  gatewayUrl: '',
  token: '',
  clientId: 'webchat',
  isAuthenticated: false,
  wasConnected: false,

  connect: (url: string, token?: string, clientId?: string, eventHandler?: NanobotEventHandler) => {
    if (!url || (!url.startsWith('ws://') && !url.startsWith('wss://'))) {
      console.error('[Connection] Invalid URL:', url);
      return;
    }

    const { wsClient: existingWs, apiClient: existingApi } = get();

    if (existingWs) {
      existingWs.disconnect();
    }

    const cid = clientId || 'webchat';
    const apiUrl = import.meta.env.DEV ? '/api' : `http://${new URL(url).hostname}:18790/api`;

    let api = existingApi;
    if (!api) {
      api = new NanobotApiClient(apiUrl, token);
    } else {
      api.setCredentials(apiUrl, token);
    }

    const ws = new NanobotGatewayClient(url, token, cid);

    ws.onStatus((s) => {
      const newStatus = s as ConnectionStatus;
      set({ status: newStatus });
      scheduleEffectiveStatus(newStatus, set, get);
    });

    if (eventHandler) {
      ws.onEvent(eventHandler);
    }

    ws.connect();

    setRulesApiClient(api);

    set({
      wsClient: ws,
      apiClient: api,
      status: 'connecting',
      effectiveStatus: 'connecting',
      gatewayUrl: url,
      token: token || '',
      clientId: cid,
      isAuthenticated: true,
    });

    storeCredentials(url, token, cid);
  },

  disconnect: () => {
    const { wsClient } = get();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (wsClient) {
      wsClient.disconnect();
    }
    clearCredentials();
    setRulesApiClient(null);
    set({
      wsClient: null,
      apiClient: null,
      status: 'disconnected',
      effectiveStatus: 'disconnected',
      gatewayUrl: '',
      token: '',
      isAuthenticated: false,
      wasConnected: false,
    });
  },

  setClientId: (id: string) => set({ clientId: id }),

  getClient: () => get().wsClient,
  getApiClient: () => get().apiClient,
}));
