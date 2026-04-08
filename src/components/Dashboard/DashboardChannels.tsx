import { MessageCircle, Send, Globe, Hash, Wifi, WifiOff } from 'lucide-react';
import type { NanobotChannelStatus } from '../../lib/nanobotApi';

interface Props {
  channels: Record<string, NanobotChannelStatus>;
}

const channelIcons: Record<string, typeof MessageCircle> = {
  discord: MessageCircle,
  telegram: Send,
  whatsapp: MessageCircle,
  web: Globe,
  slack: Hash,
};

function getChannelIcon(name: string) {
  const key = name.toLowerCase().replace(/[_\s-]/g, '');
  return channelIcons[key] || Globe;
}

export function DashboardChannels({ channels }: Props) {
  const channelList = Object.entries(channels);
  const onlineCount = channelList.filter(([, status]) => status.status === 'connected').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-pc-text">渠道状态</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-pc-text-muted">在线</span>
          <span className="text-lg font-semibold text-emerald-400">{onlineCount}</span>
          <span className="text-sm text-pc-text-muted">/ {channelList.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {channelList.map(([name, status]) => {
          const Icon = getChannelIcon(name);
          const isConnected = status.status === 'connected';

          return (
            <div
              key={name}
              className={`p-5 rounded-xl border transition-all ${
                isConnected
                  ? 'bg-[var(--pc-bg-surface)] border-pc-border'
                  : 'bg-[var(--pc-bg-base)] border-pc-border'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${isConnected ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-[var(--pc-hover)]'}`}>
                    <Icon size={18} className={isConnected ? 'text-white' : 'text-pc-text-muted'} />
                  </div>
                  <span className="text-sm font-medium text-pc-text capitalize">{name}</span>
                </div>
                <div className={`flex items-center gap-1.5 text-xs ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                  <span>{isConnected ? '已连接' : '离线'}</span>
                </div>
              </div>

              {status.last_seen && (
                <div className="text-xs text-pc-text-muted">
                  最后活跃: {new Date(status.last_seen).toLocaleString()}
                </div>
              )}
            </div>
          );
        })}

        {channelList.length === 0 && (
          <div className="col-span-full text-center py-12 text-pc-text-muted">
            暂无渠道数据
          </div>
        )}
      </div>
    </div>
  );
}