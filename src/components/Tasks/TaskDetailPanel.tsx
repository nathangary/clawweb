import { useState } from 'react';
import { X, Calendar, Clock, CheckCircle, XCircle, Activity, Trash2, FileText, GitBranch, Loader2 } from 'lucide-react';
import type { CronJob, CronLogEntry } from '../../lib/nanobotApi';
import { getTaskHealth, getStatusColor, getStatusLabel, cronToHuman } from './utils';
import { ExecutionTimeline } from './ExecutionTimeline';

interface Props {
  job: CronJob | null;
  logs: CronLogEntry[] | undefined;
  onFetchLogs: (jobId: string) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}

type TabId = 'overview' | 'timeline' | 'logs';

export function TaskDetailPanel({ job, logs, onFetchLogs, onClose, onDelete }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  if (!job) return null;

  const health = getTaskHealth(job);
  const statusColor = getStatusColor(health.status);
  const scheduleLabel = job.schedule.expr ? cronToHuman(job.schedule.expr) : job.schedule.kind;

  const tabs: { id: TabId; label: string; icon: typeof Activity }[] = [
    { id: 'overview', label: '概览', icon: Activity },
    { id: 'timeline', label: '时间线', icon: GitBranch },
    { id: 'logs', label: '日志', icon: FileText },
  ];

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === 'timeline' || tab === 'logs') {
      onFetchLogs(job.id);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[85vh] bg-[var(--pc-bg-surface)] rounded-2xl border border-pc-border shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 px-6 py-4 border-b border-pc-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${statusColor} ${health.status === 'active' ? 'animate-pulse' : ''}`} />
              <h3 className="text-sm font-semibold text-pc-text">{job.name}</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-[var(--pc-hover)] text-pc-text-muted hover:text-pc-text transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex border-b border-pc-border px-6">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-pc-text border-[var(--pc-accent)]'
                    : 'text-pc-text-muted hover:text-pc-text border-transparent'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <OverviewTab job={job} health={health} scheduleLabel={scheduleLabel} onDelete={onDelete} />
          )}
          {activeTab === 'timeline' && (
            <TimelineTab logs={logs} loading={!logs} />
          )}
          {activeTab === 'logs' && (
            <LogsTab logs={logs} loading={!logs} />
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ job, health, scheduleLabel, onDelete }: {
  job: CronJob;
  health: ReturnType<typeof getTaskHealth>;
  scheduleLabel: string;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-pc-text-secondary uppercase tracking-wider">基本信息</h4>
        <div className="space-y-2">
          <InfoRow label="任务 ID" value={job.id} mono />
          <InfoRow label="状态" value={getStatusLabel(health.status)} />
          <InfoRow label="调度规则" value={job.schedule.expr || scheduleLabel} mono />
          {health.nextRunIn && <InfoRow label="下次执行" value={health.nextRunIn} />}
          {health.lastRunAgo && <InfoRow label="上次执行" value={health.lastRunAgo} />}
          <InfoRow label="类型" value={job.delete_after_run ? '一次性任务' : '周期任务'} />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-medium text-pc-text-secondary uppercase tracking-wider">执行统计</h4>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={health.lastStatus === 'ok' ? CheckCircle : health.lastStatus === 'error' ? XCircle : Clock}
            label="上次状态"
            value={health.lastStatus === 'ok' ? '成功' : health.lastStatus === 'error' ? '失败' : '未执行'}
            color={health.lastStatus === 'ok' ? 'text-emerald-400' : health.lastStatus === 'error' ? 'text-red-400' : 'text-pc-text-muted'}
          />
          <StatCard
            icon={Calendar}
            label="调度类型"
            value={job.schedule.kind === 'cron' ? 'Cron' : job.schedule.kind === 'every' ? '间隔' : '一次性'}
            color="text-cyan-400"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-medium text-pc-text-secondary uppercase tracking-wider">操作</h4>
        <button
          onClick={() => { if (confirm(`确定删除任务 "${job.name}" 吗？`)) onDelete(job.id); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <Trash2 size={14} />
          删除任务
        </button>
      </div>
    </div>
  );
}

function TimelineTab({ logs, loading }: { logs: CronLogEntry[] | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 size={20} className="text-pc-text-faint animate-spin mb-2" />
        <p className="text-pc-text-muted text-xs">加载执行记录...</p>
      </div>
    );
  }
  return <ExecutionTimeline logs={logs || []} />;
}

function LogsTab({ logs, loading }: { logs: CronLogEntry[] | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 size={20} className="text-pc-text-faint animate-spin mb-2" />
        <p className="text-pc-text-muted text-xs">加载日志...</p>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FileText size={20} className="text-pc-text-faint mb-2" />
        <p className="text-pc-text-muted text-xs">暂无日志</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.slice().reverse().map((log, idx) => (
        <div key={idx} className="p-3 rounded-xl bg-[var(--pc-bg-base)] border border-pc-border">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              log.role === 'user' ? 'bg-blue-500/20 text-blue-400' :
              log.role === 'assistant' ? 'bg-violet-500/20 text-violet-400' :
              'bg-emerald-500/20 text-emerald-400'
            }`}>
              {log.role}
            </span>
            {log.timestamp && (
              <span className="text-[10px] text-pc-text-faint">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            )}
          </div>
          <pre className="text-[10px] text-pc-text-muted whitespace-pre-wrap break-words font-mono max-h-32 overflow-y-auto">
            {log.content.slice(0, 500)}
            {log.content.length > 500 ? '...' : ''}
          </pre>
        </div>
      ))}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-pc-text-muted">{label}</span>
      <span className={`text-xs text-pc-text-secondary ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: string; color: string }) {
  return (
    <div className="p-3 rounded-xl bg-[var(--pc-bg-base)] border border-pc-border">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={color} />
        <span className="text-[10px] text-pc-text-muted">{label}</span>
      </div>
      <div className={`text-sm font-medium ${color}`}>{value}</div>
    </div>
  );
}
