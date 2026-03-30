import { useState } from 'react';
import { Calendar, Clock, Plus, Trash2, ChevronDown, ChevronRight, Loader2, Bot, User, Sparkles, Terminal, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { CronJob, CronJobPayload, CronLogEntry } from '../../lib/nanobotApi';

interface Props {
  jobs: CronJob[];
  logs: Record<string, CronLogEntry[]>;
  onAdd: (payload: CronJobPayload) => Promise<boolean>;
  onDelete: (jobId: string) => void;
  onFetchLogs: (jobId: string) => void;
}

export function DashboardCron({ jobs, logs, onAdd, onDelete, onFetchLogs }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    expr: '0 * * * *',
    tz: 'Asia/Shanghai',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.message) return;

    setSubmitting(true);
    try {
      const payload: CronJobPayload = {
        name: formData.name,
        schedule: { kind: 'cron', expr: formData.expr, tz: formData.tz },
        message: formData.message,
      };
      const success = await onAdd(payload);
      if (success) {
        setFormData({ name: '', expr: '0 * * * *', tz: 'Asia/Shanghai', message: '' });
        setShowAddForm(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpand = (jobId: string) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
      if (!logs[jobId]) onFetchLogs(jobId);
    }
    setExpandedJobs(newExpanded);
  };

  const handleDelete = (jobId: string, jobName: string) => {
    if (confirm(`确定删除定时任务 "${jobName}" 吗？`)) onDelete(jobId);
  };

  const getStatusIcon = (status?: string) => {
    if (status === 'ok') return <CheckCircle size={12} className="text-emerald-400" />;
    if (status === 'error') return <XCircle size={12} className="text-red-400" />;
    return <AlertCircle size={12} className="text-amber-400" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">定时任务</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          新建任务
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">任务名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Daily Report"
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Cron 表达式</label>
              <input
                type="text"
                value={formData.expr}
                onChange={e => setFormData(prev => ({ ...prev, expr: e.target.value }))}
                placeholder="0 * * * *"
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">时区</label>
            <input
              type="text"
              value={formData.tz}
              onChange={e => setFormData(prev => ({ ...prev, tz: e.target.value }))}
              placeholder="Asia/Shanghai"
              className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">执行消息</label>
            <textarea
              value={formData.message}
              onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="要发送给机器人的消息..."
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 resize-none"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 transition-colors"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              创建
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {jobs.map((job, idx) => {
          const isExpanded = expandedJobs.has(job.id);
          const jobLogs = logs[job.id] || [];
          const hasLogs = jobLogs.length > 0;

          return (
            <div
              key={idx}
              className={`rounded-xl border transition-all ${job.enabled ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5 opacity-60'}`}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleExpand(job.id)}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                    >
                      {isExpanded ? <ChevronDown size={16} className="text-white/50" /> : <ChevronRight size={16} className="text-white/50" />}
                    </button>
                    <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                      <Calendar size={16} className="text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{job.name}</span>
                        {job.enabled ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">运行中</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/40">已暂停</span>
                        )}
                      </div>
                      <span className="text-xs text-white/40 font-mono">{job.schedule.expr || job.schedule.kind}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {job.state.next_run_at && (
                        <div className="flex items-center gap-1.5 text-xs text-white/50">
                          <Clock size={12} />
                          <span>下次: {new Date(job.state.next_run_at).toLocaleString()}</span>
                        </div>
                      )}
                      {job.state.last_run_at && (
                        <div className="flex items-center justify-end gap-1.5 text-xs text-white/30 mt-0.5">
                          {getStatusIcon(job.state.last_status)}
                          <span>{new Date(job.state.last_run_at).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(job.id, job.name)}
                      className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-white/5 px-4 pb-4">
                  {hasLogs ? (
                    <ExecutionChain logs={jobLogs} />
                  ) : (
                    <div className="flex items-center justify-center py-8 text-white/40">
                      <Loader2 size={16} className="animate-spin mr-2" />
                      加载执行记录...
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {jobs.length === 0 && (
          <div className="text-center py-12 text-white/40">
            暂无定时任务
          </div>
        )}
      </div>
    </div>
  );
}

function ExecutionChain({ logs }: { logs: CronLogEntry[] }) {
  const requestGroups = groupLogsByRequest(logs);

  return (
    <div className="space-y-4 mt-4">
      {requestGroups.map((group, idx) => (
        <div key={idx} className="rounded-lg bg-white/5 border border-white/10 overflow-hidden">
          <div className="px-3 py-2 bg-white/5 border-b border-white/5 flex items-center gap-2">
            <Sparkles size={12} className="text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400">request_id: {group.requestId}</span>
          </div>
          <div className="p-3 space-y-2">
            {group.messages.map((msg, msgIdx) => (
              <LogMessage key={msgIdx} message={msg} />
            ))}
          </div>
        </div>
      ))}
      {requestGroups.length === 0 && (
        <div className="text-center py-4 text-white/30 text-sm">暂无执行记录</div>
      )}
    </div>
  );
}

function LogMessage({ message }: { message: CronLogEntry }) {
  const isSubagent = message.metadata?.subagent_task_id;
  const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;

  const getRoleIcon = () => {
    if (message.role === 'user') return <User size={12} className="text-blue-400" />;
    if (hasToolCalls) return <Bot size={12} className="text-violet-400" />;
    return <Terminal size={12} className="text-emerald-400" />;
  };

  const getRoleColor = () => {
    if (message.role === 'user') return 'border-blue-500/30';
    if (hasToolCalls || isSubagent) return 'border-violet-500/30';
    return 'border-emerald-500/30';
  };

  const time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : '';

  return (
    <div className={`flex items-start gap-3 p-2 rounded-lg border-l-2 ${getRoleColor()} bg-white/[0.02]`}>
      <div className="mt-0.5">{getRoleIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-white/40">{time}</span>
          <span className="text-[10px] font-medium text-white/60 uppercase">{message.role}</span>
          {message.name && <span className="text-[10px] text-white/40 font-mono">({message.name})</span>}
          {isSubagent && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
              {message.metadata?.subagent_label || 'Subagent'}
            </span>
          )}
        </div>
        <p className="text-xs text-white/70 break-all line-clamp-2">
          {message.content.slice(0, 200)}{message.content.length > 200 ? '...' : ''}
        </p>
        {hasToolCalls && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.tool_calls!.map((tc, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-mono">
                {tc.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function groupLogsByRequest(logs: CronLogEntry[]) {
  const groups: { requestId: string; messages: CronLogEntry[] }[] = [];
  let currentGroup: { requestId: string; messages: CronLogEntry[] } | null = null;

  for (const log of logs) {
    const requestId = log.metadata?.request_id || 'unknown';
    if (!currentGroup || currentGroup.requestId !== requestId) {
      if (currentGroup && currentGroup.messages.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = { requestId, messages: [log] };
    } else {
      currentGroup.messages.push(log);
    }
  }
  if (currentGroup && currentGroup.messages.length > 0) {
    groups.push(currentGroup);
  }

  return groups.reverse();
}