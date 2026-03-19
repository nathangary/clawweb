import { useState } from 'react';
import { X, RefreshCw, Loader2 } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import { OverviewCards } from './OverviewCards';
import { SkillsList } from './SkillsList';
import { ChannelsList } from './ChannelsList';
import { CronList } from './CronList';
import type { NanobotApiClient } from '../../lib/nanobotApi';

interface Props {
  apiClient: NanobotApiClient | null;
  onClose: () => void;
}

type Tab = 'overview' | 'skills' | 'channels' | 'cron';

export function DashboardPanel({ apiClient, onClose }: Props) {
  const { data, fetchAll, toggleSkill, reloadConfig } = useDashboard(apiClient);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [reloading, setReloading] = useState(false);

  const handleReload = async () => {
    setReloading(true);
    await reloadConfig();
    setReloading(false);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'skills', label: 'Skills' },
    { id: 'channels', label: 'Channels' },
    { id: 'cron', label: 'Cron' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-2xl h-full bg-[var(--pc-bg-base)] border-l border-pc-border flex flex-col shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-pc-border bg-[var(--pc-bg-surface)]">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors"
            aria-label="Close dashboard"
          >
            <X size={18} />
          </button>
          <h2 className="text-sm font-semibold text-pc-text flex-1">Dashboard</h2>
          <button
            onClick={handleReload}
            disabled={reloading || data.loading}
            className="p-1.5 rounded-lg text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw size={16} className={reloading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex border-b border-pc-border bg-[var(--pc-bg-surface)]/50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-pc-accent-light border-b-2 border-pc-accent'
                  : 'text-pc-text-muted hover:text-pc-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {data.loading && data.sessions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-pc-text-muted">
              <Loader2 size={20} className="animate-spin mr-2" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : data.error ? (
            <div className="flex flex-col items-center justify-center h-32 text-red-400">
              <p className="text-sm mb-2">{data.error}</p>
              <button
                onClick={fetchAll}
                className="text-xs px-3 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewCards data={data} onTabChange={setActiveTab} />
              )}
              {activeTab === 'skills' && (
                <SkillsList skills={data.skills} onToggle={toggleSkill} />
              )}
              {activeTab === 'channels' && (
                <ChannelsList channels={data.channels} />
              )}
              {activeTab === 'cron' && (
                <CronList jobs={data.cronJobs} />
              )}
            </>
          )}
        </div>

        {data.lastUpdated && (
          <div className="px-4 py-2 border-t border-pc-border text-[10px] text-pc-text-faint">
            Last updated: {data.lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
