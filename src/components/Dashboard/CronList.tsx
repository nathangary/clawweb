import { Clock, Calendar, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { CronJob } from '../../hooks/useDashboard';

interface Props {
  jobs: CronJob[];
}

export function CronList({ jobs }: Props) {
  if (jobs.length === 0) {
    return (
      <p className="text-sm text-pc-text-muted text-center py-4">
        No cron jobs configured
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map(job => (
        <div
          key={job.id}
          className={`p-3 rounded-lg bg-[var(--pc-bg-surface)] border border-pc-border ${
            job.enabled ? '' : 'opacity-60'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-[var(--pc-hover)]">
              <Calendar size={14} className="text-pc-text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-pc-text truncate">{job.name}</p>
                {job.enabled ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--pc-hover)] text-pc-text-muted">
                    Paused
                  </span>
                )}
              </div>
              <p className="text-xs text-pc-text-muted font-mono mt-0.5">
                {job.schedule.expr || `${job.schedule.kind}`}
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-pc-text-faint">
                {job.state.next_run_at && (
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    Next: {new Date(job.state.next_run_at).toLocaleString()}
                  </span>
                )}
                {job.state.last_run_at && (
                  <span className="flex items-center gap-1">
                    {job.state.last_status === 'success' ? (
                      <CheckCircle size={10} className="text-emerald-400" />
                    ) : job.state.last_status === 'failed' ? (
                      <XCircle size={10} className="text-red-400" />
                    ) : (
                      <Loader2 size={10} className="animate-spin" />
                    )}
                    {job.state.last_run_at ? new Date(job.state.last_run_at).toLocaleString() : '-'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
