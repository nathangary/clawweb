import { useState } from 'react';
import { Clock, Calendar, CheckCircle, XCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import type { CronJob, CronJobPayload } from '../../lib/nanobotApi';

interface Props {
  jobs: CronJob[];
  onAdd: (payload: CronJobPayload) => Promise<boolean>;
  onDelete: (jobId: string) => void;
}

export function CronList({ jobs, onAdd, onDelete }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    expr: '0 * * * *',
    tz: 'Asia/Shanghai',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.message) {
      return;
    }

    setSubmitting(true);
    try {
      const payload: CronJobPayload = {
        name: formData.name,
        schedule: {
          kind: 'cron',
          expr: formData.expr || '0 * * * *',
          tz: formData.tz || 'Asia/Shanghai',
        },
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

  const handleDelete = async (jobId: string, jobName: string) => {
    if (confirm(`Delete cron job "${jobName}"?`)) {
      onDelete(jobId);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--pc-accent)] text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="p-3 rounded-lg bg-[var(--pc-bg-surface)] border border-pc-border space-y-3">
          <div>
            <label className="block text-xs text-pc-text-muted mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Daily reminder"
              className="w-full px-2 py-1.5 text-sm rounded-lg bg-[var(--pc-bg-base)] border border-pc-border text-pc-text placeholder-pc-text-faint focus:outline-none focus:border-pc-accent"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-pc-text-muted mb-1">Cron Expression</label>
              <input
                type="text"
                value={formData.expr}
                onChange={e => setFormData(prev => ({ ...prev, expr: e.target.value }))}
                placeholder="0 * * * *"
                className="w-full px-2 py-1.5 text-sm rounded-lg bg-[var(--pc-bg-base)] border border-pc-border text-pc-text font-mono placeholder-pc-text-faint focus:outline-none focus:border-pc-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-pc-text-muted mb-1">Timezone</label>
              <input
                type="text"
                value={formData.tz}
                onChange={e => setFormData(prev => ({ ...prev, tz: e.target.value }))}
                placeholder="Asia/Shanghai"
                className="w-full px-2 py-1.5 text-sm rounded-lg bg-[var(--pc-bg-base)] border border-pc-border text-pc-text placeholder-pc-text-faint focus:outline-none focus:border-pc-accent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-pc-text-muted mb-1">Message</label>
            <textarea
              value={formData.message}
              onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Reminder message..."
              rows={2}
              className="w-full px-2 py-1.5 text-sm rounded-lg bg-[var(--pc-bg-base)] border border-pc-border text-pc-text placeholder-pc-text-faint focus:outline-none focus:border-pc-accent resize-none"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--pc-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              Create
            </button>
          </div>
        </form>
      )}

      {jobs.length === 0 ? (
        <p className="text-sm text-pc-text-muted text-center py-4">
          No cron jobs configured
        </p>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => (
            <div
              key={job.id}
              className={`p-3 rounded-lg bg-[var(--pc-bg-surface)] border border-pc-border group ${
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
                <button
                  onClick={() => handleDelete(job.id, job.name)}
                  className="p-1.5 rounded-lg text-pc-text-muted hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
