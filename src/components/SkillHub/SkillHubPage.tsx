import { useState } from 'react';
import { X, Search, Sparkles, Filter, ArrowUpDown } from 'lucide-react';
import { useSkillFilters } from '../../hooks/useSkillFilters';
import { SkillCard } from './SkillCard';
import { SkillDetail } from './SkillDetail';
import type { Skill, SortBy } from '../../types/skill';

interface Props {
  onClose: () => void;
}

export function SkillHubPage({ onClose }: Props) {
  const {
    skills,
    categories,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    filters,
    updateFilters,
  } = useSkillFilters();

  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const sortOptions: { value: SortBy; label: string }[] = [
    { value: 'downloads', label: '最多安装' },
    { value: 'rating', label: '最高评分' },
    { value: 'newest', label: '最新上线' },
    { value: 'name', label: '名称排序' },
  ];

  const handleInstall = (skillId: string, config: Record<string, unknown>) => {
    console.log('安装技能:', skillId, config);
  };

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--pc-bg-base)] flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border bg-[var(--pc-bg-surface)]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1.5 rounded-xl bg-gradient-to-r from-cyan-400/15 to-violet-500/15 blur-lg" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden">
                <span className="text-2xl">✨</span>
              </div>
            </div>
            <div>
              <h1 className="font-semibold text-pc-text text-base">技能市场</h1>
              <p className="text-[11px] text-pc-text-muted">发现并安装 AI 技能</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl hover:bg-[var(--pc-hover)] text-pc-text-muted hover:text-pc-text transition-colors"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pc-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索技能名称、描述或标签..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-pc-border bg-[var(--pc-bg-base)]/50 text-sm text-pc-text placeholder:text-pc-text-muted outline-none focus:ring-1 focus:ring-[var(--pc-accent-dim)] focus:border-[var(--pc-accent-dim)] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pc-text-muted hover:text-pc-text"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                showFilters || filters.isOfficial || filters.isNew
                  ? 'border-[var(--pc-accent-dim)] bg-[var(--pc-accent-glow)] text-[var(--pc-accent)]'
                  : 'border-pc-border text-pc-text-muted hover:bg-[var(--pc-hover)] hover:text-pc-text'
              }`}
            >
              <Filter size={14} />
              <span>筛选</span>
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.isOfficial}
                  onChange={e => updateFilters({ isOfficial: e.target.checked })}
                  className="w-4 h-4 rounded border-pc-border bg-[var(--pc-bg-base)] accent-[var(--pc-accent)]"
                />
                <span className="text-sm text-pc-text-secondary flex items-center gap-1">
                  <Sparkles size={12} className="text-[var(--pc-accent)]" />
                  官方认证
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.isNew}
                  onChange={e => updateFilters({ isNew: e.target.checked })}
                  className="w-4 h-4 rounded border-pc-border bg-[var(--pc-bg-base)] accent-[var(--pc-accent)]"
                />
                <span className="text-sm text-pc-text-secondary">新上线</span>
              </label>
              <div className="flex items-center gap-2 ml-auto">
                <ArrowUpDown size={14} className="text-pc-text-muted" />
                <select
                  value={filters.sortBy}
                  onChange={e => updateFilters({ sortBy: e.target.value as SortBy })}
                  className="bg-transparent text-sm text-pc-text-secondary outline-none cursor-pointer"
                >
                  {sortOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-[var(--pc-accent)] text-zinc-900 shadow-[0_2px_8px_rgba(var(--pc-accent-rgb),0.2)]'
                    : 'text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-pc-text mb-2">未找到相关技能</h3>
            <p className="text-sm text-pc-text-muted">试试调整搜索条件或筛选标签</p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-pc-text-muted">
              共 {skills.length} 个技能
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {skills.map(skill => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onClick={() => setSelectedSkill(skill)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {selectedSkill && (
        <SkillDetail
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onInstall={handleInstall}
        />
      )}
    </div>
  );
}
