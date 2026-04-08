import { Target } from 'lucide-react';
import type { CronJob } from '../../lib/nanobotApi';
import { TaskRow } from './TaskRow';

interface Props {
  jobs: CronJob[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TaskList({ jobs, selectedId, onSelect, onDelete }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
          <Target size={24} className="text-white/20" />
        </div>
        <p className="text-white/40 text-sm">暂无任务</p>
        <p className="text-white/20 text-xs mt-1">当前没有配置任何定时任务</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map(job => (
        <TaskRow
          key={job.id}
          job={job}
          isSelected={selectedId === job.id}
          onSelect={() => onSelect(job.id)}
          onDelete={() => onDelete(job.id)}
        />
      ))}
    </div>
  );
}
