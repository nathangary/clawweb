import { Search, Filter, ArrowDownAZ, Clock, AlertTriangle } from 'lucide-react';
import type { FilterType, SortType } from './utils';

interface Props {
  filter: FilterType;
  search: string;
  sortBy: SortType;
  onFilterChange: (filter: FilterType) => void;
  onSearchChange: (search: string) => void;
  onSortChange: (sortBy: SortType) => void;
  totalCount: number;
  filteredCount: number;
}

const filterOptions: { id: FilterType; label: string; color: string }[] = [
  { id: 'all', label: '全部', color: '' },
  { id: 'active', label: '活跃', color: 'text-emerald-400' },
  { id: 'paused', label: '已暂停', color: 'text-slate-400' },
  { id: 'failing', label: '失败', color: 'text-red-400' },
];

const sortOptions: { id: SortType; label: string; icon: typeof Clock }[] = [
  { id: 'nextRun', label: '下次执行', icon: Clock },
  { id: 'name', label: '名称', icon: ArrowDownAZ },
  { id: 'status', label: '状态', icon: AlertTriangle },
];

export function TaskFilters({
  filter,
  search,
  sortBy,
  onFilterChange,
  onSearchChange,
  onSortChange,
  totalCount,
  filteredCount,
}: Props) {
  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pc-text-muted" />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="搜索任务名称..."
          className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-[var(--pc-bg-surface)] border border-pc-border text-pc-text placeholder:text-pc-text-muted focus:outline-none focus:border-[var(--pc-accent-dim)] transition-colors"
        />
      </div>

      {/* 筛选和排序 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Filter size={14} className="text-pc-text-muted mr-1" />
          {filterOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => onFilterChange(opt.id)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                filter === opt.id
                  ? 'bg-[var(--pc-hover)] text-pc-text'
                  : 'text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]'
              }`}
            >
              <span className={opt.color}>{opt.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-pc-text-faint">
            {filteredCount === totalCount ? `${totalCount} 个任务` : `${filteredCount}/${totalCount}`}
          </span>
          <div className="flex items-center gap-1">
            {sortOptions.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => onSortChange(opt.id)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                    sortBy === opt.id
                      ? 'bg-[var(--pc-hover)] text-pc-text'
                      : 'text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]'
                  }`}
                >
                  <Icon size={12} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
