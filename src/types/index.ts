export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  blocks: MessageBlock[];
  isStreaming?: boolean;
  runId?: string;
  isSystemEvent?: boolean;
  metadata?: Record<string, unknown>;
  multimodalResponse?: MultimodalResponse;
  sendStatus?: 'sending' | 'sent' | 'error';
  streamStartedAt?: number;
  generationTimeMs?: number;
  isArchived?: boolean;
  isCompactionSeparator?: boolean;
}

export type MessageBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown>; id?: string }
  | { type: 'tool_result'; content: string; toolUseId?: string; name?: string }
  | { type: 'image'; mediaType: string; data?: string; url?: string };

export interface MultimodalMedia {
  type: string;
  source: string;
  url?: string;
  asset_id?: string;
  mime_type?: string;
}

export interface MultimodalResponse {
  format: string;
  content: string;
  media?: MultimodalMedia[];
}

export interface Session {
  key: string;
  label?: string;
  messageCount?: number;
  isActive?: boolean;
  hasUnread?: boolean;
  unreadCount?: number;
  totalTokens?: number;
  contextTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  channel?: string;
  kind?: string;
  model?: string;
  agentId?: string;
  updatedAt?: number;
  lastMessagePreview?: string;
}

export interface AgentIdentity {
  name?: string;
  emoji?: string;
  avatar?: string;
  agentId?: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'pairing';

export interface GatewayState {
  status: ConnectionStatus;
  sessions: Session[];
  activeSession: string;
  messages: ChatMessage[];
  isGenerating: boolean;
}
