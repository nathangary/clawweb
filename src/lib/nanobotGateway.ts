import { genId } from './utils';

export interface NanobotInboundMessage {
  messageId: string;
  channel: string;
  chatId: string;
  senderId: string;
  content: string;
  sessionKey?: string;
  threadId?: string;
  media?: string[];
  attachments?: Array<{ type: string; url: string; localPath?: string }>;
  metadata?: Record<string, unknown>;
  ts?: string;
}

export interface NanobotMediaItem {
  type: string;
  source: string;
  url?: string;
  asset_id?: string;
  mime_type?: string;
}

export interface NanobotMultimodalResponse {
  format: string;
  content: string;
  media?: NanobotMediaItem[];
}

export interface NanobotOutboundEvent {
  eventId: string;
  eventType: 'progress' | 'tool_hint' | 'final' | 'error';
  channel: string;
  chatId: string;
  sessionKey: string;
  content: string;
  media?: string[] | NanobotMediaItem[];
  multimodalResponse?: NanobotMultimodalResponse;
  multimodal_response?: NanobotMultimodalResponse;
  metadata?: Record<string, unknown>;
  done: boolean;
  ts: string;
}

export type NanobotEventHandler = (event: NanobotOutboundEvent) => void;
export type NanobotStatusHandler = (status: NanobotStatus) => void;

export type NanobotStatus = 'disconnected' | 'connecting' | 'connected';

export class NanobotGatewayClient {
  private ws: WebSocket | null = null;
  private eventHandlers: NanobotEventHandler[] = [];
  private _onStatus: NanobotStatusHandler = () => {};
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private connected = false;
  private autoReconnect = true;
  private wsUrl: string;
  private authToken: string;
  private clientId: string;
  private chatId: string;
  private processedEventIds = new Set<string>();
  private cleanupProcessedIdsTimer: ReturnType<typeof setInterval> | null = null;

  constructor(wsUrl?: string, authToken?: string, clientId?: string, chatId?: string) {
    this.wsUrl = wsUrl || `ws://${window.location.hostname}:8787/ws`;
    this.authToken = authToken || '';
    this.clientId = clientId || 'webchat';
    this.chatId = chatId || `web-${Date.now()}`;
  }

  setCredentials(wsUrl: string, authToken?: string) {
    this.wsUrl = wsUrl;
    if (authToken !== undefined) this.authToken = authToken;
  }

  setChatId(chatId: string) {
    this.chatId = chatId;
  }

  onStatus(fn: NanobotStatusHandler) {
    this._onStatus = fn;
  }

  onEvent(fn: NanobotEventHandler) {
    if (this.eventHandlers.includes(fn)) {
      return () => { this.eventHandlers = this.eventHandlers.filter(h => h !== fn); };
    }
    this.eventHandlers.push(fn);
    return () => { this.eventHandlers = this.eventHandlers.filter(h => h !== fn); };
  }

  connect() {
    if (this.ws) return;
    this.autoReconnect = true;
    this._onStatus('connecting');
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this._onStatus('connected');
      this.bindSession();
    };

    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string);
        this.handleMessage(data);
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.connected = false;
      this._onStatus('disconnected');
      if (this.autoReconnect) this.scheduleReconnect();
    };

    this.ws.onerror = () => { 
      this._onStatus('disconnected');
    };
  }

  disconnect() {
    this.autoReconnect = false;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.cleanupProcessedIdsTimer) { clearInterval(this.cleanupProcessedIdsTimer); this.cleanupProcessedIdsTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.connected = false;
    this.processedEventIds.clear();
    this._onStatus('disconnected');
  }

  private handleMessage(data: NanobotOutboundEvent) {
    if (this.processedEventIds.has(data.eventId)) {
      return;
    }
    this.processedEventIds.add(data.eventId);
    for (const h of this.eventHandlers) {
      h(data);
    }
  }

  private bindSession() {
    const sessionKey = `transport:${this.chatId}`;
    this.sendRaw({
      type: 'bind',
      session_key: sessionKey,
      chat_id: this.chatId,
    });
  }

  send(message: string, attachments?: Array<{ mimeType: string; fileName: string; content: string }>) {
    const msg: Record<string, unknown> = {
      messageId: genId('msg'),
      channel: 'transport',
      chatId: this.chatId,
      senderId: this.clientId,
      content: message,
      ts: new Date().toISOString(),
    };

    if (attachments && attachments.length > 0) {
      msg.media = attachments.map(a => `data:${a.mimeType};base64,${a.content}`);
    }

    if (this.authToken) {
      msg.token = this.authToken;
    }

    this.sendRaw(msg);
  }

  sendToSession(sessionKey: string, message: string) {
    const msg: Record<string, unknown> = {
      messageId: genId('msg'),
      channel: 'transport',
      chatId: this.chatId,
      senderId: this.clientId,
      content: message,
      sessionKey,
      ts: new Date().toISOString(),
    };

    if (this.authToken) {
      msg.token = this.authToken;
    }

    this.sendRaw(msg);
  }

  bindToSession(sessionKey: string, chatId?: string) {
    const targetChatId = chatId || this.chatId;
    this.sendRaw({
      type: 'bind',
      session_key: sessionKey,
      chat_id: targetChatId,
    });
  }

  private sendRaw(data: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(data));
  }

  ack(eventId: string) {
    this.sendRaw({
      type: 'ack',
      event_id: eventId,
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const base = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    const jitter = Math.random() * base * 0.3;
    const delay = base + jitter;
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  get isConnected() { return this.connected; }

  get currentChatId() { return this.chatId; }
}
