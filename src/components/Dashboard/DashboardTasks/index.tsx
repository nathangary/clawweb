import { useState, useMemo } from 'react';
import type { CronJob, CronLogEntry } from '../../../lib/nanobotApi';
import { TaskFilters } from './TaskFilters';
import { TaskList } from './TaskList';
import { TaskDetailPanel } from './TaskDetailPanel';
import { filterJobs, sortJobs, type FilterType, type SortType } from './utils';

interface Props {
  jobs: CronJob[];
  logs: Record<string, CronLogEntry[]>;
  onDelete: (jobId: string) => void;
  onFetchLogs: (jobId: string) => void;
}

export function DashboardTasks({ jobs, logs, onDelete, onFetchLogs }: Props) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('nextRun');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredAndSorted = useMemo(() => {
    const filtered = filterJobs(jobs, filter, search);
    return sortJobs(filtered, sortBy);
  }, [jobs, filter, search, sortBy]);

  const selectedJob = useMemo(() => {
    return jobs.find(j => j.id === selectedId) || null;
  }, [jobs, selectedId]);

  const selectedLogs = selectedId ? logs[selectedId] : undefined;

  const handleDelete = (id: string) => {
    const job = jobs.find(j => j.id === id);
    if (job && confirm(`确定删除任务 "${job.name}" 吗？`)) {
      onDelete(id);
      if (selectedId === id) setSelectedId(null);
    }
  };

  return (
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
          onFetchLogs={onFetchLogs}
          onClose={() => setSelectedId(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
