import { useState } from 'react';
import { X, Plus, Settings, BarChart3, Clock, CheckCircle2, XCircle, AlertCircle, ChevronRight, GitBranch, ArrowRight, Trash2, Edit3, Play, GripVertical, Bot, Zap, GitFork, Circle, Square } from 'lucide-react';

interface SkillRef {
  skillId: string;
  name: string;
  params: Record<string, unknown>;
}

interface FlowNode {
  id: string;
  type: 'skill' | 'condition' | 'loop' | 'start' | 'end';
  skillId?: string;
  skillName?: string;
  label: string;
  condition?: string;
  loopConfig?: { maxIterations: number; condition: string };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface Rule {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'draft' | 'disabled';
  triggerType: 'manual' | 'cron' | 'webhook';
  triggerConfig?: string;
  runCount: number;
  successRate: number;
  lastRunAt?: string;
  createdAt: string;
  skills: SkillRef[];
  flow: FlowGraph;
  flowType: 'graph' | 'list';
}

interface Props {
  onClose: () => void;
}

export function AgentOrchestratorPage({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'create' | 'rules' | 'monitor'>('create');
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);

  const mockRules: Rule[] = [
    {
      id: '1',
      name: '订单自动处理',
      description: '当有新订单时，自动检查库存并通知仓库',
      status: 'active',
      triggerType: 'webhook',
      runCount: 156,
      successRate: 98.5,
      lastRunAt: '2026-03-24T10:30:00Z',
      createdAt: '2026-03-01',
      skills: [
        { skillId: 'webhook-listener', name: 'Webhook 监听器', params: {} },
        { skillId: 'check-stock', name: '检查库存', params: {} },
        { skillId: 'notify-warehouse', name: '通知仓库', params: {} },
      ],
      flow: {
        nodes: [
          { id: '1', type: 'start', label: '开始' },
          { id: '2', type: 'skill', skillId: 'webhook-listener', skillName: 'Webhook 监听器', label: '监听订单事件' },
          { id: '3', type: 'skill', skillId: 'check-stock', skillName: '检查库存', label: '检查商品库存' },
          { id: '4', type: 'condition', label: '库存是否充足?' },
          { id: '5', type: 'skill', skillId: 'notify-warehouse', skillName: '通知仓库', label: '通知仓库备货' },
          { id: '6', type: 'end', label: '结束' },
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' },
          { id: 'e3', source: '3', target: '4' },
          { id: 'e4', source: '4', target: '5', label: '否' },
          { id: 'e5', source: '4', target: '6', label: '是' },
          { id: 'e6', source: '5', target: '6' },
        ],
      },
      flowType: 'graph',
    },
    {
      id: '2',
      name: '每日销售报表',
      description: '每天早上8点生成昨日销售报表并发送邮件',
      status: 'active',
      triggerType: 'cron',
      triggerConfig: '0 8 * * *',
      runCount: 24,
      successRate: 100,
      lastRunAt: '2026-03-24T08:00:00Z',
      createdAt: '2026-03-15',
      skills: [
        { skillId: 'cron-trigger', name: '定时触发器', params: {} },
        { skillId: 'query-sales', name: '查询销售数据', params: {} },
        { skillId: 'generate-report', name: '生成报表', params: {} },
        { skillId: 'send-email', name: '发送邮件', params: {} },
      ],
      flow: {
        nodes: [
          { id: '1', type: 'start', label: '开始' },
          { id: '2', type: 'skill', skillId: 'cron-trigger', skillName: '定时触发器', label: '每天8点触发' },
          { id: '3', type: 'skill', skillId: 'query-sales', skillName: '查询销售数据', label: '查询昨日销售' },
          { id: '4', type: 'skill', skillId: 'generate-report', skillName: '生成报表', label: '生成报表' },
          { id: '5', type: 'skill', skillId: 'send-email', skillName: '发送邮件', label: '发送邮件' },
          { id: '6', type: 'end', label: '结束' },
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' },
          { id: 'e3', source: '3', target: '4' },
          { id: 'e4', source: '4', target: '5' },
          { id: 'e5', source: '5', target: '6' },
        ],
      },
      flowType: 'graph',
    },
  ];

  const handleGenerateRule = async () => {
    if (!description.trim()) return;
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsGenerating(false);
    setDescription('');
  };

  if (selectedRule) {
    return <RuleDetail rule={selectedRule} onBack={() => setSelectedRule(null)} />;
  }

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--pc-bg-base)] flex flex-col overflow-hidden">
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
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl hover:bg-[var(--pc-hover)] text-pc-text-muted hover:text-pc-text transition-colors"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pb-4">
          <div className="flex items-center gap-1 bg-[var(--pc-bg-base)]/50 p-1 rounded-xl border border-pc-border">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'create'
                  ? 'bg-[var(--pc-accent)] text-zinc-900 shadow-[0_2px_8px_rgba(var(--pc-accent-rgb),0.2)]'
                  : 'text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]'
              }`}
            >
              <Plus size={14} className="inline mr-1.5" />
              创建规则
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'rules'
                  ? 'bg-[var(--pc-accent)] text-zinc-900 shadow-[0_2px_8px_rgba(var(--pc-accent-rgb),0.2)]'
                  : 'text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]'
              }`}
            >
              <Settings size={14} className="inline mr-1.5" />
              规则管理
            </button>
            <button
              onClick={() => setActiveTab('monitor')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'monitor'
                  ? 'bg-[var(--pc-accent)] text-zinc-900 shadow-[0_2px_8px_rgba(var(--pc-accent-rgb),0.2)]'
                  : 'text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]'
              }`}
            >
              <BarChart3 size={14} className="inline mr-1.5" />
              监控
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
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：当有新订单时，自动检查库存，如果库存不足则发送提醒通知采购部门..."
                className="w-full h-40 p-4 rounded-2xl border border-pc-border bg-[var(--pc-bg-surface)] text-pc-text placeholder:text-pc-text-muted outline-none focus:ring-2 focus:ring-[var(--pc-accent-dim)] focus:border-[var(--pc-accent-dim)] transition-all resize-none"
              />
              <button
                onClick={handleGenerateRule}
                disabled={!description.trim() || isGenerating}
                className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--pc-accent)] text-zinc-900 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_12px_rgba(var(--pc-accent-rgb),0.3)]"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" />
                    <span>生成中...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>生成规则</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-8 p-4 rounded-xl bg-[var(--pc-bg-surface)] border border-pc-border">
              <h3 className="text-sm font-medium text-pc-text mb-3">使用示例</h3>
              <div className="flex flex-col gap-2">
                {[
                  '当有新订单时，自动检查库存并通知仓库备货',
                  '每天早上9点汇总昨日销售数据生成报表',
                  '客户提交工单时，自动识别问题类型并分配给对应部门',
                  '检测到网站异常时自动发送告警并创建故障工单',
                ].map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => setDescription(example)}
                    className="text-left px-3 py-2 rounded-lg text-sm text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-pc-text">已创建的规则</h2>
              <span className="text-sm text-pc-text-muted">{mockRules.length} 个规则</span>
            </div>

            <div className="flex flex-col gap-3">
              {mockRules.map((rule) => (
                <div
                  key={rule.id}
                  onClick={() => setSelectedRule(rule)}
                  className="p-4 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border hover:border-[var(--pc-accent-dim)] transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-medium text-pc-text">{rule.name}</h3>
                      <p className="text-xs text-pc-text-muted mt-1">{rule.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        rule.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : rule.status === 'draft'
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-red-500/15 text-red-400'
                      }`}>
                        {rule.status === 'active' ? <CheckCircle2 size={10} /> : rule.status === 'draft' ? <AlertCircle size={10} /> : <XCircle size={10} />}
                        {rule.status === 'active' ? '启用' : rule.status === 'draft' ? '草稿' : '禁用'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-pc-text-muted">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {rule.triggerType === 'manual' ? '手动触发' : rule.triggerType === 'cron' ? '定时触发' : 'Webhook'}
                      </span>
                      <span>运行 {rule.runCount} 次</span>
                      <span>成功率 {rule.successRate}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-pc-accent">
                      <span>查看流程</span>
                      <ChevronRight size={12} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border">
              <div className="text-2xl font-semibold text-pc-text">2</div>
              <div className="text-sm text-pc-text-muted">活跃规则</div>
            </div>
            <div className="p-4 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border">
              <div className="text-2xl font-semibold text-pc-text">180</div>
              <div className="text-sm text-pc-text-muted">总执行次数</div>
            </div>
            <div className="p-4 rounded-2xl bg-[var(--pc-bg-surface)] border border-pc-border">
              <div className="text-2xl font-semibold text-pc-text">98.5%</div>
              <div className="text-sm text-pc-text-muted">成功率</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function RuleDetail({ rule, onBack }: { rule: Rule; onBack: () => void }) {
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [isEditing, setIsEditing] = useState(false);
  const [editedRule, setEditedRule] = useState(rule);

  const handleSave = () => {
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--pc-bg-base)] flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-pc-border bg-[var(--pc-bg-surface)]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-[var(--pc-hover)] text-pc-text-muted transition-colors"
            >
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <div>
              {isEditing ? (
                <input
                  type="text"
                  value={editedRule.name}
                  onChange={(e) => setEditedRule({ ...editedRule, name: e.target.value })}
                  className="text-base font-semibold text-pc-text bg-transparent border-b border-pc-accent outline-none"
                />
              ) : (
                <h1 className="text-base font-semibold text-pc-text">{rule.name}</h1>
              )}
              <p className="text-[11px] text-pc-text-muted">{rule.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-sm text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-xl bg-[var(--pc-accent)] text-zinc-900 text-sm font-medium hover:opacity-90 transition-all"
                >
                  保存
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-pc-text-secondary hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors"
              >
                <Edit3 size={14} />
                编辑规则
              </button>
            )}
          </div>
        </div>

        <div className="px-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-[var(--pc-bg-base)]/50 p-1 rounded-xl border border-pc-border">
              <button
                onClick={() => setViewMode('graph')}
                className={`flex-1 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'graph'
                    ? 'bg-[var(--pc-accent)] text-zinc-900'
                    : 'text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]'
                }`}
              >
                <GitBranch size={14} className="inline mr-1.5" />
                流程图
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex-1 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-[var(--pc-accent)] text-zinc-900'
                    : 'text-pc-text-muted hover:text-pc-text hover:bg-[var(--pc-hover)]'
                }`}
              >
                <ArrowRight size={14} className="inline mr-1.5" />
                步骤列表
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-pc-text-secondary hover:text-pc-text hover:bg-[var(--pc-hover)] transition-colors">
                <Play size={14} />
                测试运行
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
      case 'start':
        return (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">{node.label}</span>
          </div>
        );
      case 'end':
        return (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-zinc-500" />
            <span className="text-xs text-zinc-400 font-medium">{node.label}</span>
          </div>
        );
      case 'condition':
        return (
          <div className="flex items-center gap-2">
            <GitFork size={14} className="text-amber-400 shrink-0" />
            <div>
              <div className="text-xs text-amber-400 font-medium">条件判断</div>
              <div className="text-sm text-pc-text">{node.label}</div>
            </div>
          </div>
        );
      case 'skill':
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--pc-accent-glow)] flex items-center justify-center shrink-0">
              <Bot size={14} className="text-pc-accent" />
            </div>
            <div>
              <div className="text-xs text-pc-accent font-medium">{node.skillName}</div>
              <div className="text-sm text-pc-text">{node.label}</div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const getNodeStyle = (node: FlowNode) => {
    switch (node.type) {
      case 'start':
        return 'bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border-emerald-500/30';
      case 'end':
        return 'bg-gradient-to-r from-zinc-500/10 to-zinc-500/5 border-zinc-500/30';
      case 'condition':
        return 'bg-gradient-to-r from-amber-500/10 to-amber-500/5 border-amber-500/30';
      case 'skill':
        return 'bg-gradient-to-r from-[var(--pc-accent-glow)] to-transparent border-[var(--pc-accent-dim)]';
      default:
        return 'bg-[var(--pc-bg-surface)] border-pc-border';
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
              <div className="relative group">
                <div className={`
                  relative px-4 py-3 rounded-xl border-2 transition-all
                  ${getNodeStyle(node)}
                  ${isEditing ? 'cursor-pointer hover:scale-105' : ''}
                `}>
                  {renderNode(node)}
                </div>
                {isEditing && (
                  <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button className="p-1 rounded-full bg-[var(--pc-bg-surface)] border border-pc-border hover:bg-[var(--pc-hover)]">
                      <Edit3 size={10} className="text-pc-text-muted" />
                    </button>
                    <button className="p-1 rounded-full bg-red-500/20 border border-red-500/30 hover:bg-red-500/30">
                      <Trash2 size={10} className="text-red-400" />
                    </button>
                  </div>
                )}
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
          <h4 className="text-sm font-medium text-pc-text mb-3 flex items-center gap-2">
            <GitFork size={14} className="text-amber-400" />
            条件分支逻辑
          </h4>
          <div className="space-y-2">
            {conditionEdges.map(edge => {
              const sourceNode = flow.nodes.find(n => n.id === edge.source);
              const targetNode = flow.nodes.find(n => n.id === edge.target);
              return (
                <div key={edge.id} className="flex items-center gap-3 text-sm">
                  <div className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-medium text-xs">
                    {edge.label}
                  </div>
                  <span className="text-pc-text-muted">
                    {sourceNode?.label} → {targetNode?.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-emerald-400 mb-1">
            <Circle size={8} className="fill-current" />
            <span>开始节点</span>
          </div>
          <div className="text-xs text-pc-text-muted">流程入口</div>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-center gap-2 text-xs text-amber-400 mb-1">
            <GitFork size={8} />
            <span>条件节点</span>
          </div>
          <div className="text-xs text-pc-text-muted">分支判断</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--pc-accent-glow)] border border-[var(--pc-accent-dim)]">
          <div className="flex items-center gap-2 text-xs text-pc-accent mb-1">
            <Bot size={8} />
            <span>技能节点</span>
          </div>
          <div className="text-xs text-pc-text-muted">执行动作</div>
        </div>
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
          {idx > 0 && (
            <div className="absolute left-[3.25rem] -top-3 w-px h-3 bg-gradient-to-b from-pc-border to-transparent" />
          )}
          {idx < skillNodes.length - 1 && (
            <div className="absolute left-[3.25rem] -bottom-3 w-px h-3 bg-gradient-to-b from-pc-border to-transparent" />
          )}
          <div className="flex items-center gap-3">
            {isEditing && (
              <GripVertical size={16} className="text-pc-text-muted cursor-grab hover:text-pc-text" />
            )}
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
              <button className="p-2 rounded-lg hover:bg-[var(--pc-hover)] text-pc-text-muted hover:text-pc-text">
                <Edit3 size={14} />
              </button>
              <button className="p-2 rounded-lg hover:bg-red-500/10 text-pc-text-muted hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center gap-3 mt-4 text-xs text-pc-text-muted">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
          <Circle size={8} className="fill-current" />
          <span>开始</span>
        </div>
        {skillNodes.map((_, idx) => (
          <ArrowRight key={idx} size={12} />
        ))}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-500/10 text-zinc-400">
          <Square size={8} />
          <span>结束</span>
        </div>
      </div>

      {skillNodes.length === 0 && (
        <div className="text-center py-12 text-pc-text-muted">
          暂无流程步骤
        </div>
      )}
    </div>
  );
}
