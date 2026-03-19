import { Radio, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import type { NanobotChannelStatus } from '../../lib/nanobotApi';

interface Props {
  channels: Record<string, NanobotChannelStatus>;
}

export function ChannelsList({ channels }: Props) {
  const entries = Object.entries(channels);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-pc-text-muted text-center py-4">
        No channels configured
      </p>
    );
  }

  const statusConfig = {
    connected: { icon: Wifi, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Connected' },
    disconnected: { icon: WifiOff, color: 'text-pc-text-muted', bg: 'bg-[var(--pc-hover)]', border: 'border-pc-border', label: 'Disconnected' },
    error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Error' },
  };

  return (
    <div className="space-y-2">
      {entries.map(([name, status]) => {
        const config = statusConfig[status.status] || statusConfig.disconnected;
        const StatusIcon = config.icon;

        return (
          <div
            key={name}
            className={`flex items-center gap-3 p-3 rounded-lg ${config.bg} border ${config.border}`}
          >
            <div className={`p-1.5 rounded-lg bg-[var(--pc-bg-surface)]`}>
              <Radio size={14} className={config.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-pc-text truncate">{name}</p>
              {status.last_seen && (
                <p className="text-[10px] text-pc-text-muted">
                  Last seen: {new Date(status.last_seen).toLocaleString()}
                </p>
              )}
            </div>
            <div className={`flex items-center gap-1.5 ${config.color}`}>
              <StatusIcon size={14} />
              <span className="text-xs font-medium">{config.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
