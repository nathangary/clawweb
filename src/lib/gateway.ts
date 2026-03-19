import { genId } from './utils';
import type { DeviceIdentity } from './deviceIdentity';
import type { AuthMode } from './credentials';

const isDebug = () => {
  try { return localStorage.getItem('pinchchat:debug') === '1'; } catch { return false; }
};
const log = (...args: unknown[]) => { if (isDebug()) console.log('[GW-Clawbot]', ...args); };

export type JsonPayload = Record<string, unknown>;

export type GatewayEventHandler = (event: string, payload: JsonPayload) => void;
export type GatewayResponseHandler = (id: string, ok: boolean, payload: JsonPayload) => void;

export type GatewayStatus = 'disconnected' | 'connecting' | 'connected' | 'pairing';

export class GatewayClient {
  private ws: WebSocket | null = null;
  private eventHandlers: GatewayEventHandler[] = [];
  private _onStatus: (s: GatewayStatus) => void = () => {};
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private connected = false;
  private autoReconnect = true;

  private wsUrl: string;
  
  private currentRunId: string | null = null;
  private currentText = '';
  private readonly fixedSessionKey = 'agent:main:main';
  private localHistory: any[] = [];

  constructor(wsUrl?: string, _authToken?: string, _authMode?: AuthMode, _clientId?: string) {
    this.wsUrl = wsUrl || `ws://${window.location.hostname}:8787/ws`;
  }

  setCredentials(wsUrl: string, _authToken: string, _authMode?: AuthMode) {
    this.wsUrl = wsUrl;
  }

  setDeviceIdentity(_identity: DeviceIdentity) {
  }

  onStatus(fn: (s: GatewayStatus) => void) {
    this._onStatus = fn;
  }

  onEvent(fn: GatewayEventHandler) {
    this.eventHandlers.push(fn);
    return () => { this.eventHandlers = this.eventHandlers.filter(h => h !== fn); };
  }

  connect() {
    if (this.ws) return;
    this.autoReconnect = true;
    this._onStatus('connecting');
    
    if (this.wsUrl.includes(':18789')) {
      this.wsUrl = this.wsUrl.replace(':18789', ':8787/ws');
    }

    log('Connecting to', this.wsUrl);
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      log('WS open');
      this.connected = true;
      this.reconnectAttempts = 0;
      this._onStatus('connected');
    };

    this.ws.onmessage = (ev) => {
      let data: any;
      try { data = JSON.parse(ev.data as string); } catch { log('parse error', ev.data); return; }
      log('Received:', data);

      if (data.eventId) {
        this.sendAck(data.eventId);
      }

      this.handleClawbotMessage(data);
    };

    this.ws.onclose = (ev) => {
      log('WS close:', ev.code, ev.reason);
      this.ws = null;
      this.connected = false;
      this._onStatus('disconnected');
      if (this.autoReconnect) this.scheduleReconnect();
    };

    this.ws.onerror = (e) => { log('WS error', e); };
  }

  private sendAck(eventId: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const ack = {
      type: "ack",
      eventId: eventId
    };
    this.ws.send(JSON.stringify(ack));
  }

  private handleClawbotMessage(data: any) {
    if (!this.currentRunId) {
      this.currentRunId = genId('run');
      this.currentText = '';
    }

    if (data.content) {
      this.currentText += data.content;
      this.emitChatEvent({
        state: 'delta',
        runId: this.currentRunId,
        sessionKey: this.fixedSessionKey,
        message: {
          text: this.currentText
        }
      });
    }

    if (data.eventType === 'final' || data.done) {
      this.emitChatEvent({
        state: 'final',
        runId: this.currentRunId,
        sessionKey: this.fixedSessionKey,
        message: {
           text: ''
        }
      });

      if (this.currentText) {
        this.localHistory.push({
          id: this.currentRunId,
          role: 'assistant',
          content: this.currentText,
          timestamp: Date.now()
        });
      }

      this.currentRunId = null;
      this.currentText = '';
    }
  }

  private emitChatEvent(payload: JsonPayload) {
    for (const h of this.eventHandlers) h('chat', payload);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const base = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    const delay = base + (Math.random() * base * 0.3);
    this.reconnectAttempts++;
    log(`reconnecting in ${Math.round(delay)}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  disconnect() {
    this.autoReconnect = false;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.connected = false;
    this._onStatus('disconnected');
  }

  request(_id: string, method: string, params: JsonPayload): Promise<JsonPayload> {
    log('RPC Request:', method, params);

    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const result = await this.handleRpc(method, params);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      }, 10);
    });
  }

  private async handleRpc(method: string, params: JsonPayload): Promise<JsonPayload> {
    switch (method) {
      case 'sessions.list':
        return {
          sessions: [{
            key: this.fixedSessionKey,
            label: 'Clawbot Agent',
            agentId: 'main',
            updatedAt: Date.now(),
            model: 'clawbot-v1'
          }]
        };

      case 'chat.history':
        return { messages: [...this.localHistory] };

      case 'agent.identity.get':
        return {
          name: 'Clawbot',
          agentId: 'main',
          emoji: '🤖'
        };

      case 'chat.send':
        await this.sendToClawbot(params);
        return { success: true };

      case 'chat.abort':
        return { success: true };

      case 'sessions.create':
      case 'sessions.patch':
      case 'sessions.delete':
        return { key: this.fixedSessionKey };

      default:
        console.warn('Unknown method mocked:', method);
        return {};
    }
  }

  private async sendToClawbot(params: JsonPayload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('not connected');
    }

    const text = params.message as string;
    
    this.localHistory.push({
      id: genId('msg'),
      role: 'user',
      content: text,
      timestamp: Date.now()
    });

    const msg = {
      messageId: genId('msg'),
      channel: 'transport',
      chatId: 'main',
      senderId: 'user',
      content: text,
      sessionKey: this.fixedSessionKey
    };

    this.ws.send(JSON.stringify(msg));
  }

  async send(method: string, params: JsonPayload): Promise<JsonPayload> {
    const id = genId('req');
    return this.request(id, method, params);
  }

  get isConnected() { return this.connected; }
}
