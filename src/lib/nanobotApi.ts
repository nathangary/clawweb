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

export interface NanobotMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
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

const isDebug = () => {
  try { return localStorage.getItem('pinchchat:debug') === '1'; } catch { return false; }
};
const log = (...args: unknown[]) => { if (isDebug()) console.log('[NanoBot API]', ...args); };

export class NanobotApiClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl?: string, token?: string) {
    this.baseUrl = baseUrl || `http://${window.location.hostname}:18790`;
    this.token = token || '';
  }

  setCredentials(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl;
    if (token !== undefined) this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<NanobotApiResponse<T>> {
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

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      log('Error response:', response.status, errorText);
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    log('Response:', data);
    return data as NanobotApiResponse<T>;
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
    return this.request(`/v1/admin/sessions/${encodeURIComponent(sessionKey)}/history?page=${page}&page_size=${pageSize}&sort=${sort}`);
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

  healthCheck(): Promise<boolean> {
    return fetch(`${this.baseUrl}/health`, { method: 'GET' })
      .then(r => r.ok)
      .catch(() => false);
  }
}
