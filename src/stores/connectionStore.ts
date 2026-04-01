import { create } from 'zustand';
import { NanobotGatewayClient, type NanobotEventHandler } from '../lib/nanobotGateway';
import { NanobotApiClient } from '../lib/nanobotApi';
import { setRulesApiClient } from '../lib/rules';
import { storeCredentials, clearCredentials } from '../lib/credentials';
import type { ConnectionStatus } from '../types';

interface ConnectionState {
  wsClient: NanobotGatewayClient | null;
  apiClient: NanobotApiClient | null;
  status: ConnectionStatus;
  gatewayUrl: string;
  token: string;
  clientId: string;
  isAuthenticated: boolean;

  connect: (url: string, token?: string, clientId?: string, eventHandler?: NanobotEventHandler) => void;
  disconnect: () => void;
  setClientId: (id: string) => void;
  getClient: () => NanobotGatewayClient | null;
  getApiClient: () => NanobotApiClient | null;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  wsClient: null,
  apiClient: null,
  status: 'disconnected',
  gatewayUrl: '',
  token: '',
  clientId: 'webchat',
  isAuthenticated: false,

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
      set({ status: s as ConnectionStatus });
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
      gatewayUrl: url,
      token: token || '',
      clientId: cid,
      isAuthenticated: true,
    });

    storeCredentials(url, token, cid);
  },

  disconnect: () => {
    const { wsClient } = get();
    if (wsClient) {
      wsClient.disconnect();
    }
    clearCredentials();
    setRulesApiClient(null);
    set({
      wsClient: null,
      apiClient: null,
      status: 'disconnected',
      gatewayUrl: '',
      token: '',
      isAuthenticated: false,
    });
  },

  setClientId: (id: string) => set({ clientId: id }),

  getClient: () => get().wsClient,
  getApiClient: () => get().apiClient,
}));
