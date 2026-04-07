import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Target, Loader2 } from 'lucide-react';
import type { NanobotApiClient, CronJob, CronLogEntry } from '../../lib/nanobotApi';
import { TaskFilters } from './TaskFilters';
import { TaskList } from './TaskList';
import { TaskDetailPanel } from './TaskDetailPanel';
import { filterJobs, sortJobs, type FilterType, type SortType } from './utils';

interface Props {
  apiClient: NanobotApiClient | null;
  onClose: () => void;
}

export function TasksPage({ apiClient, onClose }: Props) {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [cronLogs, setCronLogs] = useState<Record<string, CronLogEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('nextRun');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const fetchJobs = useCallback(async () => {
    if (!apiClient || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await apiClient.getCronJobs();
      if (res.applied) setJobs(res.data.jobs);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [apiClient]);

  const fetchCronLogs = useCallback(async (jobId: string) => {
    if (!apiClient) return;
    try {
      const res = await apiClient.getCronJobLogs(jobId, 50);
      if (res.applied && res.data.logs) {
        setCronLogs(prev => ({ ...prev, [jobId]: res.data.logs }));
      }
    } catch {
    }
  }, [apiClient]);

  const handleDelete = async (jobId: string) => {
    if (!apiClient) return;
    const job = jobs.find(j => j.id === jobId);
    if (job && !confirm(`确定删除任务 "${job.name}" 吗？`)) return;
    try {
      await apiClient.deleteCronJob(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      if (selectedId === jobId) setSelectedId(null);
    } catch {
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const filteredAndSorted = useMemo(() => {
    const filtered = filterJobs(jobs, filter, search);
    return sortJobs(filtered, sortBy);
  }, [jobs, filter, search, sortBy]);

  const selectedJob = useMemo(() => {
    return jobs.find(j => j.id === selectedId) || null;
  }, [jobs, selectedId]);

  const selectedLogs = selectedId ? cronLogs[selectedId] : undefined;

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--pc-bg-base)] flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border bg-[var(--pc-bg-surface)]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1.5 rounded-xl bg-gradient-to-r from-cyan-400/15 to-violet-500/15 blur-lg" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20">
                <Target size={18} className="text-pc-accent" />
              </div>
            </div>
            <div>
              <h1 className="font-semibold text-pc-text text-base">目标/任务</h1>
              <p className="text-[11px] text-pc-text-muted">管理和监控定时任务</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-[var(--pc-hover)] text-pc-text-muted hover:text-pc-text transition-colors" aria-label="关闭">
              <X size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Loader2 size={24} className="text-pc-accent animate-spin mb-3" />
            <p className="text-sm text-pc-text-secondary">加载中...</p>
          </div>
        ) : (
          <div className="h-full flex">
            <div className="flex-1 flex flex-col min-w-0">
              <TaskFilters
                filter={filter}
                search={search}
                sortBy={sortBy}
                onFilterChange={setFilter}
                onSearchChange={setSearch}
                onSortChange={setSortBy}
                totalCount={jobs.length}
                filteredCount={filteredAndSorted.length}
              />
              <div className="flex-1 overflow-y-auto">
                <TaskList
                  jobs={filteredAndSorted}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onDelete={handleDelete}
                />
              </div>
            </div>

            {selectedJob && (
              <TaskDetailPanel
                job={selectedJob}
                logs={selectedLogs}
                onFetchLogs={fetchCronLogs}
                onClose={() => setSelectedId(null)}
                onDelete={handleDelete}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
