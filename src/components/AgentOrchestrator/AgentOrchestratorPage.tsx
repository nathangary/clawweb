import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Settings, BarChart3, Clock, ChevronRight, GitBranch, ArrowRight, Trash2, Edit3, Play, GripVertical, Bot, Zap, GitFork, Circle, Square, Loader2 } from 'lucide-react';
import type { NanobotGatewayClient, NanobotOutboundEvent } from '../../lib/nanobotGateway';
import type { NanobotApiClient } from '../../lib/nanobotApi';
import { loadRules, saveRule, deleteRule, generateRuleId, invalidateRulesCache, type Rule, type FlowNode, type FlowGraph } from '../../lib/rules';
import { ToastContainer, type Toast } from '../Toast';
import { Skeleton, CardSkeleton } from '../Skeleton';

interface GenerationMessage {
  id: string;
  type: 'progress' | 'tool_use' | 'tool_result' | 'thinking' | 'text' | 'final';
  content: string;
  name?: string;
  input?: Record<string, unknown>;
}

const RULE_SYSTEM_PROMPT = `帮我生成一个场景，当我描述一个需求时，你需要：
1. 分析我的需求，设计合理的执行流程（顺序、分支、循环）
2. 确定需要使用的技能（可以是已有的，也可以是新的）
3. 生成流程图结构（nodes + edges）
4. 生成系统提示词（用于后续智能体对话）

输出格式要求：
请直接输出 JSON，格式如下：
{
  "rule": {
    "name": "规则名称",
    "description": "规则描述",
    "triggerType": "manual|cron|webhook",
    "triggerConfig": "触发配置",
    "skills": [{"skillId": "技能ID", "name": "技能名称", "params": {}}],
    "flow": {"nodes": [], "edges": []}
  },
  "systemPrompt": "系统提示词..."
}`;

interface MonitorStats {
  active: number;
  totalExecutions: number;
  successRate: number;
  total: number;
  draft: number;
  disabled: number;
}

interface Props {
  onClose: () => void;
  getClient: () => NanobotGatewayClient | null;
  getApiClient?: () => NanobotApiClient | null;
}

export function AgentOrchestratorPage({ onClose, getClient, getApiClient }: Props) {
  const [activeTab, setActiveTab] = useState<'create' | 'rules' | 'monitor'>('create');
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [genMessages, setGenMessages] = useState<GenerationMessage[]>([]);
  const [monitorStats, setMonitorStats] = useState<MonitorStats | null>(null);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const eventHandlerRef = useRef<(() => void) | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((type: Toast['type'], message: string, duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts(prev => [...prev, { id, type, message, duration }]);
    if (duration > 0) {
      setTimeout(() => dismissToast(id), duration);
    }
  }, [dismissToast]);

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    setRulesError(null);
    try {
      const data = await loadRules();
      setRules(data);
    } catch {
      setRulesError('加载规则失败，请检查网络连接');
      setRules([]);
      showToast('error', '加载规则失败');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  const fetchMonitorStats = useCallback(async () => {
    if (!getApiClient) return;
    setMonitorLoading(true);
    try {
      const client = getApiClient();
      if (client) {
        const res = await client.getRuleStats();
        if (res.applied && res.data) {
          setMonitorStats({
            active: res.data.active ?? 0,
            totalExecutions: res.data.totalExecutions ?? 0,
            successRate: res.data.successRate ?? 0,
            total: res.data.total ?? 0,
            draft: res.data.draft ?? 0,
            disabled: res.data.disabled ?? 0,
          });
        }
      }
    } catch {
      setMonitorStats(null);
    } finally {
      setMonitorLoading(false);
    }
  }, [getApiClient]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    if (activeTab === 'monitor') {
      fetchMonitorStats();
    }
  }, [activeTab, fetchMonitorStats]);

  useEffect(() => {
    return () => {
      if (eventHandlerRef.current) {
        eventHandlerRef.current();
      }
    };
  }, []);

  const extractToolInfo = (toolHint: string): { name: string; args: Record<string, unknown> } | null => {
    try {
      const match = toolHint.match(/^(\w+)\s*\(([\s\S]*)\)$/);
      if (match) {
        const name = match[1];
        let args: Record<string, unknown> = {};
        if (match[2].trim()) {
          try {
            args = JSON.parse(match[2].replace(/([a-zA-Z0-9_]+):/g, '"$1":'));
          } catch {
            args = { _raw: match[2] };
          }
        }
        return { name, args };
      }
    } catch {}
    return null;
  };

  const handleGenerateRule = async () => {
    if (!description.trim()) return;
    const client = getClient();
    if (!client) {
      showToast('error', '请先连接 Gateway');
      return;
    }

    setIsGenerating(true);
    setGenMessages([]);
    const fullMessage = `${RULE_SYSTEM_PROMPT}\n\n需求如下：${description}`;
    client.send(fullMessage);

    let handled = false;

    const handleRuleEvent = (event: NanobotOutboundEvent) => {
      if (handled) return;
      
      console.log('Rule event:', event.eventType, event);
      
      if (event.eventType === 'progress') {
        const text = event.content;
        const toolHint = event.metadata?._tool_hint;
        const thinking = event.metadata?._thinking as string | undefined;
        
        setGenMessages(prev => {
          const msgs = [...prev];
          if (thinking) {
            const thinkIdx = msgs.findIndex(m => m.type === 'thinking');
            if (thinkIdx >= 0) {
              msgs[thinkIdx] = { ...msgs[thinkIdx], content: thinking };
            } else {
              msgs.push({ id: `thinking-${event.eventId}`, type: 'thinking', content: thinking });
            }
          }
          if (toolHint && typeof toolHint === 'string') {
            const toolInfo = extractToolInfo(toolHint);
            if (toolInfo) {
              msgs.push({ id: `tool-${event.eventId}`, type: 'tool_use', content: '', name: toolInfo.name, input: toolInfo.args });
            }
          }
          if (text) {
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.type === 'text') {
              msgs[msgs.length - 1] = { ...lastMsg, content: lastMsg.content + text };
            } else {
              msgs.push({ id: `text-${event.eventId}`, type: 'text', content: text });
            }
          }
          return msgs;
        });
        client.ack(event.eventId);
      } else if (event.eventType === 'tool_hint') {
        const toolContent = event.content;
        if (toolContent) {
          const toolInfo = extractToolInfo(toolContent);
          if (toolInfo) {
            setGenMessages(prev => [...prev, { id: `tool-${event.eventId}`, type: 'tool_use', content: '', name: toolInfo.name, input: toolInfo.args }]);
          }
        }
        client.ack(event.eventId);
      } else if (event.eventType === 'final' && event.content) {
        handled = true;
        client.ack(event.eventId);
        (async () => {
          try {
            let jsonStr = event.content.trim();
            
            if (jsonStr.startsWith('```')) {
              jsonStr = jsonStr.replace(/```(?:json)?\n?/g, '').trim();
            }
            
            const parsed = JSON.parse(jsonStr);
            const ruleData = parsed.rule || parsed;
            
            const normalizeNodes = (nodes: any[]): any[] => {
              return nodes.map(node => ({
                id: node.id || node.name || String(Math.random()),
                type: node.type === 'trigger' ? 'start' : 
                      node.type === 'end' ? 'end' : 
                      node.type === 'condition' ? 'condition' : 
                      node.type === 'action' ? 'skill' : node.type,
                label: node.label || node.name || '未命名',
                skillId: node.config?.skillId || node.skillId,
                skillName: node.name,
              }));
            };
            
            const normalizeEdges = (edges: any[]): any[] => {
              return edges.map(edge => ({
                id: `e-${edge.from}-${edge.to}`,
                source: edge.from,
                target: edge.to,
                label: edge.label || (edge.condition ? (edge.condition === 'sufficient' ? '是' : '否') : ''),
              }));
            };
            
            const newRule: Rule = {
              id: generateRuleId(),
              name: ruleData.name || '未命名规则',
              description: ruleData.description || description,
              status: 'draft',
              triggerType: ruleData.triggerType || 'manual',
              triggerConfig: typeof ruleData.triggerConfig === 'string' ? ruleData.triggerConfig : JSON.stringify(ruleData.triggerConfig),
              runCount: 0,
              successRate: 0,
              createdAt: new Date().toISOString(),
              skills: ruleData.skills || [],
              flow: {
                nodes: normalizeNodes(ruleData.flow?.nodes || []),
                edges: normalizeEdges(ruleData.flow?.edges || []),
              },
              flowType: 'graph',
              systemPrompt: parsed.systemPrompt || '',
            };
            const saved = await saveRule(newRule);
            if (saved) {
              invalidateRulesCache();
              await fetchRules();
              setDescription('');
              showToast('success', `规则「${saved.name}」已创建成功`, 4000);
              setSelectedRule(saved);
            } else {
              showToast('error', '规则保存失败，请重试');
            }
          } catch (e) {
            console.error('解析规则失败:', e);
            console.error('原始内容:', event.content);
            showToast('error', '规则生成失败，请重试');
          } finally {
            setIsGenerating(false);
            setGenMessages([]);
          }
        })();
      } else if (event.eventType === 'error') {
        handled = true;
        setIsGenerating(false);
        setGenMessages([]);
        showToast('error', '生成规则时出错');
      }
    };

    const unsubscribe = client.onEvent(handleRuleEvent);
    eventHandlerRef.current = unsubscribe;
  };

  const handleDeleteRule = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    const ok = await deleteRule(ruleId);
    if (ok) {
      invalidateRulesCache();
      await fetchRules();
      showToast('success', `规则「${rule?.name || '未知'}」已删除`);
    } else {
      showToast('error', '删除规则失败');
    }
  };

  const displayedRules = rules.length > 0 ? rules : [];

  if (selectedRule) {
    return <RuleDetail rule={selectedRule} onBack={() => setSelectedRule(null)} />;
  }

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--pc-bg-base)] flex flex-col overflow-hidden">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <header className="shrink-0 border-b border-pc-border bg-[var(--pc-bg-surface)]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1.5 rounded-xl bg-gradient-to-r from-cyan-400/15 to-violet-500/15 blur-lg" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden">
                <span className="text-2xl">🤖</span>
              </div>
            </div>
            <div>
              <h1 className="font-semibold text-pc-text text-base">智能体编排</h1>
              <p className="text-[11px] text-pc-text-muted">用自然语言创建 AI 智能体</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-[var(--pc-hover)] text-pc-text-muted hover:text-pc-text transition-colors" aria-label="关闭">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 pb-4">
          <div className="flex items-center gap-1 bg-[var(--pc-bg-base)]/50 p-1 rounded-xl border border-pc-border">
            <button onClick={() => setActiveTab('create')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'create' ? 'bg-[var(--pc-accent)] text-zinc-900 shadow-[0_2px_8px_rgba(var(--pc-accent-rgb),0.2)]' : 'text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]'}`}>
              <Plus size={14} className="inline mr-1.5" />创建规则
            </button>
            <button onClick={() => setActiveTab('rules')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'rules' ? 'bg-[var(--pc-accent)] text-zinc-900 shadow-[0_2px_8px_rgba(var(--pc-accent-rgb),0.2)]' : 'text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]'}`}>
              <Settings size={14} className="inline mr-1.5" />规则管理
            </button>
            <button onClick={() => setActiveTab('monitor')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'monitor' ? 'bg-[var(--pc-accent)] text-zinc-900 shadow-[0_2px_8px_rgba(var(--pc-accent-rgb),0.2)]' : 'text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]'}`}>
              <BarChart3 size={14} className="inline mr-1.5" />监控
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-6">
        {activeTab === 'create' && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <h2 className="text-lg font-medium text-pc-text mb-2">描述你想要实现的功能</h2>
              <p className="text-sm text-pc-text-muted">用自然语言描述你的需求，AI 会自动帮你选择技能并编排流程</p>
            </div>
            <div className="relative">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例如：当有新订单时，自动检查库存，如果库存不足则发送提醒通知采购部门..." className="w-full h-40 p-4 rounded-2xl border border-pc-border bg-[var(--pc-bg-surface)] text-pc-text placeholder:text-pc-text-muted outline-none focus:ring-2 focus:ring-[var(--pc-accent-dim)] focus:border-[var(--pc-accent-dim)] transition-all resize-none" />
              <button onClick={handleGenerateRule} disabled={!description.trim() || isGenerating} className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--pc-accent)] text-zinc-900 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_12px_rgba(var(--pc-accent-rgb),0.3)]">
                {isGenerating ? (<><div className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" /><span>生成中...</span></>) : (<><span>✨</span><span>生成规则</span></>)}
              </button>
            </div>
            {isGenerating && genMessages.length > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-[var(--pc-bg-surface)] border border-pc-border max-h-64 overflow-y-auto">
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-pc-text">
                  <Loader2 size={14} className="animate-spin text-pc-accent" /><span>生成过程</span>
                </div>
                <div className="space-y-2">
                  {genMessages.map((msg) => (
                    <div key={msg.id} className="text-sm">
                      {msg.type === 'thinking' && (<div className="flex items-start gap-2"><span className="text-pc-accent">💭</span><span className="text-pc-text-muted text-xs">{msg.content.slice(0, 200)}...</span></div>)}
                      {msg.type === 'tool_use' && (<div className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--pc-accent-glow)]/30"><Zap size={12} className="text-pc-accent" /><span className="text-pc-text text-xs">调用工具: {msg.name}</span></div>)}
                      {msg.type === 'text' && (<div className="text-pc-text text-xs">{msg.content.slice(0, 100)}...</div>)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-8 p-4 rounded-xl bg-[var(--pc-bg-surface)] border border-pc-border">
              <h3 className="text-sm font-medium text-pc-text mb-3">使用示例</h3>
              <div className="flex flex-col gap-2">
                {['当有新订单时，自动检查库存并通知仓库备货', '每天早上9点汇总昨日销售数据生成报表', '客户提交工单时，自动识别问题类型并分配给对应部门', '检测到网站异常时自动发送告警并创建故障工单'].map((example, idx) => (
                  <button key={idx} onClick={() => setDescription(example)} className="text-left px-3 py-2 rounded-lg text-sm text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors">{example}</button>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'rules' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-pc-text">已创建的规则</h2>
              <span className="text-sm text-pc-text-muted">{displayedRules.length} 个规则</span>
            </div>
            {rulesLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            ) : rulesError ? (
              <div className="text-center py-12">
                <p className="text-sm text-red-400 mb-3">{rulesError}</p>
                <button onClick={fetchRules} className="px-4 py-2 rounded-lg text-sm bg-[var(--pc-accent-glow)] text-pc-accent hover:opacity-80 transition-colors">重试</button>
              </div>
            ) : displayedRules.length === 0 ? (
              <div className="text-center py-12 text-pc-text-muted">暂无规则，请先创建</div>
            ) : (
              <div className="flex flex-col gap-3">
                {displayedRules.map((rule) => (
                  <div key={rule.id} onClick={() => setSelectedRule(rule)} className="p-4 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border hover:border-[var(--pc-accent-dim)] transition-colors cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-medium text-pc-text">{rule.name}</h3>
                        <p className="text-xs text-pc-text-muted mt-1">{rule.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteRule(rule.id); }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-pc-text-muted hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-pc-text-muted">
                        <span className="flex items-center gap-1"><Clock size={12} />{rule.triggerType === 'manual' ? '手动触发' : rule.triggerType === 'cron' ? '定时触发' : 'Webhook'}</span>
                        <span>运行 {rule.runCount} 次</span>
                        <span>成功率 {rule.successRate}%</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-pc-accent"><span>查看流程</span><ChevronRight size={12} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'monitor' && (
          <div>
            {monitorLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
              </div>
            ) : monitorStats ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="p-4 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border"><div className="text-2xl font-semibold text-pc-text">{monitorStats.active}</div><div className="text-sm text-pc-text-muted">活跃规则</div></div>
                  <div className="p-4 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border"><div className="text-2xl font-semibold text-pc-text">{monitorStats.totalExecutions}</div><div className="text-sm text-pc-text-muted">总执行次数</div></div>
                  <div className="p-4 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border"><div className="text-2xl font-semibold text-pc-text">{monitorStats.successRate}%</div><div className="text-sm text-pc-text-muted">成功率</div></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border"><div className="text-2xl font-semibold text-pc-text">{monitorStats.total}</div><div className="text-sm text-pc-text-muted">规则总数</div></div>
                  <div className="p-4 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border"><div className="text-2xl font-semibold text-pc-text">{monitorStats.draft}</div><div className="text-sm text-pc-text-muted">草稿</div></div>
                  <div className="p-4 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border"><div className="text-2xl font-semibold text-pc-text">{monitorStats.disabled}</div><div className="text-sm text-pc-text-muted">已禁用</div></div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-pc-text-muted">
                <p className="mb-3">监控数据暂不可用</p>
                <button onClick={fetchMonitorStats} className="px-4 py-2 rounded-lg text-sm bg-[var(--pc-accent-glow)] text-pc-accent hover:opacity-80 transition-colors">刷新</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function RuleDetail({ rule, onBack }: { rule: Rule; onBack: () => void }) {
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--pc-bg-base)] flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border bg-[var(--pc-bg-surface)]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-[var(--pc-hover)] text-pc-text-muted transition-colors">
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-pc-text">{rule.name}</h1>
              <p className="text-[11px] text-pc-text-muted">{rule.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-xl text-sm text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors">取消</button>
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-xl bg-[var(--pc-accent)] text-zinc-900 text-sm font-medium hover:opacity-90 transition-all">保存</button>
              </>
            ) : (
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-pc-text-secondary hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors">
                <Edit3 size={14} />编辑规则
              </button>
            )}
          </div>
        </div>
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-[var(--pc-bg-base)]/50 p-1 rounded-xl border border-pc-border">
              <button onClick={() => setViewMode('graph')} className={`flex-1 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'graph' ? 'bg-[var(--pc-accent)] text-zinc-900' : 'text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]'}`}>
                <GitBranch size={14} className="inline mr-1.5" />流程图
              </button>
              <button onClick={() => setViewMode('list')} className={`flex-1 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-[var(--pc-accent)] text-zinc-900' : 'text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]'}`}>
                <ArrowRight size={14} className="inline mr-1.5" />步骤列表
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-pc-text-secondary hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors">
                <Play size={14} />测试运行
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-6">
        {viewMode === 'graph' ? (
          <FlowGraphView flow={rule.flow} isEditing={isEditing} />
        ) : (
          <FlowListView flow={rule.flow} isEditing={isEditing} />
        )}
      </main>
    </div>
  );
}

function FlowGraphView({ flow, isEditing }: { flow: FlowGraph; isEditing: boolean }) {
  const renderNode = (node: FlowNode) => {
    switch (node.type) {
      case 'start': return (<div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-400" /><span className="text-xs text-emerald-400 font-medium">{node.label}</span></div>);
      case 'end': return (<div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-zinc-500" /><span className="text-xs text-zinc-400 font-medium">{node.label}</span></div>);
      case 'condition': return (<div className="flex items-center gap-2"><GitFork size={14} className="text-amber-400 shrink-0" /><div><div className="text-xs text-amber-400 font-medium">条件判断</div><div className="text-sm text-pc-text">{node.label}</div></div></div>);
      case 'skill': return (<div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-[var(--pc-accent-glow)] flex items-center justify-center shrink-0"><Bot size={14} className="text-pc-accent" /></div><div><div className="text-xs text-pc-accent font-medium">{node.skillName}</div><div className="text-sm text-pc-text">{node.label}</div></div></div>);
      default: return null;
    }
  };

  const getNodeStyle = (node: FlowNode) => {
    switch (node.type) {
      case 'start': return 'bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border-emerald-500/30';
      case 'end': return 'bg-gradient-to-r from-zinc-500/10 to-zinc-500/5 border-zinc-500/30';
      case 'condition': return 'bg-gradient-to-r from-amber-500/10 to-amber-500/5 border-amber-500/30';
      case 'skill': return 'bg-gradient-to-r from-[var(--pc-accent-glow)] to-transparent border-[var(--pc-accent-dim)]';
      default: return 'bg-[var(--pc-bg-surface)] border-pc-border';
    }
  };

  const edges = flow.edges;
  const conditionEdges = edges.filter(e => e.label);

  return (
    <div className="space-y-6">
      <div className="relative overflow-x-auto pb-8">
        <div className="flex items-center justify-center gap-3 min-w-max px-4">
          {flow.nodes.map((node, idx) => (
            <div key={node.id} className="flex items-center">
              <div className={`relative px-4 py-3 rounded-xl border-2 transition-all ${getNodeStyle(node)} ${isEditing ? 'cursor-pointer hover:scale-105' : ''}`}>
                {renderNode(node)}
              </div>
              {idx < flow.nodes.length - 1 && (
                <div className="relative flex items-center mx-1">
                  <div className="h-px w-8 bg-gradient-to-r from-pc-border to-pc-border" />
                  {conditionEdges.find(e => e.source === node.id) ? (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                      {conditionEdges.find(e => e.source === node.id)?.label}
                    </div>
                  ) : (
                    <Zap size={12} className="text-pc-text-muted absolute left-1/2 -translate-x-1/2 -top-1" />
                  )}
                  <div className="h-px w-8 bg-gradient-to-r from-pc-border to-pc-border" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {conditionEdges.length > 0 && (
        <div className="p-4 rounded-xl bg-[var(--pc-bg-surface)] border border-pc-border">
          <h4 className="text-sm font-medium text-pc-text mb-3 flex items-center gap-2"><GitFork size={14} className="text-amber-400" />条件分支逻辑</h4>
          <div className="space-y-2">
            {conditionEdges.map((edge, idx) => {
              const sourceNode = flow.nodes.find(n => n.id === edge.source);
              const targetNode = flow.nodes.find(n => n.id === edge.target);
              return (
                <div key={edge.id || `edge-${idx}`} className="flex items-center gap-3 text-sm">
                  <div className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-medium text-xs">{edge.label}</div>
                  <span className="text-pc-text-muted">{sourceNode?.label || '未知'} → {targetNode?.label || '未知'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20"><div className="flex items-center gap-2 text-xs text-emerald-400 mb-1"><Circle size={8} className="fill-current" /><span>开始节点</span></div><div className="text-xs text-pc-text-muted">流程入口</div></div>
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20"><div className="flex items-center gap-2 text-xs text-amber-400 mb-1"><GitFork size={8} /><span>条件节点</span></div><div className="text-xs text-pc-text-muted">分支判断</div></div>
        <div className="p-3 rounded-xl bg-[var(--pc-accent-glow)] border border-[var(--pc-accent-dim)]"><div className="flex items-center gap-2 text-xs text-pc-accent mb-1"><Bot size={8} /><span>技能节点</span></div><div className="text-xs text-pc-text-muted">执行动作</div></div>
      </div>
    </div>
  );
}

function FlowListView({ flow, isEditing }: { flow: FlowGraph; isEditing: boolean }) {
  const skillNodes = flow.nodes.filter(n => n.type === 'skill');
  return (
    <div className="flex flex-col gap-3">
      {skillNodes.map((node, idx) => (
        <div key={node.id} className="relative flex items-center gap-4 p-4 rounded-xl bg-[var(--pc-bg-surface)] border border-pc-border group">
          {idx > 0 && <div className="absolute left-[3.25rem] -top-3 w-px h-3 bg-gradient-to-b from-pc-border to-transparent" />}
          {idx < skillNodes.length - 1 && <div className="absolute left-[3.25rem] -bottom-3 w-px h-3 bg-gradient-to-b from-pc-border to-transparent" />}
          <div className="flex items-center gap-3">
            {isEditing && <GripVertical size={16} className="text-pc-text-muted cursor-grab hover:text-pc-text" />}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--pc-accent-glow)] to-[var(--pc-accent)]/10 flex items-center justify-center ring-1 ring-[var(--pc-accent-dim)]">
              <span className="text-sm font-semibold text-pc-accent">{idx + 1}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-pc-accent font-medium mb-0.5">{node.skillName}</div>
            <div className="text-sm text-pc-text truncate">{node.label}</div>
          </div>
          {isEditing && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-2 rounded-lg hover:bg-[var(--pc-hover)] text-pc-text-muted hover:text-pc-text"><Edit3 size={14} /></button>
              <button className="p-2 rounded-lg hover:bg-red-500/10 text-pc-text-muted hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          )}
        </div>
      ))}
      <div className="flex items-center gap-3 mt-4 text-xs text-pc-text-muted">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400"><Circle size={8} className="fill-current" /><span>开始</span></div>
        {skillNodes.map((_, idx) => <ArrowRight key={idx} size={12} />)}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-500/10 text-zinc-400"><Square size={8} /><span>结束</span></div>
      </div>
      {skillNodes.length === 0 && <div className="text-center py-12 text-pc-text-muted">暂无流程步骤</div>}
    </div>
  );
}
