import { Clock, MessageSquare, Sparkles, AlertTriangle } from 'lucide-react';
import type { CronLogEntry } from '../../lib/nanobotApi';

interface Props {
  logs: CronLogEntry[];
}

export function ExecutionTimeline({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Clock size={20} className="text-pc-text-faint mb-2" />
        <p className="text-pc-text-muted text-xs">暂无执行记录</p>
      </div>
    );
  }

  const groups = groupLogsByRequest(logs);

  return (
    <div className="space-y-3">
      {groups.map((group, idx) => (
        <TimelineNode key={idx} group={group} />
      ))}
    </div>
  );
}

function TimelineNode({ group }: { group: LogGroup }) {
  const lastMsg = group.messages[group.messages.length - 1];
  const firstMsg = group.messages[0];
  const hasError = group.messages.some(m => m.role === 'tool' && m.content.toLowerCase().includes('error'));
  const startTime = firstMsg.timestamp ? new Date(firstMsg.timestamp).getTime() : 0;
  const endTime = lastMsg.timestamp ? new Date(lastMsg.timestamp).getTime() : 0;
  const duration = startTime && endTime ? Math.round((endTime - startTime) / 1000) : null;
  const toolCalls = group.messages.flatMap(m => m.tool_calls || []);

  return (
    <div className="rounded-xl bg-[var(--pc-bg-surface)] border border-pc-border overflow-hidden">
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full ${hasError ? 'bg-red-400' : 'bg-emerald-400'}`} />
          <span className="text-xs text-pc-text-secondary font-mono">
            {firstMsg.timestamp ? new Date(firstMsg.timestamp).toLocaleString() : '未知时间'}
          </span>
          {duration !== null && (
            <span className="text-[10px] text-pc-text-faint">({duration}s)</span>
          )}
          {hasError && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 flex items-center gap-1">
              <AlertTriangle size={8} />
              异常
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-pc-text-muted mb-2">
          <span className="flex items-center gap-1">
            <MessageSquare size={10} />
            {group.messages.length} 条消息
          </span>
          {toolCalls.length > 0 && (
            <span className="flex items-center gap-1">
              <Sparkles size={10} />
              {toolCalls.length} 次工具调用
            </span>
          )}
        </div>

        <div className="space-y-1">
          {group.messages.slice(0, 8).map((msg, i) => (
            <MessageItem key={i} msg={msg} />
          ))}
          {group.messages.length > 8 && (
            <div className="text-[10px] text-pc-text-faint text-center py-1">
              +{group.messages.length - 8} 更多
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageItem({ msg }: { msg: CronLogEntry }) {
  const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;
  const isSubagent = msg.metadata?.subagent_task_id;

  return (
    <div className="flex items-start gap-2 text-[10px]">
      <span className={`shrink-0 w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold ${
        msg.role === 'user' ? 'bg-blue-500/20 text-blue-400' :
        hasToolCalls || isSubagent ? 'bg-violet-500/20 text-violet-400' :
        'bg-emerald-500/20 text-emerald-400'
      }`}>
        {msg.role === 'user' ? 'U' : hasToolCalls ? 'A' : 'T'}
      </span>
      <span className="text-pc-text-muted truncate flex-1">
        {msg.content.slice(0, 80)}{msg.content.length > 80 ? '...' : ''}
      </span>
    </div>
  );
}

interface LogGroup {
  requestId: string;
  messages: CronLogEntry[];
}

function groupLogsByRequest(logs: CronLogEntry[]): LogGroup[] {
  const groups: LogGroup[] = [];
  let currentGroup: LogGroup | null = null;

  for (const log of logs) {
    const requestId = log.metadata?.request_id || 'unknown';
    if (!currentGroup || currentGroup.requestId !== requestId) {
      if (currentGroup && currentGroup.messages.length > 0) groups.push(currentGroup);
      currentGroup = { requestId, messages: [log] };
    } else {
      currentGroup.messages.push(log);
    }
  }
  if (currentGroup && currentGroup.messages.length > 0) groups.push(currentGroup);
  return groups.reverse();
}
