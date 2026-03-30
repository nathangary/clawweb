import type { NanobotSession } from '../../lib/nanobotApi';

interface Props {
  sessions: NanobotSession[];
}

export function DashboardSessions({ sessions }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">会话列表</h3>
        <span className="text-sm text-white/40">共 {sessions.length} 个会话</span>
      </div>

      <div className="space-y-2">
        {sessions.map((session, idx) => {
          const isActive = session.updated_at
            ? Date.now() - new Date(session.updated_at).getTime() < 5 * 60 * 1000
            : false;
          const timeAgo = session.updated_at
            ? getTimeAgo(new Date(session.updated_at))
            : '未知';

          return (
            <div
              key={idx}
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
                  <span className="text-sm font-mono text-white/80">{session.key}</span>
                  {session.message_count || session.messageCount ? (
                    <span className="text-xs text-white/40 px-2 py-0.5 rounded bg-white/5">
                      {session.message_count || session.messageCount} 条消息
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-white/40">{timeAgo}</span>
              </div>
              {session.created_at && (
                <div className="mt-2 text-xs text-white/30">
                  创建于 {new Date(session.created_at).toLocaleString()}
                </div>
              )}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="text-center py-12 text-white/40">
            暂无会话数据
          </div>
        )}
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}