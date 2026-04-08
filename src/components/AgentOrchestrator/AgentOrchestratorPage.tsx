import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Clock, ChevronRight, GitBranch, ArrowRight, Trash2, Edit3, Play, Bot, Zap, GitFork, Circle, Square, Loader2, Search, Activity, CheckCircle, Power, PowerOff } from 'lucide-react';
import type { NanobotGatewayClient, NanobotOutboundEvent } from '../../lib/nanobotGateway';
import type { NanobotApiClient } from '../../lib/nanobotApi';
import { loadRules, saveRule, deleteRule, generateRuleId, invalidateRulesCache, updateRuleStatus, type Rule, type FlowNode, type FlowGraph } from '../../lib/rules';
import { ToastContainer, type Toast } from '../Toast';
import { CardSkeleton } from '../Skeleton';

interface GenerationMessage {
  id: string;
  type: 'progress' | 'tool_use' | 'tool_result' | 'thinking' | 'text' | 'final';
  content: string;
  name?: string;
  input?: Record<string, unknown>;
}

const RULE_SYSTEM_PROMPT = `请用agent-builder技能帮我生成流程规则`;

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
  const [showCreate, setShowCreate] = useState(false);
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showActivate, setShowActivate] = useState(false);
  const [activatingRule, setActivatingRule] = useState<Rule | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [activateMessages, setActivateMessages] = useState<GenerationMessage[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editMessages, setEditMessages] = useState<GenerationMessage[]>([]);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [genMessages, setGenMessages] = useState<GenerationMessage[]>([]);
  const [monitorStats, setMonitorStats] = useState<MonitorStats | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft' | 'disabled'>('all');
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
  }, [showToast]);

  const fetchMonitorStats = useCallback(async () => {
    if (!getApiClient) return;
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
    }
  }, [getApiClient]);

  useEffect(() => {
    fetchRules();
    fetchMonitorStats();
  }, [fetchRules, fetchMonitorStats]);

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

    client.setChatId(`agentloop-${Date.now()}`);

    setIsGenerating(true);
    setGenMessages([]);
    const fullMessage = `${RULE_SYSTEM_PROMPT}\n\n需求如下：${description}`;
    client.send(fullMessage);

    let handled = false;

    const handleRuleEvent = (event: NanobotOutboundEvent) => {
      if (handled) return;
      
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
            const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
            if (codeBlockMatch) {
              jsonStr = codeBlockMatch[1].trim();
            } else {
              const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
              if (braceMatch) {
                jsonStr = braceMatch[0];
              }
            }
            const parsed = JSON.parse(jsonStr);
            const ruleData = parsed.rule || parsed;
            
            const rawNodes = ruleData.flow?.nodes || [];
            const rawEdges = ruleData.flow?.edges || [];

            const normalizeNodes = (nodes: any[]): any[] => {
              return nodes.map(node => {
                const skillRef = ruleData.skills?.find((s: any) => s.skillId === node.skillId);
                return {
                  id: node.id || `node-${Math.random().toString(36).slice(2, 8)}`,
                  type: node.type === 'trigger' ? 'start' :
                        node.type === 'end' ? 'end' :
                        node.type === 'condition' ? 'condition' :
                        node.type === 'action' ? 'skill' : node.type,
                  label: node.label || node.name || skillRef?.name || '未命名',
                  skillId: node.skillId,
                  skillName: skillRef?.name || node.skillName || '',
                  index: node.index,
                  condition: node.expression || node.condition,
                  input: node.input,
                  output: node.output,
                };
              });
            };

            const normalizeEdges = (edges: any[], normalizedNodes: any[]): any[] => {
              const validEdges = edges.filter(e => (e.from && e.to) || (e.source && e.target));
              if (validEdges.length === 0 && normalizedNodes.length > 1) {
                const result: any[] = [];
                for (let i = 0; i < normalizedNodes.length - 1; i++) {
                  result.push({
                    id: `e-${normalizedNodes[i].id}-${normalizedNodes[i + 1].id}`,
                    source: normalizedNodes[i].id,
                    target: normalizedNodes[i + 1].id,
                    label: '',
                  });
                }
                return result;
              }
              return validEdges.map(edge => ({
                id: `e-${edge.from}-${edge.to}`,
                source: edge.from,
                target: edge.to,
                label: edge.label || (edge.condition ? (edge.condition === 'sufficient' ? '是' : '否') : ''),
              }));
            };

            const normalizedNodes = normalizeNodes(rawNodes);
            const normalizedEdges = normalizeEdges(rawEdges, normalizedNodes);
            
            const normalizeTriggerType = (t: string): 'manual' | 'cron' | 'webhook' => {
              if (t === 'cron' || t === 'schedule' || t === 'timed') return 'cron';
              if (t === 'webhook' || t === 'event') return 'webhook';
              return 'manual';
            };

            const newRule: Rule = {
              id: generateRuleId(),
              name: ruleData.name || '未命名规则',
              description: ruleData.description || description,
              status: 'draft',
              triggerType: normalizeTriggerType(ruleData.triggerType),
              triggerConfig: typeof ruleData.triggerConfig === 'string' ? ruleData.triggerConfig : JSON.stringify(ruleData.triggerConfig),
              variables: ruleData.variables || {},
              runCount: 0,
              successRate: 0,
              createdAt: new Date().toISOString(),
              skills: ruleData.skills || [],
              flow: {
                nodes: normalizedNodes,
                edges: normalizedEdges,
              },
              flowType: 'graph',
              systemPrompt: parsed.systemPrompt || '',
            };
            const saved = await saveRule(newRule);
            if (saved) {
              invalidateRulesCache();
              await fetchRules();
              await fetchMonitorStats();
              setDescription('');
              setShowCreate(false);
              showToast('success', `智能体「${saved.name}」已创建成功`, 4000);
              setSelectedRule(saved);
            } else {
              showToast('error', '智能体保存失败，请重试');
            }
          } catch (e) {
            console.error('解析规则失败:', e);
            showToast('error', '智能体生成失败，请重试');
          } finally {
            setIsGenerating(false);
            setGenMessages([]);
          }
        })();
      } else if (event.eventType === 'error') {
        handled = true;
        setIsGenerating(false);
        setGenMessages([]);
        showToast('error', '生成智能体时出错');
      }
    };

    const unsubscribe = client.onEvent(handleRuleEvent);
    eventHandlerRef.current = unsubscribe;
  };

  const handleActivateRule = async (rule: Rule) => {
    const client = getClient();
    if (!client) {
      showToast('error', '请先连接 Gateway');
      return;
    }

    client.setChatId(`agentloop-${Date.now()}`);

    setIsActivating(true);
    setActivateMessages([]);
    setActivatingRule(rule);
    const fullMessage = `请激活以下智能体规则：\n\n名称：${rule.name}\n描述：${rule.description}\n触发类型：${rule.triggerType}\n\n请执行激活操作并返回结果。`;
    client.send(fullMessage);

    let handled = false;

    const handleActivateEvent = (event: NanobotOutboundEvent) => {
      if (handled) return;

      if (event.eventType === 'progress') {
        const text = event.content;
        const toolHint = event.metadata?._tool_hint;
        const thinking = event.metadata?._thinking as string | undefined;

        setActivateMessages(prev => {
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
            setActivateMessages(prev => [...prev, { id: `tool-${event.eventId}`, type: 'tool_use', content: '', name: toolInfo.name, input: toolInfo.args }]);
          }
        }
        client.ack(event.eventId);
      } else if (event.eventType === 'final' && event.content) {
        handled = true;
        client.ack(event.eventId);
        (async () => {
          try {
            const newStatus = rule.status === 'disabled' ? 'active' : 'active';
            const updated = await updateRuleStatus(rule.id, newStatus);
            if (updated) {
              invalidateRulesCache();
              await fetchRules();
              await fetchMonitorStats();
              showToast('success', `智能体「${updated.name}」已激活`, 4000);
            } else {
              showToast('error', '激活失败，请重试');
            }
          } catch (e) {
            console.error('激活规则失败:', e);
            showToast('error', '激活智能体时出错');
          } finally {
            setIsActivating(false);
            setActivateMessages([]);
            setActivatingRule(null);
            setShowActivate(false);
          }
        })();
      } else if (event.eventType === 'error') {
        handled = true;
        setIsActivating(false);
        setActivateMessages([]);
        setActivatingRule(null);
        showToast('error', '激活智能体时出错');
      }
    };

    const unsubscribe = client.onEvent(handleActivateEvent);
    eventHandlerRef.current = unsubscribe;
  };

  const handleDeleteRule = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    const ok = await deleteRule(ruleId);
    if (ok) {
      invalidateRulesCache();
      await fetchRules();
      await fetchMonitorStats();
      showToast('success', `智能体「${rule?.name || '未知'}」已删除`);
    } else {
      showToast('error', '删除智能体失败');
    }
  };

  const handleToggleStatus = async (rule: Rule) => {
    const newStatus = rule.status === 'active' ? 'disabled' : 'active';
    const updated = await updateRuleStatus(rule.id, newStatus);
    if (updated) {
      invalidateRulesCache();
      await fetchRules();
      await fetchMonitorStats();
      showToast('success', `智能体「${updated.name}」已${newStatus === 'active' ? '启用' : '停用'}`);
    } else {
      showToast('error', '操作失败');
    }
  };

  const handleEditRule = async () => {
    if (!editDescription.trim() || !selectedRule) return;
    const client = getClient();
    if (!client) {
      showToast('error', '请先连接 Gateway');
      return;
    }

    client.setChatId(`agentloop-${Date.now()}`);
    setIsEditing(true);
    setEditMessages([]);

    const ruleContext = JSON.stringify({
      name: selectedRule.name,
      description: selectedRule.description,
      triggerType: selectedRule.triggerType,
      triggerConfig: selectedRule.triggerConfig,
      skills: selectedRule.skills,
      flow: selectedRule.flow,
      systemPrompt: selectedRule.systemPrompt,
    }, null, 2);

    const fullMessage = `请帮我修改以下智能体规则。当前规则如下：\n\n\`\`\`json\n${ruleContext}\n\`\`\`\n\n我的修改需求如下：${editDescription}\n\n请返回修改后的完整规则 JSON，格式与上面相同。`;
    client.send(fullMessage);

    let handled = false;

    const handleEditEvent = (event: NanobotOutboundEvent) => {
      if (handled) return;
      
      if (event.eventType === 'progress') {
        const text = event.content;
        const toolHint = event.metadata?._tool_hint;
        const thinking = event.metadata?._thinking as string | undefined;
        
        setEditMessages(prev => {
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
            setEditMessages(prev => [...prev, { id: `tool-${event.eventId}`, type: 'tool_use', content: '', name: toolInfo.name, input: toolInfo.args }]);
          }
        }
        client.ack(event.eventId);
      } else if (event.eventType === 'final' && event.content) {
        handled = true;
        client.ack(event.eventId);
        (async () => {
          try {
            let jsonStr = event.content.trim();
            const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
            if (codeBlockMatch) {
              jsonStr = codeBlockMatch[1].trim();
            } else {
              const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
              if (braceMatch) {
                jsonStr = braceMatch[0];
              }
            }
            const parsed = JSON.parse(jsonStr);
            const ruleData = parsed.rule || parsed;
            
            const rawNodes = ruleData.flow?.nodes || [];
            const rawEdges = ruleData.flow?.edges || [];

            const normalizeNodes = (nodes: any[]): any[] => {
              return nodes.map(node => {
                const skillRef = ruleData.skills?.find((s: any) => s.skillId === node.skillId);
                return {
                  id: node.id || `node-${Math.random().toString(36).slice(2, 8)}`,
                  type: node.type === 'trigger' ? 'start' :
                        node.type === 'end' ? 'end' :
                        node.type === 'condition' ? 'condition' :
                        node.type === 'action' ? 'skill' : node.type,
                  label: node.label || node.name || skillRef?.name || '未命名',
                  skillId: node.skillId,
                  skillName: skillRef?.name || node.skillName || '',
                  index: node.index,
                  condition: node.expression || node.condition,
                  input: node.input,
                  output: node.output,
                };
              });
            };

            const normalizeEdges = (edges: any[], normalizedNodes: any[]): any[] => {
              const validEdges = edges.filter(e => (e.from && e.to) || (e.source && e.target));
              if (validEdges.length === 0 && normalizedNodes.length > 1) {
                const result: any[] = [];
                for (let i = 0; i < normalizedNodes.length - 1; i++) {
                  result.push({
                    id: `e-${normalizedNodes[i].id}-${normalizedNodes[i + 1].id}`,
                    source: normalizedNodes[i].id,
                    target: normalizedNodes[i + 1].id,
                    label: '',
                  });
                }
                return result;
              }
              return validEdges.map(edge => ({
                id: `e-${edge.from}-${edge.to}`,
                source: edge.from,
                target: edge.to,
                label: edge.label || (edge.condition ? (edge.condition === 'sufficient' ? '是' : '否') : ''),
              }));
            };

            const normalizedNodes = normalizeNodes(rawNodes);
            const normalizedEdges = normalizeEdges(rawEdges, normalizedNodes);
            
            const normalizeTriggerType = (t: string): 'manual' | 'cron' | 'webhook' => {
              if (t === 'cron' || t === 'schedule' || t === 'timed') return 'cron';
              if (t === 'webhook' || t === 'event') return 'webhook';
              return 'manual';
            };

            const updatedRule: Rule = {
              ...selectedRule,
              name: ruleData.name || selectedRule.name,
              description: ruleData.description || selectedRule.description,
              triggerType: normalizeTriggerType(ruleData.triggerType || selectedRule.triggerType),
              triggerConfig: typeof ruleData.triggerConfig === 'string' ? ruleData.triggerConfig : JSON.stringify(ruleData.triggerConfig || selectedRule.triggerConfig),
              skills: ruleData.skills || selectedRule.skills,
              flow: {
                nodes: normalizedNodes,
                edges: normalizedEdges,
              },
              flowType: ruleData.flowType || selectedRule.flowType,
              systemPrompt: parsed.systemPrompt || selectedRule.systemPrompt,
            };

            const saved = await saveRule(updatedRule);
            if (saved) {
              invalidateRulesCache();
              await fetchRules();
              await fetchMonitorStats();
              setSelectedRule(saved);
              setShowEdit(false);
              showToast('success', `智能体「${saved.name}」已更新`, 4000);
            } else {
              showToast('error', '智能体保存失败，请重试');
            }
          } catch (e) {
            console.error('解析修改后的规则失败:', e);
            showToast('error', '规则修改失败，请重试');
          } finally {
            setIsEditing(false);
            setEditMessages([]);
            setEditDescription('');
          }
        })();
      } else if (event.eventType === 'error') {
        handled = true;
        setIsEditing(false);
        setEditMessages([]);
        showToast('error', '修改规则时出错');
      }
    };

    const unsubscribe = client.onEvent(handleEditEvent);
    eventHandlerRef.current = unsubscribe;
  };

  const filteredRules = rules.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
    }
    return true;
  });

  if (selectedRule) {
    return (
      <>
        <RuleDetail rule={selectedRule} onBack={() => setSelectedRule(null)} onEdit={() => { setShowEdit(true); setEditDescription(''); }} />
        {showEdit && (
          <EditRuleModal
            rule={selectedRule}
            onClose={() => { setShowEdit(false); setEditDescription(''); setIsEditing(false); setEditMessages([]); }}
            description={editDescription}
            setDescription={setEditDescription}
            isEditing={isEditing}
            editMessages={editMessages}
            onEdit={handleEditRule}
          />
        )}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--pc-bg-base)] flex flex-col overflow-hidden">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      {/* Header */}
      <header className="shrink-0 border-b border-pc-border bg-[var(--pc-bg-surface)]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1.5 rounded-xl bg-gradient-to-r from-cyan-400/15 to-violet-500/15 blur-lg" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20">
                <Bot size={18} className="text-pc-accent" />
              </div>
            </div>
            <div>
              <h1 className="font-semibold text-pc-text text-base">智能体编排</h1>
              <p className="text-[11px] text-pc-text-muted">用自然语言创建 AI 智能体</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--pc-accent)] text-zinc-900 text-sm font-medium hover:opacity-90 transition-all shadow-[0_4px_12px_rgba(var(--pc-accent-rgb),0.3)]">
              <Plus size={16} />创建智能体
            </button>
            <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-[var(--pc-hover)] text-pc-text-muted hover:text-pc-text transition-colors" aria-label="关闭">
              <X size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Stats Bar */}
        {monitorStats && (
          <div className="px-6 pt-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs">
                <Activity size={12} />
                <span>{monitorStats.active} 活跃</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--pc-accent-glow)] text-pc-accent text-xs">
                <Zap size={12} />
                <span>{monitorStats.totalExecutions} 执行</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-pc-text-muted text-xs">
                <CheckCircle size={12} />
                <span>{monitorStats.successRate}% 成功率</span>
              </div>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div className="px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pc-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索智能体..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--pc-bg-surface)] border border-pc-border text-sm text-pc-text placeholder:text-pc-text-muted outline-none focus:border-[var(--pc-accent-dim)] transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 bg-[var(--pc-bg-surface)] p-1 rounded-xl border border-pc-border">
            {([['all', '全部'], ['active', '活跃'], ['draft', '草稿'], ['disabled', '停用']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === key ? 'bg-[var(--pc-accent)] text-zinc-900' : 'text-pc-text-muted hover:text-pc-text'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Agent Grid */}
        <div className="px-6 pb-6">
          {rulesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : rulesError ? (
            <div className="text-center py-12">
              <p className="text-sm text-red-400 mb-3">{rulesError}</p>
              <button onClick={fetchRules} className="px-4 py-2 rounded-lg text-sm bg-[var(--pc-accent-glow)] text-pc-accent hover:opacity-80 transition-colors">重试</button>
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Bot size={48} className="text-pc-text-muted/30 mb-4" />
              <p className="text-pc-text-muted text-sm mb-1">
                {searchQuery || filterStatus !== 'all' ? '没有找到匹配的智能体' : '还没有智能体'}
              </p>
              <p className="text-pc-text-muted/60 text-xs mb-4">
                {searchQuery || filterStatus !== 'all' ? '试试调整筛选条件' : '点击上方按钮创建你的第一个智能体'}
              </p>
              {!searchQuery && filterStatus === 'all' && (
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--pc-accent)] text-zinc-900 text-sm font-medium hover:opacity-90 transition-all">
                  <Plus size={16} />创建智能体
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredRules.map((rule) => (
                <AgentCard
                  key={rule.id}
                  rule={rule}
                  onClick={() => setSelectedRule(rule)}
                  onDelete={() => handleDeleteRule(rule.id)}
                  onToggle={() => handleToggleStatus(rule)}
                  onActivate={() => handleActivateRule(rule)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Modal */}
      {showCreate && (
        <CreateModal
          onClose={() => { setShowCreate(false); setDescription(''); setIsGenerating(false); setGenMessages([]); }}
          description={description}
          setDescription={setDescription}
          isGenerating={isGenerating}
          genMessages={genMessages}
          onGenerate={handleGenerateRule}
        />
      )}

      {showActivate && activatingRule && (
        <ActivateModal
          rule={activatingRule}
          onClose={() => { setShowActivate(false); setActivatingRule(null); setIsActivating(false); setActivateMessages([]); }}
          isActivating={isActivating}
          messages={activateMessages}
        />
      )}
    </div>
  );
}

function AgentCard({ rule, onClick, onDelete, onToggle, onActivate }: { rule: Rule; onClick: () => void; onDelete: () => void; onToggle: () => void; onActivate: () => void }) {
  const statusColors = {
    active: 'bg-emerald-500',
    draft: 'bg-amber-500',
    disabled: 'bg-zinc-500',
  };

  const statusLabels = {
    active: '运行中',
    draft: '草稿',
    disabled: '已停用',
  };

  const triggerLabels = {
    manual: '手动',
    cron: '定时',
    webhook: 'Webhook',
  };

  const skillCount = rule.skills?.length || rule.flow?.nodes?.filter((n: FlowNode) => n.type === 'skill').length || 0;

  return (
    <div
      className="group relative rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border hover:border-[var(--pc-accent-dim)] transition-all cursor-pointer overflow-hidden"
      onClick={onClick}
    >
      {/* Status indicator */}
      <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${statusColors[rule.status]} ${rule.status === 'active' ? 'animate-pulse' : ''}`} />
      
      <div className="p-4">
        {/* Icon + Name */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            rule.status === 'active'
              ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5'
              : rule.status === 'draft'
              ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5'
              : 'bg-gradient-to-br from-zinc-500/20 to-zinc-500/5'
          }`}>
            <Bot size={18} className={
              rule.status === 'active' ? 'text-emerald-400' :
              rule.status === 'draft' ? 'text-amber-400' : 'text-zinc-400'
            } />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-pc-text truncate">{rule.name}</h3>
            <p className="text-xs text-pc-text-muted mt-0.5 line-clamp-2">{rule.description}</p>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-pc-text-muted mb-3">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {triggerLabels[rule.triggerType] || rule.triggerType}
          </span>
          {skillCount > 0 && (
            <span className="flex items-center gap-1">
              <Zap size={11} />
              {skillCount} 个技能
            </span>
          )}
          {rule.runCount > 0 && (
            <span>运行 {rule.runCount} 次</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-pc-border/50">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            rule.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
            rule.status === 'draft' ? 'bg-amber-500/10 text-amber-400' :
            'bg-zinc-500/10 text-zinc-400'
          }`}>
            {statusLabels[rule.status]}
          </span>
          <div className="flex items-center gap-1">
            {rule.status !== 'active' && (
              <button
                onClick={(e) => { e.stopPropagation(); onActivate(); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <Power size={11} />
                激活
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="p-1.5 rounded-lg hover:bg-[var(--pc-hover)] text-pc-text-muted hover:text-pc-text transition-colors"
              title={rule.status === 'active' ? '停用' : '启用'}
            >
              {rule.status === 'active' ? <PowerOff size={13} /> : <Power size={13} />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-pc-text-muted hover:text-red-400 transition-colors"
              title="删除"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateModal({ onClose, description, setDescription, isGenerating, genMessages, onGenerate }: {
  onClose: () => void;
  description: string;
  setDescription: (v: string) => void;
  isGenerating: boolean;
  genMessages: GenerationMessage[];
  onGenerate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[80vh] bg-[var(--pc-bg-surface)] rounded-2xl border border-pc-border shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 px-6 py-4 border-b border-pc-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-pc-text">创建智能体</h2>
              <p className="text-xs text-pc-text-muted mt-0.5">用自然语言描述需求，AI 自动编排流程</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--pc-hover)] text-pc-text-muted transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：当有新订单时，自动检查库存，如果库存不足则发送提醒通知采购部门..."
            className="w-full h-32 p-4 rounded-xl border border-pc-border bg-[var(--pc-bg-base)] text-pc-text placeholder:text-pc-text-muted outline-none focus:ring-2 focus:ring-[var(--pc-accent-dim)] focus:border-[var(--pc-accent-dim)] transition-all resize-none text-sm"
          />
          {isGenerating && genMessages.length > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-[var(--pc-bg-base)] border border-pc-border max-h-48 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-pc-text">
                <Loader2 size={14} className="animate-spin text-pc-accent" />
                <span>生成中...</span>
              </div>
              <div className="space-y-1.5">
                {genMessages.map((msg) => (
                  <div key={msg.id} className="text-xs">
                    {msg.type === 'thinking' && (
                      <div className="flex items-start gap-2 text-pc-text-muted">
                        <span>💭</span><span>{msg.content.slice(0, 150)}...</span>
                      </div>
                    )}
                    {msg.type === 'tool_use' && (
                      <div className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--pc-accent-glow)]/30">
                        <Zap size={11} className="text-pc-accent" />
                        <span className="text-pc-text">调用: {msg.name}</span>
                      </div>
                    )}
                    {msg.type === 'text' && (
                      <div className="text-pc-text-muted">{msg.content.slice(0, 80)}...</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 p-3 rounded-xl bg-[var(--pc-bg-base)] border border-pc-border">
            <h3 className="text-xs font-medium text-pc-text mb-2">示例</h3>
            <div className="flex flex-wrap gap-2">
              {['当有新订单时，自动检查库存并通知仓库备货', '每天早上9点汇总昨日销售数据生成报表', '客户提交工单时，自动识别问题类型并分配给对应部门'].map((example, idx) => (
                <button key={idx} onClick={() => setDescription(example)} className="text-left px-3 py-1.5 rounded-lg text-xs text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors">
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="shrink-0 px-6 py-4 border-t border-pc-border flex justify-end">
          <button
            onClick={onGenerate}
            disabled={!description.trim() || isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--pc-accent)] text-zinc-900 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_12px_rgba(var(--pc-accent-rgb),0.3)]"
          >
            {isGenerating ? (
              <><div className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" /><span>生成中...</span></>
            ) : (
              <><span>✨</span><span>生成智能体</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivateModal({ rule, onClose, isActivating, messages }: {
  rule: Rule;
  onClose: () => void;
  isActivating: boolean;
  messages: GenerationMessage[];
}) {
  return (
    <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[80vh] bg-[var(--pc-bg-surface)] rounded-2xl border border-pc-border shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 px-6 py-4 border-b border-pc-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-pc-text">激活智能体</h2>
              <p className="text-xs text-pc-text-muted mt-0.5">{rule.name}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--pc-hover)] text-pc-text-muted transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 p-4 rounded-xl bg-[var(--pc-bg-base)] border border-pc-border">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-2.5 h-2.5 rounded-full ${
                rule.status === 'active' ? 'bg-emerald-400' :
                rule.status === 'draft' ? 'bg-amber-400' : 'bg-zinc-400'
              }`} />
              <span className="text-sm text-pc-text font-medium">{rule.name}</span>
            </div>
            <p className="text-xs text-pc-text-muted">{rule.description}</p>
          </div>

          {isActivating && messages.length > 0 && (
            <div className="p-4 rounded-xl bg-[var(--pc-bg-base)] border border-pc-border max-h-64 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-pc-text">
                <Loader2 size={14} className="animate-spin text-pc-accent" />
                <span>激活中...</span>
              </div>
              <div className="space-y-1.5">
                {messages.map((msg) => (
                  <div key={msg.id} className="text-xs">
                    {msg.type === 'thinking' && (
                      <div className="flex items-start gap-2 text-pc-text-muted">
                        <span>💭</span><span>{msg.content.slice(0, 150)}...</span>
                      </div>
                    )}
                    {msg.type === 'tool_use' && (
                      <div className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--pc-accent-glow)]/30">
                        <Zap size={11} className="text-pc-accent" />
                        <span className="text-pc-text">调用: {msg.name}</span>
                      </div>
                    )}
                    {msg.type === 'text' && (
                      <div className="text-pc-text-muted">{msg.content.slice(0, 80)}...</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="shrink-0 px-6 py-4 border-t border-pc-border flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[var(--pc-accent)] text-zinc-900 text-sm font-medium hover:opacity-90 transition-all"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function EditRuleModal({ rule, onClose, description, setDescription, isEditing, editMessages, onEdit }: {
  rule: Rule;
  onClose: () => void;
  description: string;
  setDescription: (v: string) => void;
  isEditing: boolean;
  editMessages: GenerationMessage[];
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[80vh] bg-[var(--pc-bg-surface)] rounded-2xl border border-pc-border shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 px-6 py-4 border-b border-pc-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-pc-text">编辑智能体</h2>
              <p className="text-xs text-pc-text-muted mt-0.5">{rule.name} — 用自然语言描述修改需求</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--pc-hover)] text-pc-text-muted transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 p-4 rounded-xl bg-[var(--pc-bg-base)] border border-pc-border">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-2.5 h-2.5 rounded-full ${
                rule.status === 'active' ? 'bg-emerald-400' :
                rule.status === 'draft' ? 'bg-amber-400' : 'bg-zinc-400'
              }`} />
              <span className="text-sm text-pc-text font-medium">{rule.name}</span>
            </div>
            <p className="text-xs text-pc-text-muted">{rule.description}</p>
            <div className="mt-3 flex items-center gap-3 text-[10px] text-pc-text-muted">
              <span>{rule.skills?.length || 0} 个技能</span>
              <span>·</span>
              <span>{rule.flow?.nodes?.length || 0} 个节点</span>
            </div>
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：在库存检查后增加一个发送邮件通知的步骤..."
            className="w-full h-32 p-4 rounded-xl border border-pc-border bg-[var(--pc-bg-base)] text-pc-text placeholder:text-pc-text-muted outline-none focus:ring-2 focus:ring-[var(--pc-accent-dim)] focus:border-[var(--pc-accent-dim)] transition-all resize-none text-sm"
          />
          {isEditing && editMessages.length > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-[var(--pc-bg-base)] border border-pc-border max-h-48 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-pc-text">
                <Loader2 size={14} className="animate-spin text-pc-accent" />
                <span>修改中...</span>
              </div>
              <div className="space-y-1.5">
                {editMessages.map((msg) => (
                  <div key={msg.id} className="text-xs">
                    {msg.type === 'thinking' && (
                      <div className="flex items-start gap-2 text-pc-text-muted">
                        <span>💭</span><span>{msg.content.slice(0, 150)}...</span>
                      </div>
                    )}
                    {msg.type === 'tool_use' && (
                      <div className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--pc-accent-glow)]/30">
                        <Zap size={11} className="text-pc-accent" />
                        <span className="text-pc-text">调用: {msg.name}</span>
                      </div>
                    )}
                    {msg.type === 'text' && (
                      <div className="text-pc-text-muted">{msg.content.slice(0, 80)}...</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 p-3 rounded-xl bg-[var(--pc-bg-base)] border border-pc-border">
            <h3 className="text-xs font-medium text-pc-text mb-2">示例</h3>
            <div className="flex flex-wrap gap-2">
              {['在流程末尾增加一个发送邮件通知的步骤', '将触发方式改为每天早上9点定时执行', '在库存检查后增加一个条件判断，如果库存充足则跳过通知'].map((example, idx) => (
                <button key={idx} onClick={() => setDescription(example)} className="text-left px-3 py-1.5 rounded-lg text-xs text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors">
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="shrink-0 px-6 py-4 border-t border-pc-border flex justify-end">
          <button
            onClick={onEdit}
            disabled={!description.trim() || isEditing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--pc-accent)] text-zinc-900 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_12px_rgba(var(--pc-accent-rgb),0.3)]"
          >
            {isEditing ? (
              <><div className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" /><span>修改中...</span></>
            ) : (
              <><span>✨</span><span>确认修改</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleDetail({ rule, onBack, onEdit }: { rule: Rule; onBack: () => void; onEdit: () => void }) {
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');

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
            <button onClick={onEdit} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-pc-text-secondary hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors">
              <Edit3 size={14} />编辑规则
            </button>
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
          <FlowGraphView flow={rule.flow} />
        ) : (
          <FlowListView flow={rule.flow} />
        )}
      </main>
    </div>
  );
}

function FlowGraphView({ flow }: { flow: FlowGraph }) {
  const validEdges = flow.edges.filter(e => e.source && e.target);
  const conditionEdges = validEdges.filter(e => e.label);

  const nodeConfig: Record<string, { icon: typeof Bot; gradient: string; border: string; glow: string; accent: string; bgLight: string }> = {
    start: { icon: Circle, gradient: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/40', glow: 'shadow-emerald-500/10', accent: 'text-emerald-400', bgLight: 'bg-emerald-500/10' },
    end: { icon: Square, gradient: 'from-zinc-500/20 to-zinc-500/5', border: 'border-zinc-500/40', glow: 'shadow-zinc-500/10', accent: 'text-zinc-400', bgLight: 'bg-zinc-500/10' },
    condition: { icon: GitFork, gradient: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/40', glow: 'shadow-amber-500/10', accent: 'text-amber-400', bgLight: 'bg-amber-500/10' },
    skill: { icon: Bot, gradient: 'from-cyan-500/20 to-violet-500/10', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/10', accent: 'text-cyan-400', bgLight: 'bg-cyan-500/10' },
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="relative">
        {flow.nodes.map((node, idx) => {
          const cfg = nodeConfig[node.type] || nodeConfig.skill;
          const Icon = cfg.icon;
          const isLast = idx === flow.nodes.length - 1;
          const outgoingEdges = validEdges.filter(e => e.source === node.id);

          return (
            <div key={node.id} className="relative">
              <div className={`relative group rounded-2xl border bg-gradient-to-br ${cfg.gradient} ${cfg.border} shadow-lg ${cfg.glow} backdrop-blur-sm transition-all duration-300`}>
                <div className="flex items-center gap-4 p-4">
                  <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${cfg.gradient} ${cfg.border} border flex items-center justify-center shrink-0`}>
                    <Icon size={20} className={cfg.accent} />
                    {node.type === 'start' && <div className="absolute inset-0 rounded-xl bg-emerald-400/20 animate-pulse" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${cfg.accent} bg-[var(--pc-hover)]`}>
                        {node.type === 'start' ? '触发' : node.type === 'end' ? '结束' : node.type === 'condition' ? '条件' : '技能'}
                      </span>
                      {node.skillName && (
                        <>
                          <span className="text-xs text-pc-text-muted">·</span>
                          <span className="text-xs text-[var(--pc-accent)] font-medium">{node.skillName}</span>
                        </>
                      )}
                    </div>
                    <div className="text-sm text-pc-text font-medium">{node.label}</div>
                  </div>

                  {node.type !== 'start' && node.type !== 'end' && (
                    <div className="w-8 h-8 rounded-full bg-[var(--pc-hover)] border border-pc-border flex items-center justify-center text-xs text-pc-text-muted font-mono shrink-0">
                      {idx}
                    </div>
                  )}
                </div>

                {outgoingEdges.length > 0 && outgoingEdges.some(e => e.label) && (
                  <div className="px-4 pb-3 flex gap-2">
                    {outgoingEdges.filter(e => e.label).map((edge, i) => (
                      <span key={i} className="text-[10px] px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {edge.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {!isLast && (
                <div className="flex justify-center py-2">
                  <div className="relative flex flex-col items-center">
                    <div className="w-px h-6 bg-gradient-to-b from-[var(--pc-border-strong)] to-transparent" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--pc-border-strong)] -mt-0.5" />
                    <div className="w-px h-6 bg-gradient-to-b from-transparent to-[var(--pc-border-strong)]" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {conditionEdges.length > 0 && (
        <div className="mt-8 p-5 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border">
          <h4 className="text-sm font-medium text-pc-text-secondary mb-4 flex items-center gap-2">
            <GitFork size={14} className="text-amber-400" />
            条件分支
          </h4>
          <div className="space-y-2">
            {conditionEdges.map((edge, idx) => {
              const sourceNode = flow.nodes.find(n => n.id === edge.source);
              const targetNode = flow.nodes.find(n => n.id === edge.target);
              return (
                <div key={edge.id || `edge-${idx}`} className="flex items-center gap-3 text-sm">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium border border-amber-500/20">{edge.label}</span>
                  <span className="text-pc-text-muted">{sourceNode?.label || '?'} </span>
                  <ArrowRight size={12} className="text-pc-text-faint" />
                  <span className="text-pc-text-secondary">{targetNode?.label || '?'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-6 text-xs text-pc-text-muted">
        <div className="flex items-center gap-2"><Circle size={8} className="text-emerald-400" />开始</div>
        <div className="flex items-center gap-2"><Bot size={10} className="text-cyan-400" />技能</div>
        <div className="flex items-center gap-2"><GitFork size={10} className="text-amber-400" />条件</div>
        <div className="flex items-center gap-2"><Square size={8} className="text-zinc-400" />结束</div>
      </div>
    </div>
  );
}

function FlowListView({ flow }: { flow: FlowGraph }) {
  const allNodes = flow.nodes.filter(n => n.type !== 'start' && n.type !== 'end');

  if (allNodes.length === 0) {
    return <div className="text-center py-12 text-pc-text-muted">暂无流程步骤</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-1">
        {allNodes.map((node, idx) => (
          <div key={node.id} className="group relative">
            <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
              node.type === 'condition'
                ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/30'
                : 'bg-[var(--pc-bg-surface)] border-pc-border hover:border-[var(--pc-accent-dim)]'
            }`}>
              <div className="relative shrink-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  node.type === 'condition'
                    ? 'bg-amber-500/10 border border-amber-500/30'
                    : 'bg-cyan-500/10 border border-cyan-500/20'
                }`}>
                  {node.type === 'condition' ? (
                    <GitFork size={16} className="text-amber-400" />
                  ) : (
                    <span className="text-sm font-bold text-cyan-400">{idx + 1}</span>
                  )}
                </div>
                {idx < allNodes.length - 1 && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-px h-1 bg-gradient-to-b from-[var(--pc-border)] to-transparent" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    node.type === 'condition' ? 'text-amber-400 bg-amber-500/10' : 'text-cyan-400 bg-cyan-500/10'
                  }`}>
                    {node.type === 'condition' ? '条件' : '技能'}
                  </span>
                  {node.skillName && (
                    <span className="text-xs text-pc-text-muted">{node.skillName}</span>
                  )}
                </div>
                <div className="text-sm text-pc-text-secondary">{node.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
