export interface NanobotApiResponse<T = unknown> {
  request_id: string;
  applied: boolean;
  error: string | null;
  data: T;
}

export interface NanobotSession {
  key: string;
  created_at?: string;
  updated_at?: string;
  message_count?: number;
  messageCount?: number;
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

export interface NanobotMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  media?: string[];
  multimodal_response?: NanobotMultimodalResponse;
}

export interface NanobotHistoryItem {
  session_key: string;
  created_at: string;
  updated_at: string;
}

export interface NanobotSkill {
  name: string;
  source: 'workspace' | 'builtin';
  enabled: boolean;
}

export interface NanobotChannelStatus {
  status: 'connected' | 'disconnected' | 'error';
  last_seen?: string;
}

export interface CronJobSchedule {
  kind: 'at' | 'every' | 'cron';
  at_ms?: number | null;
  every_ms?: number | null;
  expr?: string | null;
  tz?: string | null;
}

export interface CronJobState {
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_status?: string;
}

export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  delete_after_run: boolean;
  schedule: CronJobSchedule;
  state: CronJobState;
}

export interface CronJobPayload {
  name: string;
  schedule: CronJobSchedule;
  message: string;
  deliver?: boolean;
  channel?: string;
  to?: string;
  delete_after_run?: boolean;
}

export interface CronLogEntry {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: string;
  name?: string;
  tool_calls?: Array<{
    name: string;
    input: Record<string, unknown>;
  }>;
  metadata?: {
    request_id?: string;
    subagent_task_id?: string;
    subagent_label?: string;
    subagent_status?: string;
  };
}

export interface RuleFlowNode {
  id: string;
  type: 'skill' | 'condition' | 'loop' | 'start' | 'end';
  skillId?: string;
  skillName?: string;
  label: string;
  condition?: string;
  loopConfig?: { maxIterations: number; condition: string };
}

export interface RuleFlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface RuleFlowGraph {
  nodes: RuleFlowNode[];
  edges: RuleFlowEdge[];
}

export interface RuleSkillRef {
  skillId: string;
  name: string;
  params: Record<string, unknown>;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'draft' | 'disabled';
  triggerType: 'manual' | 'cron' | 'webhook';
  triggerConfig?: string;
  runCount: number;
  successRate: number;
  lastRunAt?: string;
  createdAt: string;
  skills: RuleSkillRef[];
  flow: RuleFlowGraph;
  flowType: 'graph' | 'list';
  systemPrompt: string;
}

export interface AssetCategory {
  name: string;
  directory: string;
  scenarios: string[];
  allowed_exts: string[];
}

export interface AssetItem {
  id: string;
  name: string;
  original_name?: string;
  category: string;
  scene?: string;
  subject?: string;
  type?: string;
  version?: number;
  ext: string;
  mime_type?: string;
  size_bytes: number;
  checksum_sha256?: string;
  relative_path: string;
  download_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latencyMs?: number;
  lastChecked?: string;
}

export interface HealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  checkedAt: string;
}

export interface RulePayload {
  name: string;
  description: string;
  status?: 'active' | 'draft' | 'disabled';
  triggerType: 'manual' | 'cron' | 'webhook';
  triggerConfig?: string;
  skills: RuleSkillRef[];
  flow: RuleFlowGraph;
  flowType?: 'graph' | 'list';
  systemPrompt?: string;
}

export class ApiError extends Error {
  status: number;
  url: string;
  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
  }
}

const isDebug = () => {
  try { return localStorage.getItem('pinchchat:debug') === '1'; } catch { return false; }
};
const log = (...args: unknown[]) => { if (isDebug()) console.log('[NanoBot API]', ...args); };

export class NanobotApiClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl?: string, token?: string) {
    this.baseUrl = baseUrl || `http://${window.location.hostname}:18790/api`;
    this.token = token || '';
  }

  setCredentials(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl;
    if (token !== undefined) this.token = token;
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  private async request<T>(path: string, options: RequestInit = {}, retries = 2): Promise<NanobotApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const normalizedBase = this.baseUrl.replace(/\/$/, '');
    const url = `${normalizedBase}${normalizedPath}`;
    log('Request:', options.method || 'GET', url);

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
          signal: options.signal ?? AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          log('Error response:', response.status, errorText);
          throw new ApiError(`API error: ${response.status} ${response.statusText}`, response.status, url);
        }

        const data = await response.json();
        log('Response:', data);
        return data as NanobotApiResponse<T>;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < retries && lastError instanceof ApiError === false) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError ?? new Error('Unknown request error');
  }

  async getSessions(page = 1, pageSize = 50): Promise<NanobotApiResponse<{ sessions: NanobotSession[] }>> {
    return this.request<{ sessions: NanobotSession[] }>(
      `/v1/admin/sessions?page=${page}&page_size=${pageSize}`
    );
  }

  async getSessionDetail(sessionKey: string, page = 1, pageSize = 50, sort: 'asc' | 'desc' = 'asc'): Promise<NanobotApiResponse<{
    session_key: string;
    created_at: string;
    updated_at: string;
    message_count: number;
    messages: NanobotMessage[];
    page: number;
    page_size: number;
    total: number;
    sort: string;
  }>> {
    return this.request(`/v1/admin/sessions/${encodeURIComponent(sessionKey)}?page=${page}&page_size=${pageSize}&sort=${sort}`);
  }

  async getSessionHistory(sessionKey: string, page = 1, pageSize = 50, sort: 'asc' | 'desc' = 'asc'): Promise<NanobotApiResponse<{
    session_key: string;
    messages: NanobotMessage[];
    page: number;
    page_size: number;
    total: number;
    sort: string;
  }>> {
    return this.request(`/v1/admin/sessions/${encodeURIComponent(sessionKey)}?page=${page}&page_size=${pageSize}&sort=${sort}`);
  }

  async getHistory(page = 1, pageSize = 20, fromTs?: string, toTs?: string): Promise<NanobotApiResponse<{
    items: NanobotHistoryItem[];
    page: number;
    page_size: number;
    total: number;
  }>> {
    let url = `/v1/admin/history?page=${page}&page_size=${pageSize}`;
    if (fromTs) url += `&from_ts=${encodeURIComponent(fromTs)}`;
    if (toTs) url += `&to_ts=${encodeURIComponent(toTs)}`;
    return this.request(url);
  }

  async getSkills(): Promise<NanobotApiResponse<{ skills: NanobotSkill[] }>> {
    return this.request<{ skills: NanobotSkill[] }>('/v1/admin/skills');
  }

  async getSkillState(skillName: string): Promise<NanobotApiResponse<{ skill_name: string; enabled: boolean }>> {
    return this.request(`/v1/admin/skills/state?name=${encodeURIComponent(skillName)}`);
  }

  async setSkillState(skillName: string, enabled: boolean, persist = false): Promise<NanobotApiResponse<{ skill_name: string; enabled: boolean }>> {
    return this.request('/v1/admin/skills/state', {
      method: 'POST',
      body: JSON.stringify({ skill_name: skillName, enabled, persist }),
    });
  }

  async reloadConfig(): Promise<NanobotApiResponse<Record<string, never>>> {
    return this.request('/v1/admin/config/reload', { method: 'POST' });
  }

  async reloadToolHints(): Promise<NanobotApiResponse<Record<string, never>>> {
    return this.request('/v1/admin/tool-hints/reload', { method: 'POST' });
  }

  async getChannels(): Promise<NanobotApiResponse<{
    channels: Record<string, NanobotChannelStatus>;
    enabled_channels: string[];
  }>> {
    return this.request('/v1/admin/channels');
  }

  async getCronJobs(): Promise<NanobotApiResponse<{ jobs: CronJob[] }>> {
    return this.request('/v1/admin/cron/jobs');
  }

  async addCronJob(payload: CronJobPayload): Promise<NanobotApiResponse<{ job: CronJob }>> {
    return this.request('/v1/admin/cron/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteCronJob(jobId: string): Promise<NanobotApiResponse<{ job_id: string }>> {
    return this.request(`/v1/admin/cron/jobs?job_id=${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    });
  }

  async getCronJobLogs(jobId: string, limit = 50): Promise<NanobotApiResponse<{
    job_id: string;
    logs: CronLogEntry[];
  }>> {
    return this.request(`/v1/admin/cron/jobs/logs?job_id=${encodeURIComponent(jobId)}&limit=${limit}`);
  }

  async getRules(): Promise<NanobotApiResponse<{ rules: Rule[] }>> {
    return this.request('/v1/admin/rules');
  }

  async getRule(ruleId: string): Promise<NanobotApiResponse<{ rule: Rule }>> {
    return this.request(`/v1/admin/rules/${encodeURIComponent(ruleId)}`);
  }

  async createRule(payload: RulePayload): Promise<NanobotApiResponse<{ rule: Rule }>> {
    return this.request('/v1/admin/rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateRule(ruleId: string, payload: Partial<RulePayload>): Promise<NanobotApiResponse<{ rule: Rule }>> {
    return this.request(`/v1/admin/rules/${encodeURIComponent(ruleId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteRule(ruleId: string): Promise<NanobotApiResponse<{ rule_id: string }>> {
    return this.request(`/v1/admin/rules/${encodeURIComponent(ruleId)}`, {
      method: 'DELETE',
    });
  }

  async getRuleStats(): Promise<NanobotApiResponse<{
    total: number;
    active: number;
    draft: number;
    disabled: number;
    totalExecutions: number;
    successRate: number;
  }>> {
    return this.request('/v1/admin/rules/stats');
  }

  async getAssetCategories(): Promise<NanobotApiResponse<{ categories: AssetCategory[] }>> {
    return this.request('/v1/admin/assets/categories');
  }

  async getAssets(params: {
    category?: string;
    scene?: string;
    ext?: string;
    q?: string;
    from_ts?: string;
    to_ts?: string;
    page?: number;
    page_size?: number;
    sort?: 'asc' | 'desc';
  } = {}): Promise<NanobotApiResponse<{
    items: AssetItem[];
    page: number;
    page_size: number;
    total: number;
    sort: string;
  }>> {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    if (params.scene) qs.set('scene', params.scene);
    if (params.ext) qs.set('ext', params.ext);
    if (params.q) qs.set('q', params.q);
    if (params.from_ts) qs.set('from_ts', params.from_ts);
    if (params.to_ts) qs.set('to_ts', params.to_ts);
    qs.set('page', String(params.page ?? 1));
    qs.set('page_size', String(params.page_size ?? 20));
    qs.set('sort', params.sort ?? 'desc');
    return this.request(`/v1/admin/assets?${qs.toString()}`);
  }

  async downloadAsset(assetId: string): Promise<Blob> {
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const url = `${this.baseUrl.replace(/\/$/, '')}/v1/admin/assets/${encodeURIComponent(assetId)}/download`;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new ApiError(`Download failed: ${response.status}`, response.status, url);
    return response.blob();
  }

  async deleteAsset(assetId: string): Promise<NanobotApiResponse<{ asset_id: string }>> {
    return this.request(`/v1/admin/assets/${encodeURIComponent(assetId)}`, { method: 'DELETE' });
  }

  async healthCheck(): Promise<HealthReport> {
    const startTime = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/health`, { method: 'GET' });
      const latency = Date.now() - startTime;
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.services) {
          return {
            overall: data.overall || 'healthy',
            services: data.services.map((s: { name: string; status: string }) => ({
              name: s.name,
              status: s.status as ServiceHealth['status'],
              latencyMs: latency,
              lastChecked: new Date().toISOString(),
            })),
            checkedAt: new Date().toISOString(),
          };
        }
        return {
          overall: 'healthy',
          services: [
            { name: 'API服务', status: 'healthy', latencyMs: latency, lastChecked: new Date().toISOString() },
            { name: '数据库', status: 'healthy', lastChecked: new Date().toISOString() },
            { name: 'Agent引擎', status: 'healthy', lastChecked: new Date().toISOString() },
          ],
          checkedAt: new Date().toISOString(),
        };
      }
    } catch {
      // fall through
    }
    return {
      overall: 'unhealthy',
      services: [
        { name: 'API服务', status: 'unhealthy', lastChecked: new Date().toISOString() },
        { name: '数据库', status: 'unknown', lastChecked: new Date().toISOString() },
        { name: 'Agent引擎', status: 'unknown', lastChecked: new Date().toISOString() },
      ],
      checkedAt: new Date().toISOString(),
    };
  }
}
