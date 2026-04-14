import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Clock, ChevronRight, GitBranch, ArrowRight, Trash2, Edit3, Play, Bot, Zap, GitFork, Loader2, Search, Activity, CheckCircle, Power, PowerOff } from 'lucide-react';
import type { NanobotGatewayClient, NanobotOutboundEvent } from '../../lib/nanobotGateway';
import type { NanobotApiClient } from '../../lib/nanobotApi';
import { loadRules, deleteRule, generateRuleId, invalidateRulesCache, updateRuleStatus, type Rule, type FlowNode, type FlowGraph } from '../../lib/rules';
import { ToastContainer, type Toast } from '../Toast';
import { CardSkeleton } from '../Skeleton';
import { LazyMarkdown } from '../LazyMarkdown';
import { CodeBlock } from '../CodeBlock';
import { ThinkingBlock } from '../ThinkingBlock';
import { ToolCall } from '../ToolCall';
import { DocumentPreview, extractDocuments, extractImages, extractJsonDocuments, fetchJsonAsset, type DocumentInfo } from '../DocumentPreview';
import { ImageBlock } from '../ImageBlock';
import { FlowGraphView } from './FlowGraphView';

interface GenerationMessage {
  id: string;
  type: 'progress' | 'tool_use' | 'tool_result' | 'thinking' | 'text' | 'final';
  content: string;
  name?: string;
  input?: Record<string, unknown>;
}

const RULE_SYSTEM_PROMPT = `请用agent-builder技能帮我生成流程规则`;

const TEST_RUN_PROMPT = `请用agent-process技能帮我执行规则`;

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
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [genMessages, setGenMessages] = useState<GenerationMessage[]>([]);
  const [monitorStats, setMonitorStats] = useState<MonitorStats | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft' | 'disabled'>('all');
  const [showTestRun, setShowTestRun] = useState(false);
  const [testRunRule, setTestRunRule] = useState<Rule | null>(null);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testRunMessages, setTestRunMessages] = useState<GenerationMessage[]>([]);
  const [testRunReport, setTestRunReport] = useState<string | null>(null);
  const [testRunDocs, setTestRunDocs] = useState<DocumentInfo[]>([]);
  const [testRunImages, setTestRunImages] = useState<DocumentInfo[]>([]);
  const [editMessages, setEditMessages] = useState<GenerationMessage[]>([]);
  const [editPanelVisible, setEditPanelVisible] = useState(false);
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

  const handleGenerateRule = async (attachments?: Array<{ mimeType: string; fileName: string; content: string }>) => {
    if (!description.trim() && (!attachments || attachments.length === 0)) return;
    const client = getClient();
    if (!client) {
      showToast('error', '请先连接 Gateway');
      return;
    }

    client.setChatId(`agentloop-${Date.now()}`);

    setIsGenerating(true);
    setGenMessages([]);
    const fullMessage = `${RULE_SYSTEM_PROMPT}\n\n需求如下：${description || '(见图片)'}`;
    client.send(fullMessage, attachments, {
      session_params: {
        context_policy: {
          enabled: true,
          policy_id: "agent_builder_rule_path_policy"
        }
      }
    });

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
              const existingToolIdx = msgs.findIndex(m => m.type === 'tool_use' && m.id === `tool-${event.eventId}`);
              if (existingToolIdx < 0) {
                msgs.push({ id: `tool-${event.eventId}`, type: 'tool_use', content: '', name: toolInfo.name, input: toolInfo.args });
              }
            }
          }
          if (text) {
            const textTarget = msgs[msgs.length - 1];
            if (textTarget && textTarget.type === 'text' && textTarget.id.startsWith('text-')) {
              msgs[msgs.length - 1] = { ...textTarget, content: textTarget.content + text };
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
            setGenMessages(prev => {
              const existingIdx = prev.findIndex(m => m.type === 'tool_use' && m.id === `tool-${event.eventId}`);
              if (existingIdx < 0) {
                return [...prev, { id: `tool-${event.eventId}`, type: 'tool_use', content: '', name: toolInfo.name, input: toolInfo.args }];
              }
              return prev;
            });
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
            let parsed: any;
            try {
              parsed = JSON.parse(jsonStr);
            } catch {
              const multimodal = event.multimodalResponse || event.multimodal_response;
              if (multimodal?.content) {
                jsonStr = multimodal.content.trim();
                const mmCodeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
                if (mmCodeBlockMatch) {
                  jsonStr = mmCodeBlockMatch[1].trim();
                } else {
                  const mmBraceMatch = jsonStr.match(/\{[\s\S]*\}/);
                  if (mmBraceMatch) {
                    jsonStr = mmBraceMatch[0];
                  }
                }
                try {
                  parsed = JSON.parse(jsonStr);
                } catch {
                  const jsonDocs = extractJsonDocuments(multimodal);
                  if (jsonDocs.length > 0) {
                    const jsonData = await fetchJsonAsset(jsonDocs[0].assetId);
                    if (jsonData) {
                      parsed = jsonData as any;
                    } else {
                      throw new Error('Failed to fetch JSON asset');
                    }
                  } else {
                    throw new Error('No valid JSON found in content or multimodalResponse');
                  }
                }
              } else {
                const jsonDocs = extractJsonDocuments(multimodal || {});
                if (jsonDocs.length > 0) {
                  const jsonData = await fetchJsonAsset(jsonDocs[0].assetId);
                  if (jsonData) {
                    parsed = jsonData as any;
                  } else {
                    throw new Error('Failed to fetch JSON asset');
                  }
                } else {
                  throw new Error('No valid JSON found in content or multimodalResponse');
                }
              }
            }
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
              return validEdges.map(edge => {
                const src = edge.from || edge.source;
                const tgt = edge.to || edge.target;
                let label = edge.label || '';
                if (!label && edge.condition) {
                  label = edge.condition === 'true' ? '是' : edge.condition === 'false' ? '否' : edge.condition;
                }
                return {
                  id: edge.id || `e-${src}-${tgt}`,
                  source: src,
                  target: tgt,
                  label,
                };
              });
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
              displayName: ruleData.displayName || ruleData.display_name || undefined,
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
            invalidateRulesCache();
            const latestRules = await loadRules();
            setRules(latestRules);
            setDescription('');
            setShowCreate(false);
            const createdRule = latestRules.find(r => r.name === newRule.name) || newRule;
            showToast('success', `智能体「${createdRule.displayName || createdRule.name}」已创建成功`, 4000);
            setSelectedRule(createdRule);
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
    eventHandlerRef.current?.();
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
    const fullMessage = `请激活以下智能体规则：\n\n名称：${rule.name}\n显示名称：${rule.displayName || rule.name}\n描述：${rule.description}\n触发类型：${rule.triggerType}\n\n请执行激活操作并返回结果。`;
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
              const existingIdx = msgs.findIndex(m => m.type === 'tool_use' && m.id === `tool-${event.eventId}`);
              if (existingIdx < 0) {
                msgs.push({ id: `tool-${event.eventId}`, type: 'tool_use', content: '', name: toolInfo.name, input: toolInfo.args });
              }
            }
          }
          if (text) {
            const textTarget = msgs[msgs.length - 1];
            if (textTarget && textTarget.type === 'text' && textTarget.id.startsWith('text-')) {
              msgs[msgs.length - 1] = { ...textTarget, content: textTarget.content + text };
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
            setActivateMessages(prev => {
              const existingIdx = prev.findIndex(m => m.type === 'tool_use' && m.id === `tool-${event.eventId}`);
              if (existingIdx < 0) {
                return [...prev, { id: `tool-${event.eventId}`, type: 'tool_use', content: '', name: toolInfo.name, input: toolInfo.args }];
              }
              return prev;
            });
          }
        }
        client.ack(event.eventId);
      } else if (event.eventType === 'final' && event.content) {
        handled = true;
        client.ack(event.eventId);
        eventHandlerRef.current?.();
        eventHandlerRef.current = null;
        (async () => {
          try {
            const newStatus = rule.status === 'disabled' ? 'active' : 'active';
            const updated = await updateRuleStatus(rule.id, newStatus);
            if (updated) {
              invalidateRulesCache();
              await fetchRules();
              await fetchMonitorStats();
              showToast('success', `智能体「${updated.displayName || updated.name}」已激活`, 4000);
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
    eventHandlerRef.current?.();
    eventHandlerRef.current = unsubscribe;
  };

  const openTestRunModal = (rule: Rule) => {
    setTestRunMessages([]);
    setTestRunReport(null);
    setTestRunRule(rule);
    setIsTestRunning(false);
    setTestRunDocs([]);
    setTestRunImages([]);
    setShowTestRun(true);
  };

  const handleTestRun = async () => {
    if (!testRunRule) return;
    const client = getClient();
    if (!client) {
      showToast('error', '请先连接 Gateway');
      return;
    }

    client.setChatId(`agentloop-${Date.now()}`);

    setIsTestRunning(true);
    setTestRunMessages([]);
    setTestRunReport(null);

    const fullMessage = `${TEST_RUN_PROMPT} ${testRunRule.name}`;
    client.send(fullMessage, undefined, {
      session_params: {
        context_policy: {
          enabled: true,
          policy_id: "agent_process_rule_path_policy"
        }
      }
    });

    let handled = false;

    const handleTestEvent = (event: NanobotOutboundEvent) => {
      if (handled) return;

      if (event.eventType === 'progress') {
        const text = event.content;
        const toolHint = event.metadata?._tool_hint;
        const thinking = event.metadata?._thinking as string | undefined;

        setTestRunMessages(prev => {
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
              const existingIdx = msgs.findIndex(m => m.type === 'tool_use' && m.id === `tool-${event.eventId}`);
              if (existingIdx < 0) {
                msgs.push({ id: `tool-${event.eventId}`, type: 'tool_use', content: '', name: toolInfo.name, input: toolInfo.args });
              }
            }
          }
          if (text) {
            const textTarget = msgs[msgs.length - 1];
            if (textTarget && textTarget.type === 'text' && textTarget.id.startsWith('text-')) {
              msgs[msgs.length - 1] = { ...textTarget, content: textTarget.content + text };
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
            setTestRunMessages(prev => {
              const existingIdx = prev.findIndex(m => m.type === 'tool_use' && m.id === `tool-${event.eventId}`);
              if (existingIdx < 0) {
                return [...prev, { id: `tool-${event.eventId}`, type: 'tool_use', content: '', name: toolInfo.name, input: toolInfo.args }];
              }
              return prev;
            });
          }
        }
        client.ack(event.eventId);
      } else if (event.eventType === 'final' && event.done) {
        handled = true;
        client.ack(event.eventId);
        eventHandlerRef.current?.();
        eventHandlerRef.current = null;

        let reportContent = event.content || '';
        if (!reportContent) {
          const multimodal = event.multimodalResponse || event.multimodal_response;
          if (multimodal?.content) {
            reportContent = multimodal.content;
          }
        }

        setTestRunReport(reportContent);
        const multimodal = event.multimodalResponse || event.multimodal_response;
        if (multimodal) {
          setTestRunDocs(extractDocuments(multimodal));
          setTestRunImages(extractImages(multimodal));
        }
        setIsTestRunning(false);
        showToast('success', `执行完成`, 3000);
      } else if (event.eventType === 'error') {
        handled = true;
        setIsTestRunning(false);
        setTestRunReport(null);
        showToast('error', '测试运行时出错');
      }
    };

    const unsubscribe = client.onEvent(handleTestEvent);
    eventHandlerRef.current?.();
    eventHandlerRef.current = unsubscribe;
  };

  const handleDeleteRule = async (rule: Rule) => {
    const ok = await deleteRule(rule.name);
    if (ok) {
      invalidateRulesCache();
      const latestRules = await loadRules();
      setRules(latestRules);
      showToast('success', `智能体「${rule.displayName || rule.name}」已删除`);
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
      showToast('success', `智能体「${updated.displayName || updated.name}」已${newStatus === 'active' ? '启用' : '停用'}`);
    } else {
      showToast('error', '操作失败');
    }
  };

  const handleEditRule = async (description: string, attachments?: Array<{ mimeType: string; fileName: string; content: string }>) => {
    if ((!description.trim() && (!attachments || attachments.length === 0)) || !selectedRule) return;
    const client = getClient();
    if (!client) {
      showToast('error', '请先连接 Gateway');
      return;
    }

    client.setChatId(`agentloop-${Date.now()}`);

    const fullMessage = `请用agent-builder技能帮我修改智能体「${selectedRule.name}」。\n\n修改需求：${description || '(见图片)'}`;
    client.send(fullMessage, attachments);

    let handled = false;

    const handleEditEvent = async (event: NanobotOutboundEvent) => {
      if (handled) return;
      const currentRule = selectedRule;
      const currentRuleId = currentRule?.id;
      const currentRuleName = currentRule?.name;
      const currentRuleDisplayName = currentRule?.displayName || currentRule?.name;
      if (!currentRule) return;
      
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
              const existingToolIdx = msgs.findIndex(m => m.type === 'tool_use' && m.id === `tool-${event.eventId}`);
              if (existingToolIdx < 0) {
                msgs.push({ id: `tool-${event.eventId}`, type: 'tool_use', content: '', name: toolInfo.name, input: toolInfo.args });
              }
            }
          }
          if (text) {
            const textTarget = msgs[msgs.length - 1];
            if (textTarget && textTarget.type === 'text' && textTarget.id.startsWith('text-')) {
              msgs[msgs.length - 1] = { ...textTarget, content: textTarget.content + text };
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
            setEditMessages(prev => {
              const existingIdx = prev.findIndex(m => m.type === 'tool_use' && m.id === `tool-${event.eventId}`);
              if (existingIdx < 0) {
                return [...prev, { id: `tool-${event.eventId}`, type: 'tool_use', content: '', name: toolInfo.name, input: toolInfo.args }];
              }
              return prev;
            });
          }
        }
        client.ack(event.eventId);
      } else if (event.eventType === 'final') {
        handled = true;
        client.ack(event.eventId);
        eventHandlerRef.current?.();
        eventHandlerRef.current = null;
        setEditPanelVisible(false);
        setEditMessages([]);
        invalidateRulesCache();
        const timeoutPromise = new Promise<Rule[]>((_, reject) => {
          setTimeout(() => reject(new Error('加载规则超时')), 15000);
        });
        try {
          const latestRules = await Promise.race([loadRules(), timeoutPromise]);
          setRules(latestRules);
          const updatedRule = latestRules.find(r => r.name === currentRuleName) || latestRules.find(r => r.id === currentRuleId);
          if (updatedRule) {
            setSelectedRule(updatedRule);
          }
          showToast('success', `智能体「${currentRuleDisplayName}」修改成功`, 4000);
        } catch (e) {
          console.error('加载规则失败:', e);
          showToast('error', '修改成功但刷新规则失败，请手动刷新页面');
        }
      } else if (event.eventType === 'error') {
        handled = true;
        setEditPanelVisible(false);
        setEditMessages([]);
        showToast('error', `修改规则时出错: ${event.content || '未知错误'}`);
      }
    };

    const unsubscribe = client.onEvent(handleEditEvent);
    eventHandlerRef.current?.();
    eventHandlerRef.current = unsubscribe;
  };

  const filteredRules = rules.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (r.displayName || r.name).toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
    }
    return true;
  });

  if (selectedRule) {
    return (
      <>
        <RuleDetail key={selectedRule.id} rule={selectedRule} onBack={() => setSelectedRule(null)} onEdit={handleEditRule} onTestRun={() => openTestRunModal(selectedRule)} editMessages={editMessages} setEditMessages={setEditMessages} editPanelVisible={editPanelVisible} setEditPanelVisible={setEditPanelVisible} />
        {showTestRun && testRunRule && (
          <TestRunModal
            rule={testRunRule}
            onClose={() => { setShowTestRun(false); setTestRunRule(null); setIsTestRunning(false); setTestRunMessages([]); setTestRunReport(null); setTestRunDocs([]); setTestRunImages([]); }}
            onExecute={handleTestRun}
            isRunning={isTestRunning}
            messages={testRunMessages}
            report={testRunReport}
            docs={testRunDocs}
            images={testRunImages}
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
                  onDelete={() => handleDeleteRule(rule)}
                  onToggle={() => handleToggleStatus(rule)}
                  onActivate={() => handleActivateRule(rule)}
                  onTestRun={() => openTestRunModal(rule)}
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

      {showTestRun && testRunRule && (
        <TestRunModal
          rule={testRunRule}
          onClose={() => { setShowTestRun(false); setTestRunRule(null); setIsTestRunning(false); setTestRunMessages([]); setTestRunReport(null); setTestRunDocs([]); setTestRunImages([]); }}
          onExecute={handleTestRun}
          isRunning={isTestRunning}
          messages={testRunMessages}
          report={testRunReport}
          docs={testRunDocs}
          images={testRunImages}
        />
      )}
    </div>
  );
}

function AgentCard({ rule, onClick, onDelete, onToggle, onActivate, onTestRun }: { rule: Rule; onClick: () => void; onDelete: () => void; onToggle: () => void; onActivate: () => void; onTestRun: () => void }) {
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
            <h3 className="text-sm font-medium text-pc-text truncate">{rule.displayName || rule.name}</h3>
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
            <button
              onClick={(e) => { e.stopPropagation(); onTestRun(); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
            >
              <Play size={11} />
              测试
            </button>
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

const AGENT_MAX_BASE64_CHARS = 300 * 1024;
const AGENT_MAX_IMAGE_PIXELS = 1280;

function compressAgentImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > AGENT_MAX_IMAGE_PIXELS || height > AGENT_MAX_IMAGE_PIXELS) {
        const ratio = Math.min(AGENT_MAX_IMAGE_PIXELS / width, AGENT_MAX_IMAGE_PIXELS / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      for (let q = 0.85; q >= 0.2; q -= 0.05) {
        const dataUrl = canvas.toDataURL('image/jpeg', q);
        const b64 = dataUrl.split(',')[1] || '';
        if (b64.length <= AGENT_MAX_BASE64_CHARS) {
          return resolve({ base64: b64, mimeType: 'image/jpeg' });
        }
      }
      const scale = 0.5;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.3);
      resolve({ base64: dataUrl.split(',')[1] || '', mimeType: 'image/jpeg' });
    };
    img.onerror = reject;
    img.src = url;
  });
}

function CreateModal({ onClose, description, setDescription, isGenerating, genMessages, onGenerate }: {
  onClose: () => void;
  description: string;
  setDescription: (v: string) => void;
  isGenerating: boolean;
  genMessages: GenerationMessage[];
  onGenerate: (attachments?: Array<{ mimeType: string; fileName: string; content: string }>) => void;
}) {
  const [attachments, setAttachments] = useState<Array<{ id: string; mimeType: string; fileName: string; content: string; preview: string }>>([]);

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        try {
          const compressed = await compressAgentImage(file);
          const preview = `data:${compressed.mimeType};base64,${compressed.base64}`;
          setAttachments(prev => [...prev, {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            mimeType: compressed.mimeType,
            fileName: file.name || 'pasted-image.png',
            content: compressed.base64,
            preview,
          }]);
        } catch {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            if (base64.length > AGENT_MAX_BASE64_CHARS) return;
            setAttachments(prev => [...prev, {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              mimeType: file.type,
              fileName: file.name || 'pasted-image.png',
              content: base64,
              preview: dataUrl,
            }]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleGenerate = () => {
    const attachmentsData = attachments.length > 0
      ? attachments.map(a => ({ mimeType: a.mimeType, fileName: a.fileName, content: a.content }))
      : undefined;
    onGenerate(attachmentsData);
  };

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
            onPaste={handlePaste}
            placeholder="例如：当有新订单时，自动检查库存，如果库存不足则发送提醒通知采购部门..."
            className="w-full h-32 p-4 rounded-xl border border-pc-border bg-[var(--pc-bg-base)] text-pc-text placeholder:text-pc-text-muted outline-none focus:ring-2 focus:ring-[var(--pc-accent-dim)] focus:border-[var(--pc-accent-dim)] transition-all resize-none text-sm"
          />
          {attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {attachments.map(att => (
                <div key={att.id} className="relative group">
                  <img src={att.preview} alt="attachment" className="h-16 w-16 object-cover rounded-lg border border-pc-border" />
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {isGenerating && genMessages.length > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-[var(--pc-bg-base)] border border-pc-border max-h-64 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-pc-text">
                <Loader2 size={14} className="animate-spin text-pc-accent" />
                <span>生成中...</span>
              </div>
              <div className="space-y-1.5">
                {genMessages.map((msg) => (
                  <div key={msg.id} className="text-xs">
                    {msg.type === 'thinking' && (
                      <div className="flex items-start gap-2 text-pc-text-muted">
                        <span>💭</span><span className="whitespace-pre-wrap break-words">{msg.content}</span>
                      </div>
                    )}
                    {msg.type === 'tool_use' && (
                      <div className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--pc-accent-glow)]/30">
                        <Zap size={11} className="text-pc-accent" />
                        <span className="text-pc-text">调用: {msg.name}</span>
                      </div>
                    )}
                    {msg.type === 'text' && (
                      <div className="text-pc-text-muted whitespace-pre-wrap break-words">{msg.content}</div>
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
            onClick={handleGenerate}
            disabled={(!description.trim() && attachments.length === 0) || isGenerating}
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
              <p className="text-xs text-pc-text-muted mt-0.5">{rule.displayName || rule.name}</p>
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
              <span className="text-sm text-pc-text font-medium">{rule.displayName || rule.name}</span>
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

function RuleDetail({ rule, onBack, onEdit, onTestRun, editMessages, setEditMessages, editPanelVisible, setEditPanelVisible }: { rule: Rule; onBack: () => void; onEdit: (description: string, attachments?: Array<{ mimeType: string; fileName: string; content: string }>) => void; onTestRun: () => void; editMessages: GenerationMessage[]; setEditMessages: React.Dispatch<React.SetStateAction<GenerationMessage[]>>; editPanelVisible: boolean; setEditPanelVisible: (v: boolean) => void }) {
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [editDescription, setEditDescription] = useState('');
  const [attachments, setAttachments] = useState<Array<{ id: string; mimeType: string; fileName: string; content: string; preview: string }>>([]);
  const [isEditing, setIsEditing] = useState(false);

  const openEditPanel = () => {
    setEditDescription('');
    setAttachments([]);
    setIsEditing(false);
    setEditMessages([]);
    setEditPanelVisible(true);
  };

  const closeEditPanel = () => {
    setEditPanelVisible(false);
    setEditDescription('');
    setAttachments([]);
    setIsEditing(false);
  };

  const handleEdit = (description: string, atts?: Array<{ mimeType: string; fileName: string; content: string }>) => {
    setIsEditing(true);
    setEditMessages([]);
    onEdit(description, atts);
  };

  useEffect(() => {
    if (!editPanelVisible) {
      setIsEditing(false);
    }
  }, [editPanelVisible]);

  useEffect(() => {
    setEditPanelVisible(false);
  }, [rule.id]);

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--pc-bg-base)] flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border bg-[var(--pc-bg-surface)]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-[var(--pc-hover)] text-pc-text-muted transition-colors">
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-pc-text">{rule.displayName || rule.name}</h1>
              <p className="text-[11px] text-pc-text-muted">{rule.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openEditPanel} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-pc-text-secondary hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors">
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
              <button onClick={onTestRun} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-pc-text-secondary hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors">
                <Play size={14} />测试运行
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <div className="h-full flex">
          <div className={`flex-1 overflow-y-auto p-6 transition-all ${editPanelVisible ? 'pr-0' : ''}`}>
            {viewMode === 'graph' ? (
              <FlowGraphView flow={rule.flow} />
            ) : (
              <FlowListView flow={rule.flow} />
            )}
          </div>
          <EditSidePanel
            visible={editPanelVisible}
            rule={rule}
            description={editDescription}
            setDescription={setEditDescription}
            attachments={attachments}
            setAttachments={setAttachments}
            onClose={closeEditPanel}
            onEdit={handleEdit}
            isEditing={isEditing}
            messages={editMessages}
          />
        </div>
      </main>
    </div>
  );
}

const markdownComponents = { pre: CodeBlock };

function TestRunModal({ rule, onClose, onExecute, isRunning, messages, report, docs, images }: {
  rule: Rule;
  onClose: () => void;
  onExecute: () => void;
  isRunning: boolean;
  messages: GenerationMessage[];
  report: string | null;
  docs: DocumentInfo[];
  images: DocumentInfo[];
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[85vh] bg-[var(--pc-bg-surface)] rounded-2xl border border-pc-border shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 px-6 py-4 border-b border-pc-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-pc-text">测试运行</h2>
              <p className="text-xs text-pc-text-muted mt-0.5">{rule.displayName || rule.name}</p>
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
              <span className="text-sm text-pc-text font-medium">{rule.displayName || rule.name}</span>
            </div>
            <p className="text-xs text-pc-text-muted">{rule.description}</p>
          </div>

          {(messages.length > 0 || isRunning) && (
            <div className="space-y-3 mb-4">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.type === 'thinking' && (
                    <ThinkingBlock text={msg.content} />
                  )}
                  {msg.type === 'tool_use' && (
                    <ToolCall name={msg.name || 'tool'} input={msg.input} />
                  )}
                  {msg.type === 'text' && msg.content && (
                    <div className="markdown-body">
                      <LazyMarkdown components={markdownComponents}>{msg.content}</LazyMarkdown>
                    </div>
                  )}
                </div>
              ))}
              {isRunning && (
                <div className="flex items-center gap-2 text-sm text-pc-text-muted">
                  <Loader2 size={14} className="animate-spin text-pc-accent" />
                  <span>执行中...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {report && (
            <div className="rounded-xl bg-[var(--pc-bg-base)] border border-[var(--pc-accent-dim)] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--pc-accent-dim)] bg-[var(--pc-accent-glow)]">
                <CheckCircle size={14} className="text-emerald-400" />
                <span className="text-sm font-medium text-pc-text">执行报告</span>
              </div>
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                <article className="prose prose-sm max-w-none">
                  <LazyMarkdown components={markdownComponents}>{report}</LazyMarkdown>
                </article>
              </div>
            </div>
          )}

          {images.length > 0 && (
            <div className="space-y-3 mt-4">
              {images.map((img, i) => (
                <ImageBlock key={`img-${i}`} src={`/api/v1/admin/assets/${img.assetId}/download`} alt={img.fileName} />
              ))}
            </div>
          )}

          {docs.length > 0 && (
            <div className="space-y-3 mt-4">
              {docs.map((doc, i) => (
                <DocumentPreview key={`doc-${i}`} assetId={doc.assetId} fileName={doc.fileName} mimeType={doc.mimeType} />
              ))}
            </div>
          )}

          {!isRunning && !report && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Play size={32} className="text-pc-accent mb-3" />
              <p className="text-sm text-pc-text-secondary mb-1">准备测试运行</p>
              <p className="text-xs text-pc-text-muted">点击下方「执行」按钮开始测试</p>
            </div>
          )}
        </div>
        <div className="shrink-0 px-6 py-4 border-t border-pc-border flex justify-end gap-3">
          {!isRunning && (
            <button
              onClick={onExecute}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--pc-accent)] text-zinc-900 text-sm font-medium hover:opacity-90 transition-all shadow-[0_4px_12px_rgba(var(--pc-accent-rgb),0.3)]"
            >
              <Play size={14} />
              {report ? '重新执行' : '执行'}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isRunning}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-pc-text-secondary hover:text-pc-text hover:bg-[var(--pc-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function EditSidePanel({ visible, rule, description, setDescription, attachments, setAttachments, onClose, onEdit, isEditing, messages }: {
  visible: boolean;
  rule: Rule;
  description: string;
  setDescription: (v: string) => void;
  attachments: Array<{ id: string; mimeType: string; fileName: string; content: string; preview: string }>;
  setAttachments: React.Dispatch<React.SetStateAction<Array<{ id: string; mimeType: string; fileName: string; content: string; preview: string }>>>;
  onClose: () => void;
  onEdit: (description: string, attachments?: Array<{ mimeType: string; fileName: string; content: string }>) => void;
  isEditing: boolean;
  messages: GenerationMessage[];
}) {
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        try {
          const compressed = await compressAgentImage(file);
          const preview = `data:${compressed.mimeType};base64,${compressed.base64}`;
          setAttachments(prev => [...prev, {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            mimeType: compressed.mimeType,
            fileName: file.name || 'pasted-image.png',
            content: compressed.base64,
            preview,
          }]);
        } catch {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            if (base64.length > AGENT_MAX_BASE64_CHARS) return;
            setAttachments(prev => [...prev, {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              mimeType: file.type,
              fileName: file.name || 'pasted-image.png',
              content: base64,
              preview: dataUrl,
            }]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  if (!visible) return null;

  return (
    <div className="h-full w-[360px] shrink-0 border-l border-pc-border bg-[var(--pc-bg-surface)] flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-pc-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-pc-text">编辑智能体</h3>
          <p className="text-[10px] text-pc-text-muted truncate mt-0.5">{rule.displayName || rule.name}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--pc-hover)] text-pc-text-muted transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="p-3 rounded-xl bg-[var(--pc-bg-base)] border border-pc-border">
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-2 h-2 rounded-full ${
              rule.status === 'active' ? 'bg-emerald-400' :
              rule.status === 'draft' ? 'bg-amber-400' : 'bg-zinc-400'
            }`} />
            <span className="text-xs text-pc-text font-medium">{rule.displayName || rule.name}</span>
          </div>
          <p className="text-[10px] text-pc-text-muted line-clamp-2">{rule.description}</p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-pc-text-muted">
            <span>{rule.skills?.length || 0} 个技能</span>
            <span>·</span>
            <span>{rule.flow?.nodes?.length || 0} 个节点</span>
          </div>
        </div>

        {isEditing ? (
          <div className="p-3 rounded-xl bg-[var(--pc-bg-base)] border border-pc-border">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-pc-text">
              <Loader2 size={14} className="animate-spin text-pc-accent" />
              <span>修改中...</span>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {messages.map((msg) => (
                <div key={msg.id} className="text-xs">
                  {msg.type === 'thinking' && (
                    <div className="flex items-start gap-2 text-pc-text-muted">
                      <span>💭</span><span className="whitespace-pre-wrap break-words">{msg.content}</span>
                    </div>
                  )}
                  {msg.type === 'tool_use' && (
                    <div className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--pc-accent-glow)]/30">
                      <Zap size={11} className="text-pc-accent" />
                      <span className="text-pc-text">调用: {msg.name}</span>
                    </div>
                  )}
                  {msg.type === 'text' && (
                    <div className="text-pc-text-muted whitespace-pre-wrap break-words">{msg.content}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onPaste={handlePaste}
              placeholder="用自然语言描述修改需求..."
              className="w-full h-28 p-3 rounded-xl border border-pc-border bg-[var(--pc-bg-base)] text-pc-text placeholder:text-pc-text-muted outline-none focus:ring-2 focus:ring-[var(--pc-accent-dim)] focus:border-[var(--pc-accent-dim)] transition-all resize-none text-xs"
            />

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map(att => (
                  <div key={att.id} className="relative group">
                    <img src={att.preview} alt="attachment" className="h-14 w-14 object-cover rounded-lg border border-pc-border" />
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 rounded-xl bg-[var(--pc-bg-base)] border border-pc-border">
              <h4 className="text-[10px] font-medium text-pc-text mb-2">示例</h4>
              <div className="space-y-1">
                {['在流程末尾增加一个发送邮件通知的步骤', '将触发方式改为每天早上9点定时执行', '在库存检查后增加一个条件判断'].map((example) => (
                  <button key={example} onClick={() => setDescription(example)} className="block w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors truncate">
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="shrink-0 px-4 py-3 border-t border-pc-border">
        <button
          onClick={() => onEdit(description, attachments.length > 0 ? attachments.map(a => ({ mimeType: a.mimeType, fileName: a.fileName, content: a.content })) : undefined)}
          disabled={(!description.trim() && attachments.length === 0) || isEditing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--pc-accent)] text-zinc-900 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_12px_rgba(var(--pc-accent-rgb),0.3)]"
        >
          {isEditing ? (
            <><Loader2 size={14} className="animate-spin" /><span>修改中...</span></>
          ) : (
            <><span>✨</span><span>确认修改</span></>
          )}
        </button>
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
