import { MessageSquare, Bot, Radio, Clock } from 'lucide-react';
import type { DashboardData } from '../../hooks/useDashboard';

interface Props {
  data: DashboardData;
  onTabChange: (tab: 'overview' | 'skills' | 'channels' | 'cron') => void;
}

interface CardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtext?: string;
  onClick?: () => void;
  color: 'accent' | 'emerald' | 'amber' | 'violet';
}

function Card({ icon, label, value, subtext, onClick, color }: CardProps) {
  const colorClasses = {
    accent: 'from-cyan-500/10 to-blue-500/10 border-cyan-500/20',
    emerald: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20',
    amber: 'from-amber-500/10 to-orange-500/10 border-amber-500/20',
    violet: 'from-violet-500/10 to-purple-500/10 border-violet-500/20',
  };
  const iconColorClasses = {
    accent: 'text-cyan-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    violet: 'text-violet-400',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl bg-gradient-to-br ${colorClasses[color]} border transition-all hover:scale-[1.02] active:scale-[0.98] text-left ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-[var(--pc-bg-surface)] ${iconColorClasses[color]}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-pc-text-muted uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-pc-text tabular-nums">{value}</p>
          {subtext && <p className="text-[10px] text-pc-text-muted truncate">{subtext}</p>}
        </div>
      </div>
    </button>
  );
}

export function OverviewCards({ data, onTabChange }: Props) {
  const enabledSkills = data.skills.filter(s => s.enabled).length;
  const connectedChannels = Object.values(data.channels).filter(c => c.status === 'connected').length;
  const enabledCron = data.cronJobs.filter(j => j.enabled).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card
          icon={<MessageSquare size={18} />}
          label="Sessions"
          value={data.sessions.length}
          color="accent"
        />
        <Card
          icon={<Bot size={18} />}
          label="Skills"
          value={data.skills.length}
          subtext={`${enabledSkills} enabled`}
          onClick={() => onTabChange('skills')}
          color="emerald"
        />
        <Card
          icon={<Radio size={18} />}
          label="Channels"
          value={connectedChannels}
          subtext={`${Object.keys(data.channels).length} total`}
          onClick={() => onTabChange('channels')}
          color="amber"
        />
        <Card
          icon={<Clock size={18} />}
          label="Cron Jobs"
          value={enabledCron}
          subtext={`${data.cronJobs.length} total`}
          onClick={() => onTabChange('cron')}
          color="violet"
        />
      </div>
    </div>
  );
}
