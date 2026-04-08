import { Sparkles, Code, Search, MessageCircle, Image, FileText, Database, Webhook, ExternalLink } from 'lucide-react';
import type { NanobotSkill } from '../../lib/nanobotApi';

interface Props {
  skills: NanobotSkill[];
  onToggle: (skillName: string, enabled: boolean) => Promise<boolean>;
  onOpenMarket?: () => void;
}

const skillIcons: Record<string, typeof Sparkles> = {
  code: Code,
  search: Search,
  chat: MessageCircle,
  image: Image,
  document: FileText,
  database: Database,
  webhook: Webhook,
};

function getSkillIcon(name: string) {
  const key = name.toLowerCase().replace(/[_\s-]/g, '');
  return skillIcons[key] || Sparkles;
}

export function DashboardSkills({ skills, onToggle, onOpenMarket }: Props) {
  const handleToggle = async (skillName: string, currentEnabled: boolean) => {
    await onToggle(skillName, !currentEnabled);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-pc-text">技能中心</h3>
        <div className="flex items-center gap-3">
          {onOpenMarket && (
            <button
              onClick={onOpenMarket}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--pc-accent)] hover:text-[var(--pc-accent-light)] hover:bg-[var(--pc-accent-glow)] transition-colors"
              title="前往技能市场"
            >
              <ExternalLink size={12} />
              <span>技能市场</span>
            </button>
          )}
          <span className="text-sm text-pc-text-muted">
            {skills.filter(s => s.enabled).length} / {skills.length} 已启用
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills.map((skill, idx) => {
          const Icon = getSkillIcon(skill.name);
          return (
            <div
              key={idx}
              className={`p-4 rounded-xl border transition-all ${
                skill.enabled
                  ? 'bg-[var(--pc-bg-surface)] border-pc-border'
                  : 'bg-[var(--pc-bg-base)] border-pc-border opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${skill.enabled ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-[var(--pc-hover)]'}`}>
                    <Icon size={18} className={skill.enabled ? 'text-white' : 'text-pc-text-muted'} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-pc-text">{skill.name}</h4>
                    <span className={`text-xs ${skill.enabled ? 'text-violet-400' : 'text-pc-text-muted'}`}>
                      {skill.source}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(skill.name, skill.enabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    skill.enabled ? 'bg-violet-500' : 'bg-[var(--pc-border)]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      skill.enabled ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}

        {skills.length === 0 && (
          <div className="col-span-full text-center py-12 text-pc-text-muted">
            暂无技能数据
          </div>
        )}
      </div>
    </div>
  );
}