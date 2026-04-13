import type { CronJob } from '../../lib/nanobotApi';

export type TaskStatus = 'active' | 'paused' | 'failing' | 'upcoming' | 'running';

export interface TaskHealth {
  status: TaskStatus;
  nextRunIn: string | null;
  nextRunMs: number | null;
  lastRunAgo: string | null;
  lastStatus: string | null;
  enabled: boolean;
  runCount: number;
}

export type FilterType = 'all' | 'active' | 'paused' | 'failing';
export type SortType = 'nextRun' | 'name' | 'status';

export function getTaskHealth(job: CronJob): TaskHealth {
  const now = Date.now();
  const nextRunMs = job.state.next_run_at ? new Date(job.state.next_run_at).getTime() - now : null;
  const lastRunMs = job.state.last_run_at ? now - new Date(job.state.last_run_at).getTime() : null;

  let status: TaskStatus = 'paused';
  if (!job.enabled) {
    status = 'paused';
  } else if (job.state.last_status === 'error') {
    status = 'failing';
  } else if (nextRunMs !== null && nextRunMs < 0) {
    status = 'running';
  } else if (nextRunMs !== null && nextRunMs < 5 * 60 * 1000) {
    status = 'upcoming';
  } else {
    status = 'active';
  }

  return {
    status,
    nextRunIn: nextRunMs !== null ? formatDuration(nextRunMs) : null,
    nextRunMs,
    lastRunAgo: lastRunMs !== null ? formatAgo(lastRunMs) : null,
    lastStatus: job.state.last_status ?? null,
    enabled: job.enabled,
    runCount: job.state.run_count ?? 0,
  };
}

export function formatDuration(ms: number): string {
  if (ms < 0) return '执行中';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function formatAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h前`;
  const days = Math.floor(hours / 24);
  return `${days}d前`;
}

export function cronToHuman(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return '每分钟';
  }
  if (hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return minute === '0' ? '每小时整点' : `每小时第${minute}分钟`;
  }
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `每天 ${hour}:${minute.padStart(2, '0')}`;
  }
  if (month === '*' && dayOfWeek === '*') {
    return `每月${dayOfMonth === '*' ? '' : dayOfMonth + '日'} ${hour}:${minute.padStart(2, '0')}`;
  }
  if (dayOfMonth === '*' && month === '*') {
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dayName = dayOfWeek !== '*' ? dayNames[parseInt(dayOfWeek)] : '';
    return `${dayName || '每天'} ${hour}:${minute.padStart(2, '0')}`;
  }

  return expr;
}

export function filterJobs(jobs: CronJob[], filter: FilterType, search: string): CronJob[] {
  let filtered = jobs;

  switch (filter) {
    case 'active':
      filtered = jobs.filter(j => j.enabled);
      break;
    case 'paused':
      filtered = jobs.filter(j => !j.enabled);
      break;
    case 'failing':
      filtered = jobs.filter(j => j.enabled && j.state.last_status === 'error');
      break;
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(j => j.name.toLowerCase().includes(q));
  }

  return filtered;
}

export function sortJobs(jobs: CronJob[], sortBy: SortType): CronJob[] {
  return [...jobs].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'status': {
        const statusOrder = { failing: 0, running: 1, upcoming: 2, active: 3, paused: 4 };
        const aStatus = getTaskHealth(a).status;
        const bStatus = getTaskHealth(b).status;
        return (statusOrder[aStatus] ?? 5) - (statusOrder[bStatus] ?? 5);
      }
      case 'nextRun':
      default: {
        const aTime = a.state.next_run_at ? new Date(a.state.next_run_at).getTime() : Infinity;
        const bTime = b.state.next_run_at ? new Date(b.state.next_run_at).getTime() : Infinity;
        return aTime - bTime;
      }
    }
  });
}

export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'active': return 'bg-emerald-400';
    case 'paused': return 'bg-slate-500';
    case 'failing': return 'bg-red-400';
    case 'upcoming': return 'bg-amber-400';
    case 'running': return 'bg-cyan-400';
  }
}

export function getStatusLabel(status: TaskStatus): string {
  switch (status) {
    case 'active': return '活跃';
    case 'paused': return '已暂停';
    case 'failing': return '失败';
    case 'upcoming': return '即将执行';
    case 'running': return '执行中';
  }
}
