import { Brain, Radio, Target, Zap, Activity, Clock, CheckCircle, XCircle, Server, Database, Cpu, Gauge, BarChart3 } from 'lucide-react';
import type { DashboardData } from '../../hooks/useDashboardPage';

interface Props {
  data: DashboardData;
  onTabChange: (tab: 'overview' | 'skills' | 'channels' | 'tasks') => void;
}

interface StatCard {
  title: string;
  value: string | number;
  label: string;
  icon: typeof Brain;
  color: string;
  tab: 'skills' | 'channels' | 'tasks';
}

const statCards: StatCard[] = [
  { title: '技能', value: 0, label: '已启用', icon: Brain, color: 'from-violet-500 to-purple-500', tab: 'skills' },
  { title: '渠道', value: 0, label: '在线', icon: Radio, color: 'from-emerald-500 to-teal-500', tab: 'channels' },
  { title: '任务', value: 0, label: '执行中', icon: Target, color: 'from-amber-500 to-orange-500', tab: 'tasks' },
];

export function DashboardOverview({ data, onTabChange }: Props) {
  const enabledSkills = data.skills.filter(s => s.enabled).length;
  const onlineChannels = Object.values(data.channels).filter(c => c.status === 'connected').length;
  const runningCrons = data.cronJobs.filter(c => c.enabled && c.state.next_run_at).length;
  const totalExecutions = data.cronJobs.reduce((sum, j) => sum + (j.state.last_run_at ? 1 : 0), 0);
  const successRate = totalExecutions > 0 
    ? Math.round((data.cronJobs.filter(j => j.state.last_status === 'ok').length / totalExecutions) * 100) 
    : 0;

  const stats = [
    { ...statCards[0], value: data.skills.length, label: `${enabledSkills} 已启用` },
    { ...statCards[1], value: Object.keys(data.channels).length, label: `${onlineChannels} 在线` },
    { ...statCards[2], value: data.cronJobs.length, label: `${runningCrons} 执行中` },
    { title: '执行', value: totalExecutions, label: `${successRate}% 成功率`, icon: Activity, color: 'from-cyan-500 to-blue-500', tab: 'tasks' as const },
  ];

  const systemHealth = [
    { name: 'API服务', status: 'healthy', icon: Server },
    { name: '数据库', status: 'healthy', icon: Database },
    { name: 'Cron调度', status: runningCrons > 0 ? 'healthy' : 'idle', icon: Clock },
    { name: 'Agent引擎', status: 'healthy', icon: Cpu },
  ];

  const quickActions = [
    { label: '新建任务', icon: Target, action: () => onTabChange('tasks') },
    { label: '管理技能', icon: Brain, action: () => onTabChange('skills') },
    { label: '查看渠道', icon: Radio, action: () => onTabChange('channels') },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <button
              key={idx}
              onClick={() => onTabChange(stat.tab)}
              className="relative group p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all text-left overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                    <Icon size={16} className="text-white" />
                  </div>
                  <span className="text-2xl font-bold text-white">{stat.value}</span>
                </div>
                <div className="text-sm text-white/60">{stat.title}</div>
                <div className="text-xs text-white/40 mt-0.5">{stat.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
            <h3 className="text-sm font-medium text-white/80 mb-4 flex items-center gap-2">
              <BarChart3 size={16} className="text-cyan-400" />
              任务执行趋势
            </h3>
            <div className="flex items-end gap-1 h-24">
              {data.cronJobs.slice(0, 12).map((job, idx) => {
                const height = job.state.last_status === 'ok' ? 80 : job.state.last_status === 'error' ? 40 : 20;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className={`w-full rounded-t ${job.state.last_status === 'ok' ? 'bg-emerald-500/60' : job.state.last_status === 'error' ? 'bg-red-500/60' : 'bg-white/10'}`}
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[8px] text-white/30 truncate w-full text-center">{job.name.slice(0, 4)}</span>
                  </div>
                );
              })}
              {data.cronJobs.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
                  暂无执行数据
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-white/40">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500/60" /> 成功</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500/60" /> 失败</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-white/10" /> 未执行</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
            <h3 className="text-sm font-medium text-white/80 mb-4 flex items-center gap-2">
              <Target size={16} className="text-amber-400" />
              最近任务
            </h3>
            <div className="space-y-2">
              {data.cronJobs.slice(0, 5).map((job, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${job.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
                    <div>
                      <span className="text-sm text-white/80">{job.name}</span>
                      <span className="text-xs text-white/40 ml-2 font-mono">{job.schedule.expr || job.schedule.kind}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.state.last_status === 'ok' && <CheckCircle size={14} className="text-emerald-400" />}
                    {job.state.last_status === 'error' && <XCircle size={14} className="text-red-400" />}
                    {!job.state.last_status && <Clock size={14} className="text-white/30" />}
                    {job.state.next_run_at && (
                      <span className="text-xs text-white/40">
                        {getTimeUntil(job.state.next_run_at)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {data.cronJobs.length === 0 && (
                <p className="text-sm text-white/40 text-center py-4">暂无任务</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
            <h3 className="text-sm font-medium text-white/80 mb-4 flex items-center gap-2">
              <Gauge size={16} className="text-violet-400" />
              系统状态
            </h3>
            <div className="space-y-3">
              {systemHealth.map((item, idx) => {
                const Icon = item.icon;
                const isHealthy = item.status === 'healthy';
                return (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isHealthy ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                        <Icon size={14} className={isHealthy ? 'text-emerald-400' : 'text-amber-400'} />
                      </div>
                      <span className="text-sm text-white/70">{item.name}</span>
                    </div>
                    <span className={`text-xs ${isHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isHealthy ? '正常' : '空闲'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
            <h3 className="text-sm font-medium text-white/80 mb-4 flex items-center gap-2">
              <Zap size={16} className="text-cyan-400" />
              渠道状态
            </h3>
            <div className="space-y-2">
              {Object.entries(data.channels).map(([name, status]) => (
                <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <span className="text-sm text-white/70 capitalize">{name}</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status.status === 'connected' ? 'bg-emerald-400' : 'bg-red-400'} ${status.status === 'connected' ? 'animate-pulse' : ''}`} />
                    <span className={`text-xs ${status.status === 'connected' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {status.status === 'connected' ? '在线' : '离线'}
                    </span>
                  </div>
                </div>
              ))}
              {Object.keys(data.channels).length === 0 && (
                <p className="text-sm text-white/40 text-center py-4">暂无渠道</p>
              )}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
            <h3 className="text-sm font-medium text-white/80 mb-4 flex items-center gap-2">
              <Activity size={16} className="text-emerald-400" />
              快捷操作
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {quickActions.map((action, idx) => {
                const Icon = action.icon;
                return (
                  <button
                    key={idx}
                    onClick={action.action}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <Icon size={18} className="text-cyan-400" />
                    <span className="text-xs text-white/60">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeUntil(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff < 0) return '已过期';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}