import { Sparkles, Code, Search, MessageCircle, Image, FileText, Database, Webhook } from 'lucide-react';
import type { NanobotSkill } from '../../lib/nanobotApi';

interface Props {
  skills: NanobotSkill[];
  onToggle: (skillName: string, enabled: boolean) => Promise<boolean>;
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

export function DashboardSkills({ skills, onToggle }: Props) {
  const handleToggle = async (skillName: string, currentEnabled: boolean) => {
    await onToggle(skillName, !currentEnabled);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">技能中心</h3>
        <span className="text-sm text-white/40">
          {skills.filter(s => s.enabled).length} / {skills.length} 已启用
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills.map((skill, idx) => {
          const Icon = getSkillIcon(skill.name);
          return (
            <div
              key={idx}
              className={`p-4 rounded-xl border transition-all ${
                skill.enabled
                  ? 'bg-white/5 border-white/20'
                  : 'bg-white/[0.02] border-white/5 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${skill.enabled ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-white/5'}`}>
                    <Icon size={18} className={skill.enabled ? 'text-white' : 'text-white/30'} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white">{skill.name}</h4>
                    <span className={`text-xs ${skill.enabled ? 'text-violet-400' : 'text-white/30'}`}>
                      {skill.source}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(skill.name, skill.enabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    skill.enabled ? 'bg-violet-500' : 'bg-white/10'
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
          <div className="col-span-full text-center py-12 text-white/40">
            暂无技能数据
          </div>
        )}
      </div>
    </div>
  );
}