const RULES_STORAGE_KEY = 'pinchchat_rules';

export interface SkillRef {
  skillId: string;
  name: string;
  params: Record<string, unknown>;
}

export interface FlowNode {
  id: string;
  type: 'skill' | 'condition' | 'loop' | 'start' | 'end';
  skillId?: string;
  skillName?: string;
  label: string;
  condition?: string;
  loopConfig?: { maxIterations: number; condition: string };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface Rule {
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
  systemPrompt: string;
}

export function getStoredRules(): Rule[] {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveRule(rule: Rule) {
  const rules = getStoredRules();
  const existingIndex = rules.findIndex(r => r.id === rule.id);
  if (existingIndex >= 0) {
    rules[existingIndex] = rule;
  } else {
    rules.push(rule);
  }
  localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
}

export function deleteRule(ruleId: string) {
  const rules = getStoredRules().filter(r => r.id !== ruleId);
  localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
}

export function generateRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}