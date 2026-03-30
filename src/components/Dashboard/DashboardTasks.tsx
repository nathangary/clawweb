import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Loader2, Clock, CheckCircle, XCircle, Sparkles, GripVertical } from 'lucide-react';
import type { CronJob, CronJobPayload, CronLogEntry } from '../../lib/nanobotApi';

interface Props {
  jobs: CronJob[];
  logs: Record<string, CronLogEntry[]>;
  onAdd: (payload: CronJobPayload) => Promise<boolean>;
  onDelete: (jobId: string) => void;
  onFetchLogs: (jobId: string) => void;
}

interface TaskCard {
  id: string;
  name: string;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  nextRun?: string;
  lastRun?: string;
  lastStatus?: string;
  logs?: CronLogEntry[];
}

type ColumnId = 'todo' | 'in_progress' | 'done' | 'blocked';

export function DashboardTasks({ jobs, logs, onAdd, onDelete, onFetchLogs }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    expr: '0 * * * *',
    tz: 'Asia/Shanghai',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  const tasks: TaskCard[] = jobs.map(job => {
    let status: 'todo' | 'in_progress' | 'done' | 'blocked' = 'todo';
    if (!job.enabled) status = 'blocked';
    else if (job.state.last_status === 'ok') status = 'done';
    else if (job.state.next_run_at && Date.now() < new Date(job.state.next_run_at).getTime() + 300000) status = 'in_progress';

    return {
      id: job.id,
      name: job.name,
      status,
      nextRun: job.state.next_run_at || undefined,
      lastRun: job.state.last_run_at || undefined,
      lastStatus: job.state.last_status,
      logs: logs[job.id],
    };
  });

  const columns: { id: ColumnId; title: string; color: string }[] = [
    { id: 'todo', title: '待办', color: 'from-slate-500 to-slate-600' },
    { id: 'in_progress', title: '进行中', color: 'from-cyan-500 to-blue-500' },
    { id: 'done', title: '已完成', color: 'from-emerald-500 to-teal-500' },
    { id: 'blocked', title: '阻塞', color: 'from-red-500 to-orange-500' },
  ];

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
    if (newExpanded.has(jobId)) newExpanded.delete(jobId);
    else {
      newExpanded.add(jobId);
      if (!logs[jobId]) onFetchLogs(jobId);
    }
    setExpandedJobs(newExpanded);
  };

  const handleDelete = (jobId: string, jobName: string) => {
    if (confirm(`确定删除任务 "${jobName}" 吗？`)) onDelete(jobId);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white">目标/任务</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:opacity-90"
        >
          <Plus size={14} />
          新建任务
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
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
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm text-white/50 hover:text-white">取消</button>
            <button type="submit" disabled={submitting} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-cyan-500 text-white disabled:opacity-50">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              创建
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden">
        {columns.map(col => (
          <div key={col.id} className="flex flex-col min-h-0">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl bg-gradient-to-r ${col.color}`}>
              <span className="text-sm font-medium text-white">{col.title}</span>
              <span className="text-xs text-white/60 bg-white/20 px-2 py-0.5 rounded-full">
                {tasks.filter(t => t.status === col.id).length}
              </span>
            </div>
            <div className="flex-1 p-2 bg-white/5 border-x border-b border-white/10 overflow-y-auto space-y-2">
              {tasks.filter(t => t.status === col.id).map(task => (
                <TaskCardComponent
                  key={task.id}
                  task={task}
                  expanded={expandedJobs.has(task.id)}
                  onToggle={() => toggleExpand(task.id)}
                  onDelete={() => handleDelete(task.id, task.name)}
                />
              ))}
              {col.id === 'todo' && tasks.filter(t => t.status === col.id).length === 0 && (
                <div className="text-center py-8 text-white/30 text-sm">暂无任务</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskCardComponent({ task, expanded, onToggle, onDelete }: { task: TaskCard; expanded: boolean; onToggle: () => void; onDelete: () => void }) {
  const getStatusIcon = () => {
    if (task.lastStatus === 'ok') return <CheckCircle size={12} className="text-emerald-400" />;
    if (task.lastStatus === 'error') return <XCircle size={12} className="text-red-400" />;
    return <Clock size={12} className="text-amber-400" />;
  };

  return (
    <div className="rounded-lg bg-white/5 border border-white/10 overflow-hidden">
      <div className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical size={14} className="text-white/20 mt-1 cursor-grab" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white truncate">{task.name}</span>
              <button onClick={onDelete} className="p-1 text-white/30 hover:text-red-400">
                <Trash2 size={12} />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
              {task.nextRun && (
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(task.nextRun).toLocaleString()}
                </span>
              )}
              {task.lastRun && (
                <span className="flex items-center gap-1">
                  {getStatusIcon()}
                  {new Date(task.lastRun).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-white/40 hover:text-white/60 py-1 rounded hover:bg-white/5"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {expanded ? '收起详情' : '查看详情'}
        </button>
      </div>
      {expanded && task.logs && (
        <div className="border-t border-white/5 p-2 max-h-48 overflow-y-auto">
          <ExecutionChain logs={task.logs} />
        </div>
      )}
    </div>
  );
}

function ExecutionChain({ logs }: { logs: CronLogEntry[] }) {
  const requestGroups = groupLogsByRequest(logs);

  return (
    <div className="space-y-2">
      {requestGroups.map((group, idx) => (
        <div key={idx} className="rounded bg-white/[0.02] p-2 border border-white/5">
          <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-white/5">
            <Sparkles size={10} className="text-cyan-400" />
            <span className="text-[10px] font-mono text-cyan-400">{group.requestId}</span>
          </div>
          <div className="space-y-1">
            {group.messages.slice(0, 6).map((msg, i) => {
              const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;
              const isSubagent = msg.metadata?.subagent_task_id;
              return (
                <div key={i} className="flex items-start gap-2 text-[10px]">
                  <span className={`mt-0.5 ${msg.role === 'user' ? 'text-blue-400' : hasToolCalls || isSubagent ? 'text-violet-400' : 'text-emerald-400'}`}>
                    {msg.role === 'user' ? 'U' : hasToolCalls ? 'A' : 'T'}
                  </span>
                  <span className="text-white/60 truncate flex-1">
                    {msg.content.slice(0, 50)}{msg.content.length > 50 ? '...' : ''}
                  </span>
                </div>
              );
            })}
            {group.messages.length > 6 && (
              <div className="text-[10px] text-white/30 text-center">+{group.messages.length - 6} 更多</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupLogsByRequest(logs: CronLogEntry[]) {
  const groups: { requestId: string; messages: CronLogEntry[] }[] = [];
  let currentGroup: { requestId: string; messages: CronLogEntry[] } | null = null;

  for (const log of logs) {
    const requestId = log.metadata?.request_id || 'unknown';
    if (!currentGroup || currentGroup.requestId !== requestId) {
      if (currentGroup && currentGroup.messages.length > 0) groups.push(currentGroup);
      currentGroup = { requestId, messages: [log] };
    } else {
      currentGroup.messages.push(log);
    }
  }
  if (currentGroup && currentGroup.messages.length > 0) groups.push(currentGroup);
  return groups.reverse();
}