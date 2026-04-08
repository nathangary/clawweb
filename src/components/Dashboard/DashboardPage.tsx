import { useState } from 'react';
import { Activity, Brain, Radio, Settings, RefreshCw, Loader2 } from 'lucide-react';
import { useDashboardPage } from '../../hooks/useDashboardPage';
import { DashboardOverview } from './DashboardOverview';
import { DashboardSkills } from './DashboardSkills';
import { DashboardChannels } from './DashboardChannels';
import { Skeleton } from '../Skeleton';
import type { NanobotApiClient } from '../../lib/nanobotApi';

interface Props {
  apiClient: NanobotApiClient | null;
  onClose: () => void;
  onOpenSkillMarket?: () => void;
  onOpenTasks?: () => void;
}

type TabId = 'overview' | 'skills' | 'channels';

interface NavItem {
  id: TabId;
  label: string;
  icon: typeof Activity;
}

const navItems: NavItem[] = [
  { id: 'overview', label: '系统概览', icon: Activity },
  { id: 'skills', label: '技能中心', icon: Brain },
  { id: 'channels', label: '渠道状态', icon: Radio },
];

export function DashboardPage({ apiClient, onClose, onOpenSkillMarket, onOpenTasks }: Props) {
  const { data, fetchAll, toggleSkill, reloadConfig } = useDashboardPage(apiClient);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [reloading, setReloading] = useState(false);

  const handleReload = async () => {
    setReloading(true);
    await reloadConfig();
    setReloading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--pc-bg-base)] flex overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(var(--pc-accent-rgb),0.08),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(var(--pc-accent-rgb),0.05),transparent_50%)]" />

      {/* 左侧导航 */}
      <nav className="relative w-56 flex flex-col border-r border-pc-border bg-[var(--pc-bg-surface)]/80 backdrop-blur-xl">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-pc-border">
          <div className="relative">
            <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-[var(--pc-accent)] to-violet-500 blur-lg opacity-50 dark:opacity-50" />
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--pc-accent)] to-violet-600 flex items-center justify-center">
              <Activity size={18} className="text-white" />
            </div>
          </div>
          <div>
            <h1 className="font-semibold text-pc-text text-sm">伯俊智能</h1>
            <p className="text-[10px] text-pc-text-muted">监控面板</p>
          </div>
        </div>

        {/* 导航项 */}
        <div className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
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

        {/* 底部操作 */}
        <div className="p-3 border-t border-pc-border">
          <button
            onClick={handleReload}
            disabled={reloading || data.loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={reloading ? 'animate-spin' : ''} />
            <span>刷新配置</span>
          </button>
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-2 rounded-lg text-xs text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors"
          >
            <Settings size={14} />
            <span>返回聊天</span>
          </button>
        </div>
      </nav>

      {/* 右侧内容区 */}
      <main className="relative flex-1 flex flex-col overflow-hidden">
        {/* 顶部状态栏 */}
        <header className="flex items-center justify-between h-14 px-6 border-b border-pc-border bg-[var(--pc-bg-surface)]/50">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-pc-text">
              {navItems.find(n => n.id === activeTab)?.label}
            </h2>
            {data.loading && (
              <Loader2 size={16} className="text-[var(--pc-accent)] animate-spin" />
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs text-pc-text-muted">系统在线</span>
            </div>
            <span className="text-xs text-pc-text-faint">
              {data.lastUpdated ? `更新于 ${data.lastUpdated.toLocaleTimeString()}` : ''}
            </span>
          </div>
        </header>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          {data.error ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-red-400 text-lg mb-2">加载失败</div>
              <p className="text-pc-text-muted text-sm mb-4">{data.error}</p>
              <button
                onClick={fetchAll}
                className="px-4 py-2 rounded-lg bg-[var(--pc-accent)]/20 text-[var(--pc-accent)] hover:bg-[var(--pc-accent)]/30 transition-colors"
              >
                重试
              </button>
            </div>
          ) : data.loading && !data.lastUpdated ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Skeleton className="h-48 rounded-2xl" />
                  <Skeleton className="h-64 rounded-2xl" />
                </div>
                <div className="space-y-6">
                  <Skeleton className="h-56 rounded-2xl" />
                  <Skeleton className="h-40 rounded-2xl" />
                </div>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && <DashboardOverview data={data} onTabChange={setActiveTab} onOpenTasks={onOpenTasks} />}
              {activeTab === 'skills' && <DashboardSkills skills={data.skills} onToggle={toggleSkill} onOpenMarket={onOpenSkillMarket} />}
              {activeTab === 'channels' && <DashboardChannels channels={data.channels} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}