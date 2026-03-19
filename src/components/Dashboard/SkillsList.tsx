import { useState } from 'react';
import { Bot, Search, Loader2 } from 'lucide-react';
import type { NanobotSkill } from '../../lib/nanobotApi';

interface Props {
  skills: NanobotSkill[];
  onToggle: (name: string, enabled: boolean) => Promise<boolean>;
}

export function SkillsList({ skills, onToggle }: Props) {
  const [filter, setFilter] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const filtered = skills.filter(s =>
    s.name.toLowerCase().includes(filter.toLowerCase())
  );

  const handleToggle = async (name: string, currentEnabled: boolean) => {
    setToggling(name);
    await onToggle(name, !currentEnabled);
    setToggling(null);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pc-text-muted" />
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search skills..."
          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-[var(--pc-bg-surface)] border border-pc-border text-pc-text placeholder:text-pc-text-faint focus:outline-none focus:border-[var(--pc-accent-dim)]"
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-pc-text-muted text-center py-4">
            {filter ? 'No skills match your search' : 'No skills available'}
          </p>
        ) : (
          filtered.map(skill => (
            <div
              key={skill.name}
              className="flex items-center gap-3 p-3 rounded-lg bg-[var(--pc-bg-surface)] border border-pc-border"
            >
              <div className="p-1.5 rounded-lg bg-[var(--pc-hover)]">
                <Bot size={14} className="text-pc-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-pc-text truncate">{skill.name}</p>
                <p className="text-[10px] text-pc-text-muted">
                  {skill.source === 'builtin' ? 'Built-in' : 'Workspace'}
                </p>
              </div>
              <button
                onClick={() => handleToggle(skill.name, skill.enabled)}
                disabled={toggling === skill.name}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  skill.enabled ? 'bg-emerald-500/30' : 'bg-[var(--pc-hover)]'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-pc-text-muted transition-all ${
                    skill.enabled ? 'left-5 translate-x-0 bg-emerald-400' : 'left-0.5'
                  }`}
                >
                  {toggling === skill.name && (
                    <Loader2 size={12} className="animate-spin text-pc-bg-base" />
                  )}
                </div>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
