import { Star, Download, Sparkles } from 'lucide-react';
import type { Skill } from '../../types/skill';

interface Props {
  skill: Skill;
  onClick: () => void;
}

export function SkillCard({ skill, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-[var(--pc-bg-surface)] border border-pc-border rounded-2xl p-5 hover:border-[var(--pc-accent-dim)] hover:bg-[var(--pc-bg-elevated)] transition-all duration-200 hover:shadow-[0_0_24px_rgba(var(--pc-accent-rgb),0.08)] hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="text-3xl shrink-0">{skill.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-pc-text group-hover:text-[var(--pc-accent)] transition-colors truncate">
              {skill.name}
            </h3>
            {skill.isOfficial && (
              <span className="inline-flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-full bg-[var(--pc-accent-glow)] text-[10px] font-medium text-[var(--pc-accent)]">
                <Sparkles size={10} />
                官方
              </span>
            )}
            {skill.isNew && (
              <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-violet-500/15 text-[10px] font-medium text-violet-300">
                NEW
              </span>
            )}
          </div>
          <p className="text-xs text-pc-text-muted mt-0.5">{skill.author} · v{skill.version}</p>
        </div>
      </div>

      <p className="text-sm text-pc-text-secondary leading-relaxed line-clamp-2 mb-4">
        {skill.description}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <span className="px-2 py-0.5 rounded-lg bg-[var(--pc-bg-base)] text-[11px] text-pc-text-muted">
          {skill.category}
        </span>
        {skill.tags.slice(0, 2).map(tag => (
          <span key={tag} className="px-2 py-0.5 rounded-lg bg-[var(--pc-bg-base)] text-[11px] text-pc-text-muted">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-pc-text-muted">
        <div className="flex items-center gap-1">
          {skill.rating > 0 ? (
            <>
              <Star size={12} className="text-amber-400 fill-amber-400" />
              <span>{skill.rating.toFixed(1)}</span>
              <span className="text-pc-text-faint">({skill.installCount})</span>
            </>
          ) : (
            <span className="text-pc-text-faint">暂无评分</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Download size={12} />
          <span>{skill.installCount.toLocaleString()} 安装</span>
        </div>
      </div>
    </button>
  );
}
