import { ChevronRight, Trash2, Calendar, Clock, CheckCircle, XCircle, Loader2, Activity } from 'lucide-react';
import type { CronJob } from '../../lib/nanobotApi';
import { getTaskHealth, getStatusColor, getStatusLabel, cronToHuman } from './utils';

interface Props {
  job: CronJob;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function TaskRow({ job, isSelected, onSelect, onDelete }: Props) {
  const health = getTaskHealth(job);
  const statusColor = getStatusColor(health.status);
  const statusLabel = getStatusLabel(health.status);
  const scheduleLabel = job.schedule.expr ? cronToHuman(job.schedule.expr) : job.schedule.kind;

  return (
    <div
      className={`group rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'bg-[var(--pc-hover)] border-pc-border'
          : 'bg-[var(--pc-bg-surface)] border-pc-border hover:border-[var(--pc-accent-dim)] hover:bg-[var(--pc-hover)]'
      }`}
      onClick={onSelect}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1.5 relative">
            <div className={`w-2.5 h-2.5 rounded-full ${statusColor} ${
              health.status === 'active' || health.status === 'running' ? 'animate-pulse' : ''
            }`} />
            {health.status === 'failing' && (
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-red-400 animate-ping opacity-75" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-pc-text truncate">{job.name}</span>
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${
                  health.status === 'failing' ? 'bg-red-500/10 text-red-400' :
                  health.status === 'upcoming' ? 'bg-amber-500/10 text-amber-400' :
                  health.status === 'paused' ? 'bg-[var(--pc-hover)] text-pc-text-muted' :
                  'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {statusLabel}
                </span>
              </div>
              <ChevronRight size={16} className={`shrink-0 transition-transform ${isSelected ? 'rotate-90' : ''} text-pc-text-faint`} />
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-pc-text-muted">
              {/* 调度规则 */}
              <span className="flex items-center gap-1 font-mono">
                <Calendar size={12} />
                {job.schedule.expr || scheduleLabel}
              </span>

              {/* 下次执行 */}
              {health.nextRunIn && (
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {health.nextRunIn}
                </span>
              )}

              {/* 上次执行 */}
              {health.lastRunAgo && (
                <span className="flex items-center gap-1">
                  {health.lastStatus === 'ok' ? (
                    <CheckCircle size={12} className="text-emerald-400" />
                  ) : health.lastStatus === 'error' ? (
                    <XCircle size={12} className="text-red-400" />
                  ) : (
                    <Loader2 size={12} className="animate-spin" />
                  )}
                  {health.lastRunAgo}
                </span>
              )}

              {/* 运行次数 */}
              {health.runCount > 0 && (
                <span className="flex items-center gap-1 text-cyan-400">
                  <Activity size={12} />
                  {health.runCount}次
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end mt-3 pt-3 border-t border-pc-border opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-[var(--pc-hover)] text-pc-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={12} />
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
