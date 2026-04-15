import { useState } from 'react';
import {
  LayoutDashboard, Bot, Brain, Radio, Clock, Target, Zap, Activity,
  MessageSquare, FileText, Calendar, TrendingUp, CheckCircle,
  XCircle, AlertCircle, Play, Pause, Plus, Search, Filter, ChevronRight,
  Sparkles, Server, Database, Cpu, Wifi,
  ArrowUpRight, ArrowDownRight, Eye, Settings, Bell, Star
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

const mockAgents = [
  { id: 1, name: '订单处理Agent', status: 'active' as const, executions: 1247, successRate: 98.5 },
  { id: 2, name: '库存监控Agent', status: 'active' as const, executions: 892, successRate: 99.1 },
  { id: 3, name: '会员服务Agent', status: 'active' as const, executions: 2341, successRate: 97.8 },
  { id: 4, name: '营销推送Agent', status: 'draft' as const, executions: 156, successRate: 94.2 },
  { id: 5, name: '数据报表Agent', status: 'active' as const, executions: 456, successRate: 99.8 },
  { id: 6, name: '物流跟踪Agent', status: 'disabled' as const, executions: 0, successRate: 0 },
];

const mockRecentActivity = [
  { id: 1, type: 'session', icon: MessageSquare, text: '新订单查询 - 订单号 #ORD20250415001', time: '2分钟前', color: 'cyan' },
  { id: 2, type: 'agent', icon: Bot, text: '库存监控Agent 执行完成', time: '5分钟前', color: 'emerald' },
  { id: 3, type: 'cron', icon: Clock, text: '日报生成任务 已触发', time: '15分钟前', color: 'amber' },
  { id: 4, type: 'alert', icon: AlertCircle, text: '商品 SKU-8888 库存不足预警', time: '1小时前', color: 'red' },
  { id: 5, type: 'session', icon: MessageSquare, text: '会员积分兑换 - 会员ID #MB2025040156', time: '1小时前', color: 'cyan' },
  { id: 6, type: 'agent', icon: Sparkles, text: '智能体编排 创建新智能体「售后处理」', time: '2小时前', color: 'violet' },
  { id: 7, type: 'skill', icon: Brain, text: '「查询订单」技能被启用', time: '3小时前', color: 'emerald' },
];

const mockSkills = [
  { name: '查询订单', category: '订单处理', status: 'enabled', usage: 3245 },
  { name: '创建订单', category: '订单处理', status: 'enabled', usage: 2876 },
  { name: '取消订单', category: '订单处理', status: 'enabled', usage: 1543 },
  { name: '查询库存', category: '库存管理', status: 'enabled', usage: 2654 },
  { name: '库存预警', category: '库存管理', status: 'enabled', usage: 1543 },
  { name: '查询会员', category: '会员服务', status: 'enabled', usage: 2987 },
  { name: '积分操作', category: '会员服务', status: 'enabled', usage: 1876 },
  { name: '发送短信', category: '外部集成', status: 'disabled', usage: 0 },
];

const mockCronJobs = [
  { name: '日报生成', expr: '0 8 * * *', nextRun: '08:00 明天', lastStatus: 'ok', enabled: true },
  { name: '库存同步', expr: '*/30 * * * *', nextRun: '14:30 今天', lastStatus: 'ok', enabled: true },
  { name: '会员积分结算', expr: '0 0 * * *', nextRun: '00:00 明天', lastStatus: 'error', enabled: true },
  { name: '物流状态更新', expr: '*/15 * * * *', nextRun: '14:45 今天', lastStatus: 'ok', enabled: false },
];

const mockSessions = [
  { name: '订单咨询', preview: '帮我查一下订单 #ORD20250415001 的状态...', time: '5分钟前', unread: 2 },
  { name: '库存查询', preview: '请问 SKU-A888 现在的库存有多少？', time: '20分钟前', unread: 0 },
  { name: '会员办理', preview: '新会员开户，手机号 138****8888', time: '1小时前', unread: 1 },
  { name: '售后处理', preview: '订单号 #ORD20250414032 申请退款', time: '2小时前', unread: 0 },
];

const mockExecutionTimeline = [
  { time: '08:00', agent: '日报生成', status: 'ok' as const },
  { time: '08:30', agent: '库存同步', status: 'ok' as const },
  { time: '09:00', agent: '订单处理', status: 'ok' as const },
  { time: '09:30', agent: '库存同步', status: 'ok' as const },
  { time: '10:00', agent: '会员积分', status: 'error' as const },
  { time: '10:30', agent: '库存同步', status: 'ok' as const },
  { time: '11:00', agent: '订单处理', status: 'ok' as const },
  { time: '11:30', agent: '库存同步', status: 'ok' as const },
  { time: '12:00', agent: '日报生成', status: 'ok' as const },
  { time: '12:30', agent: '库存同步', status: 'ok' as const },
  { time: '13:00', agent: '订单处理', status: 'ok' as const },
  { time: '13:30', agent: '库存同步', status: 'ok' as const },
  { time: '14:00', agent: '物流跟踪', status: 'ok' as const },
];

const colorMap: Record<string, string> = {
  cyan: 'text-cyan-400 bg-cyan-500/15',
  emerald: 'text-emerald-400 bg-emerald-500/15',
  amber: 'text-amber-400 bg-amber-500/15',
  red: 'text-red-400 bg-red-500/15',
  violet: 'text-violet-400 bg-violet-500/15',
};

const statusColorMap: Record<string, string> = {
  active: 'bg-emerald-500',
  draft: 'bg-amber-500',
  disabled: 'bg-zinc-500',
  ok: 'bg-emerald-500',
  error: 'bg-red-500',
};

export function WorkspacePage({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'tasks' | 'skills'>('overview');
  const [selectedAgent, setSelectedAgent] = useState<typeof mockAgents[0] | null>(null);

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--pc-bg-base)] flex overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(var(--pc-accent-rgb),0.08),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(var(--pc-accent-rgb),0.05),transparent_50%)]" />

      <nav className="relative w-56 flex flex-col border-r border-pc-border bg-[var(--pc-bg-surface)]/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-pc-border">
          <div className="relative">
            <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-[var(--pc-accent)] to-violet-500 blur-lg opacity-50" />
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--pc-accent)] to-violet-600 flex items-center justify-center">
              <LayoutDashboard size={18} className="text-white" />
            </div>
          </div>
          <div>
            <h1 className="font-semibold text-pc-text text-sm">我的工作台</h1>
            <p className="text-[10px] text-pc-text-muted">Workspace</p>
          </div>
        </div>

        <div className="flex-1 py-4 px-3 space-y-1">
          {[
            { id: 'overview', label: '概览', icon: LayoutDashboard },
            { id: 'agents', label: '智能体', icon: Bot },
            { id: 'tasks', label: '任务', icon: Target },
            { id: 'skills', label: '技能', icon: Brain },
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as typeof activeTab)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-[var(--pc-accent)]/20 to-violet-500/20 text-pc-text border-l-2 border-[var(--pc-accent)]'
                    : 'text-pc-text-secondary hover:text-pc-text hover:bg-[var(--pc-hover)]'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-[var(--pc-accent)]' : 'text-pc-text-muted'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-pc-border space-y-1">
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors"
          >
            <LayoutDashboard size={14} />
            <span>返回概览</span>
          </button>
        </div>
      </nav>

      <main className="relative flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between h-14 px-6 border-b border-pc-border bg-[var(--pc-bg-surface)]/50">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-pc-text">
              {activeTab === 'overview' && '今日概览'}
              {activeTab === 'agents' && '智能体管理'}
              {activeTab === 'tasks' && '任务中心'}
              {activeTab === 'skills' && '技能中心'}
            </h2>
            <span className="text-xs text-pc-text-muted px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
              系统正常
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pc-text-muted" />
              <input
                type="text"
                placeholder="搜索..."
                className="w-48 pl-8 pr-3 py-1.5 rounded-lg border border-pc-border bg-[var(--pc-bg-surface)] text-xs text-pc-text placeholder:text-pc-text-muted outline-none focus:border-[var(--pc-accent-dim)]"
              />
            </div>
            <button className="p-2 rounded-lg hover:bg-[var(--pc-hover)] text-pc-text-muted transition-colors relative">
              <Bell size={16} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-white text-xs font-medium">
                U
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && <OverviewTab selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent} />}
          {activeTab === 'agents' && <AgentsTab selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent} />}
          {activeTab === 'tasks' && <TasksTab />}
          {activeTab === 'skills' && <SkillsTab />}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subtext, trend, color }: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down';
  color: 'cyan' | 'emerald' | 'amber' | 'violet';
}) {
  const colors = {
    cyan: 'from-cyan-500/15 to-blue-500/15 border-cyan-500/20',
    emerald: 'from-emerald-500/15 to-teal-500/15 border-emerald-500/20',
    amber: 'from-amber-500/15 to-orange-500/15 border-amber-500/20',
    violet: 'from-violet-500/15 to-purple-500/15 border-violet-500/20',
  };
  const iconColors = {
    cyan: 'text-cyan-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    violet: 'text-violet-400',
  };

  return (
    <div className={`p-4 rounded-2xl bg-gradient-to-br ${colors[color]} border transition-all hover:scale-[1.02]`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl bg-[var(--pc-bg-surface)] ${iconColors[color]}`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-pc-text">{value}</span>
            {trend && (
              <span className={`flex items-center text-xs ${trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              </span>
            )}
          </div>
          <p className="text-xs text-pc-text-muted">{label}</p>
          {subtext && <p className="text-[10px] text-pc-text-muted truncate">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ selectedAgent, setSelectedAgent }: { selectedAgent: typeof mockAgents[0] | null; setSelectedAgent: (a: typeof mockAgents[0]) => void }) {
  return (
    <div className="space-y-6">
      <div className="relative p-6 rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-violet-500/10 to-transparent" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/10 rounded-full blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-pc-text flex items-center gap-2">
              你好，陈雨陆
              <span className="text-lg">👋</span>
            </h2>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-cyan-400">
                <Activity size={12} />
                <span>系统运行正常</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-pc-text-muted">
                <Clock size={12} />
                <span>已工作 6.5 小时</span>
              </div>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--pc-accent)] text-zinc-900 text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-cyan-500/20">
              <Plus size={16} />
              新建任务
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--pc-bg-surface)] border border-pc-border text-pc-text text-sm font-medium hover:bg-[var(--pc-hover)] transition-all">
              <Sparkles size={16} />
              AI 创建
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={MessageSquare} label="活跃会话" value={12} subtext="较昨日 +3" trend="up" color="cyan" />
        <StatCard icon={Bot} label="运行智能体" value="5/6" subtext="在线 5 个" color="emerald" />
        <StatCard icon={Target} label="今日执行" value={847} subtext="成功率 98.2%" trend="up" color="violet" />
        <StatCard icon={Brain} label="启用技能" value="28/35" subtext="本周新增 2 个" color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-pc-text flex items-center gap-2">
                <Activity size={16} className="text-cyan-400" />
                最近活动
              </h3>
              <button className="text-xs text-pc-text-muted hover:text-pc-accent transition-colors">查看全部</button>
            </div>
            <div className="space-y-2">
              {mockRecentActivity.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--pc-hover)] transition-colors cursor-pointer">
                    <div className={`p-2 rounded-lg ${colorMap[item.color]}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-pc-text truncate">{item.text}</p>
                    </div>
                    <span className="text-xs text-pc-text-muted shrink-0">{item.time}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-pc-text flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" />
                今日执行动态
              </h3>
              <div className="flex items-center gap-3 text-[10px] text-pc-text-muted">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500" /> 成功</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500" /> 失败</span>
              </div>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {mockExecutionTimeline.map((item, idx) => (
                <div key={idx} className="flex flex-col items-center shrink-0">
                  <div className={`w-3 h-3 rounded-full ${statusColorMap[item.status]} ${item.status === 'ok' ? '' : 'animate-pulse'}`} />
                  {idx < mockExecutionTimeline.length - 1 && (
                    <div className={`w-8 h-0.5 ${item.status === 'ok' ? 'bg-emerald-500/30' : 'bg-red-500/30'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-pc-text-muted">
              <span>08:00</span>
              <span>14:30</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border">
            <h3 className="text-sm font-medium text-pc-text mb-4 flex items-center gap-2">
              <Zap size={16} className="text-amber-400" />
              快捷操作
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Plus, label: '创建智能体', color: 'cyan' },
                { icon: Play, label: '快速测试', color: 'emerald' },
                { icon: FileText, label: '查看报表', color: 'violet' },
                { icon: Calendar, label: '创建定时', color: 'amber' },
              ].map((action, idx) => {
                const Icon = action.icon;
                return (
                  <button
                    key={idx}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-[var(--pc-bg-base)] hover:bg-[var(--pc-hover)] transition-all border border-transparent hover:border-pc-border`}
                  >
                    <div className={`p-2.5 rounded-xl bg-[var(--pc-accent-glow)]`}>
                      <Icon size={18} className="text-[var(--pc-accent)]" />
                    </div>
                    <span className="text-xs text-pc-text-secondary">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-pc-text flex items-center gap-2">
                <Clock size={16} className="text-violet-400" />
                定时任务
              </h3>
              <button className="text-xs text-pc-text-muted hover:text-pc-accent transition-colors">管理</button>
            </div>
            <div className="space-y-2">
              {mockCronJobs.slice(0, 4).map((job, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[var(--pc-bg-base)]">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${job.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                    <div>
                      <p className="text-sm text-pc-text">{job.name}</p>
                      <p className="text-[10px] text-pc-text-muted font-mono">{job.expr}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.lastStatus === 'ok' && <CheckCircle size={12} className="text-emerald-400" />}
                    {job.lastStatus === 'error' && <XCircle size={12} className="text-red-400" />}
                    <span className="text-[10px] text-pc-text-muted">{job.nextRun}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-pc-text flex items-center gap-2">
                <Radio size={16} className="text-emerald-400" />
                渠道状态
              </h3>
              <span className="text-xs text-emerald-400">4 在线</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Webchat', status: 'connected' },
                { name: 'Discord', status: 'connected' },
                { name: 'Telegram', status: 'connected' },
                { name: '企微', status: 'disconnected' },
              ].map((ch, idx) => (
                <div key={idx} className="flex items-center gap-2 p-3 rounded-xl bg-[var(--pc-bg-base)]">
                  <div className={`w-2 h-2 rounded-full ${ch.status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  <span className="text-xs text-pc-text-secondary">{ch.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-pc-text flex items-center gap-2">
              <Bot size={16} className="text-violet-400" />
              智能体状态
            </h3>
            <button className="text-xs text-pc-text-muted hover:text-pc-accent transition-colors flex items-center gap-1">
              查看全部 <ChevronRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {mockAgents.slice(0, 4).map((agent) => (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedAgent?.id === agent.id
                    ? 'bg-[var(--pc-accent-glow)] border-[var(--pc-accent-dim)]'
                    : 'bg-[var(--pc-bg-base)] border-transparent hover:border-pc-border'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${statusColorMap[agent.status]} ${agent.status === 'active' ? 'animate-pulse' : ''}`} />
                  <span className="text-sm font-medium text-pc-text truncate">{agent.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-pc-text-muted">执行 {agent.executions}</span>
                  <span className={agent.successRate >= 98 ? 'text-emerald-400' : 'text-amber-400'}>
                    {agent.successRate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          </div>

        <div className="p-5 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-pc-text flex items-center gap-2">
              <MessageSquare size={16} className="text-cyan-400" />
              最近会话
            </h3>
            <button className="text-xs text-pc-text-muted hover:text-pc-accent transition-colors flex items-center gap-1">
              查看全部 <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {mockSessions.map((session, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--pc-hover)] transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center">
                  <MessageSquare size={16} className="text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-pc-text">{session.name}</span>
                    {session.unread > 0 && (
                      <span className="w-4 h-4 rounded-full bg-[var(--pc-accent)] text-[9px] font-bold text-zinc-900 flex items-center justify-center">
                        {session.unread}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-pc-text-muted truncate">{session.preview}</p>
                </div>
                <span className="text-[10px] text-pc-text-muted shrink-0">{session.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-pc-text flex items-center gap-2">
            <Server size={16} className="text-emerald-400" />
            系统状态
          </h3>
          <span className="text-xs text-pc-text-muted">最后更新: 14:30:25</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: 'API服务', icon: Server, status: 'healthy', latency: '12ms' },
            { name: '数据库', icon: Database, status: 'healthy', latency: '8ms' },
            { name: 'Agent引擎', icon: Cpu, status: 'healthy', latency: '45ms' },
            { name: '缓存服务', icon: Wifi, status: 'degraded', latency: '156ms' },
          ].map((service, idx) => {
            const Icon = service.icon;
            const isHealthy = service.status === 'healthy';
            return (
              <div key={idx} className="flex items-center gap-3 p-4 rounded-xl bg-[var(--pc-bg-base)]">
                <div className={`p-2 rounded-lg ${isHealthy ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                  <Icon size={16} className={isHealthy ? 'text-emerald-400' : 'text-amber-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-pc-text">{service.name}</p>
                  <p className="text-xs text-pc-text-muted">{service.latency}</p>
                </div>
                <span className={`text-xs ${isHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isHealthy ? '正常' : '降级'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AgentsTab({ selectedAgent, setSelectedAgent }: { selectedAgent: typeof mockAgents[0] | null; setSelectedAgent: (a: typeof mockAgents[0] | null) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>5 个活跃</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs">
            <span>1 个草稿</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-500/10 text-zinc-400 text-xs">
            <span>1 个停用</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--pc-accent)] text-zinc-900 text-sm font-medium hover:opacity-90 transition-all">
            <Plus size={16} />
            创建智能体
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pc-text-muted" />
          <input
            type="text"
            placeholder="搜索智能体..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-pc-border bg-[var(--pc-bg-surface)] text-sm text-pc-text placeholder:text-pc-text-muted outline-none focus:border-[var(--pc-accent-dim)]"
          />
        </div>
        <div className="flex items-center gap-1 bg-[var(--pc-bg-surface)] p-1 rounded-xl border border-pc-border">
          {['全部', '活跃', '草稿', '停用'].map((label, idx) => (
            <button
              key={idx}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                idx === 0 ? 'bg-[var(--pc-accent)] text-zinc-900' : 'text-pc-text-muted hover:text-pc-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockAgents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => setSelectedAgent(agent)}
            className={`group p-5 rounded-2xl border transition-all cursor-pointer ${
              selectedAgent?.id === agent.id
                ? 'bg-[var(--pc-accent-glow)] border-[var(--pc-accent-dim)]'
                : 'bg-[var(--pc-bg-surface)] border-pc-border hover:border-[var(--pc-accent-dim)]'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  agent.status === 'active' ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5' :
                  agent.status === 'draft' ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5' :
                  'bg-gradient-to-br from-zinc-500/20 to-zinc-500/5'
                }`}>
                  <Bot size={22} className={
                    agent.status === 'active' ? 'text-emerald-400' :
                    agent.status === 'draft' ? 'text-amber-400' : 'text-zinc-400'
                  } />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-pc-text">{agent.name}</h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    agent.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                    agent.status === 'draft' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-zinc-500/10 text-zinc-400'
                  }`}>
                    {agent.status === 'active' ? '运行中' : agent.status === 'draft' ? '草稿' : '已停用'}
                  </span>
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${statusColorMap[agent.status]} ${agent.status === 'active' ? 'animate-pulse' : ''}`} />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-[var(--pc-bg-base)]">
                <p className="text-lg font-bold text-pc-text">{agent.executions.toLocaleString()}</p>
                <p className="text-[10px] text-pc-text-muted">总执行次数</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--pc-bg-base)]">
                <p className={`text-lg font-bold ${agent.successRate >= 98 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {agent.successRate}%
                </p>
                <p className="text-[10px] text-pc-text-muted">成功率</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors">
                <Play size={12} />
                测试
              </button>
              <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                <Eye size={12} />
                查看
              </button>
              <button className="p-2 rounded-lg hover:bg-[var(--pc-hover)] text-pc-text-muted transition-colors">
                <Settings size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedAgent && (
        <div className="fixed bottom-6 right-6 w-96 p-5 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-pc-text">{selectedAgent.name}</h4>
            <button onClick={() => setSelectedAgent(null)} className="p-1 rounded-lg hover:bg-[var(--pc-hover)] text-pc-text-muted">
              <XCircle size={16} />
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--pc-bg-base)]">
              <span className="text-xs text-pc-text-muted">状态</span>
              <span className={`text-xs ${selectedAgent.status === 'active' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {selectedAgent.status === 'active' ? '运行中' : '草稿'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--pc-bg-base)]">
              <span className="text-xs text-pc-text-muted">总执行</span>
              <span className="text-xs text-pc-text">{selectedAgent.executions.toLocaleString()} 次</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--pc-bg-base)]">
              <span className="text-xs text-pc-text-muted">成功率</span>
              <span className="text-xs text-emerald-400">{selectedAgent.successRate}%</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--pc-bg-base)]">
              <span className="text-xs text-pc-text-muted">触发方式</span>
              <span className="text-xs text-pc-text">Manual / Cron</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TasksTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Target} label="总任务数" value={28} subtext="本周新增 5 个" color="violet" />
        <StatCard icon={CheckCircle} label="已完成" value={24} subtext="成功率 98.2%" trend="up" color="emerald" />
        <StatCard icon={Clock} label="执行中" value={2} subtext="预计 15:00 完成" color="amber" />
        <StatCard icon={AlertCircle} label="失败任务" value={2} subtext="需人工处理" color="cyan" />
      </div>

      <div className="p-5 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-pc-text flex items-center gap-2">
            <Target size={16} className="text-violet-400" />
            任务列表
          </h3>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors">
              <Filter size={12} />
              筛选
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--pc-accent)] text-zinc-900 text-xs font-medium hover:opacity-90 transition-all">
              <Plus size={14} />
              新建任务
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {[
            { name: '日报生成', type: 'Cron', status: 'completed', progress: 100, time: '08:00' },
            { name: '库存同步', type: 'Cron', status: 'running', progress: 65, time: '14:30' },
            { name: '会员积分结算', type: 'Cron', status: 'failed', progress: 30, time: '10:00' },
            { name: '订单数据导出', type: 'Manual', status: 'pending', progress: 0, time: '—' },
            { name: '物流跟踪更新', type: 'Auto', status: 'completed', progress: 100, time: '14:00' },
          ].map((task, idx) => (
            <div key={idx} className="flex items-center gap-4 p-4 rounded-xl bg-[var(--pc-bg-base)] hover:bg-[var(--pc-hover)] transition-colors">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                task.status === 'completed' ? 'bg-emerald-500/15' :
                task.status === 'running' ? 'bg-cyan-500/15' :
                task.status === 'failed' ? 'bg-red-500/15' :
                'bg-zinc-500/15'
              }`}>
                {task.status === 'completed' && <CheckCircle size={18} className="text-emerald-400" />}
                {task.status === 'running' && <Activity size={18} className="text-cyan-400 animate-pulse" />}
                {task.status === 'failed' && <XCircle size={18} className="text-red-400" />}
                {task.status === 'pending' && <Clock size={18} className="text-zinc-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-pc-text">{task.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--pc-bg-surface)] text-pc-text-muted">{task.type}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 rounded-full bg-[var(--pc-border)] overflow-hidden max-w-32">
                    <div
                      className={`h-full rounded-full ${
                        task.status === 'completed' ? 'bg-emerald-500' :
                        task.status === 'running' ? 'bg-cyan-500' :
                        task.status === 'failed' ? 'bg-red-500' :
                        'bg-zinc-500'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-pc-text-muted">{task.progress}%</span>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-xs ${
                  task.status === 'completed' ? 'text-emerald-400' :
                  task.status === 'running' ? 'text-cyan-400' :
                  task.status === 'failed' ? 'text-red-400' :
                  'text-pc-text-muted'
                }`}>
                  {task.status === 'completed' ? '已完成' :
                   task.status === 'running' ? '执行中' :
                   task.status === 'failed' ? '已失败' : '待执行'}
                </span>
                <p className="text-[10px] text-pc-text-muted">{task.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillsTab() {
  const categories = ['全部', '订单处理', '库存管理', '会员服务', '营销能力', 'AI能力'];
  const [activeCategory, setActiveCategory] = useState('全部');

  const filteredSkills = activeCategory === '全部'
    ? mockSkills
    : mockSkills.filter(s => s.category === activeCategory);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Brain} label="技能总数" value={35} subtext="12 个分类" color="violet" />
        <StatCard icon={CheckCircle} label="已启用" value={28} subtext="本周使用 1,247 次" color="emerald" />
        <StatCard icon={Star} label="调用量" value="8.2k" subtext="较上周 +12%" trend="up" color="amber" />
        <StatCard icon={AlertCircle} label="待配置" value={3} subtext="需审核" color="cyan" />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeCategory === cat
                ? 'bg-[var(--pc-accent)] text-zinc-900'
                : 'bg-[var(--pc-bg-surface)] border border-pc-border text-pc-text-secondary hover:bg-[var(--pc-hover)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredSkills.map((skill, idx) => (
          <div
            key={idx}
            className="group p-4 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border hover:border-[var(--pc-accent-dim)] transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  skill.status === 'enabled' ? 'bg-emerald-500/15' : 'bg-zinc-500/15'
                }`}>
                  <Brain size={18} className={skill.status === 'enabled' ? 'text-emerald-400' : 'text-zinc-400'} />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-pc-text">{skill.name}</h4>
                  <p className="text-[10px] text-pc-text-muted">{skill.category}</p>
                </div>
              </div>
              <button className={`p-1.5 rounded-lg transition-colors ${
                skill.status === 'enabled'
                  ? 'text-emerald-400 hover:bg-emerald-500/10'
                  : 'text-zinc-400 hover:bg-zinc-500/10'
              }`}>
                {skill.status === 'enabled' ? <CheckCircle size={14} /> : <Pause size={14} />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                skill.status === 'enabled' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-400'
              }`}>
                {skill.status === 'enabled' ? '已启用' : '已停用'}
              </span>
              {skill.usage > 0 && (
                <span className="text-xs text-pc-text-muted">调用 {skill.usage.toLocaleString()} 次</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
