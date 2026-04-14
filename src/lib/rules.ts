import type { NanobotApiClient } from './nanobotApi';
import type { Rule, RulePayload } from './nanobotApi';

export type { Rule, RulePayload };
export type { RuleSkillRef as SkillRef, RuleFlowNode as FlowNode, RuleFlowEdge as FlowEdge, RuleFlowGraph as FlowGraph } from './nanobotApi';

let apiClient: NanobotApiClient | null = null;
let rulesCache: Rule[] | null = null;
let pendingRefresh: Promise<Rule[]> | null = null;

export function setRulesApiClient(client: NanobotApiClient | null) {
  apiClient = client;
  rulesCache = null;
  pendingRefresh = null;
}

export function invalidateRulesCache() {
  rulesCache = null;
  pendingRefresh = null;
}

async function ensureApiClient(): Promise<NanobotApiClient> {
  if (!apiClient) {
    throw new Error('Rules API client not initialized. Call setRulesApiClient() first.');
  }
  return apiClient;
}

export async function loadRules(): Promise<Rule[]> {
  if (rulesCache !== null) return rulesCache;
  if (pendingRefresh) return pendingRefresh;

  pendingRefresh = (async () => {
    try {
      const client = await ensureApiClient();
      const res = await client.getRules();
      const rawRules = res.applied && res.data.rules ? res.data.rules : [];
      rulesCache = rawRules.map((item: any) => item.rule || item);
      return rulesCache;
    } catch (err) {
      console.error('Failed to load rules from API:', err);
      rulesCache = [];
      return [];
    } finally {
      pendingRefresh = null;
    }
  })();

  return pendingRefresh;
}

export async function saveRule(rule: Rule): Promise<Rule | null> {
  try {
    const client = await ensureApiClient();
    const exists = rulesCache?.find(r => r.id === rule.id);

    let res;
    if (exists) {
      const payload: Partial<RulePayload> = {
        name: rule.name,
        description: rule.description,
        status: rule.status,
        triggerType: rule.triggerType,
        triggerConfig: rule.triggerConfig,
        skills: rule.skills,
        flow: rule.flow,
        flowType: rule.flowType,
        systemPrompt: rule.systemPrompt,
      };
      res = await client.updateRule(rule.id, payload);
    } else {
      const payload: RulePayload = {
        name: rule.name,
        description: rule.description,
        status: rule.status,
        triggerType: rule.triggerType,
        triggerConfig: rule.triggerConfig,
        skills: rule.skills,
        flow: rule.flow,
        flowType: rule.flowType,
        systemPrompt: rule.systemPrompt,
      };
      res = await client.createRule(payload);
    }

    if (res.applied && res.data.rule) {
      rulesCache = null;
      return res.data.rule;
    }
    return null;
  } catch (err) {
    console.error('Failed to save rule:', err);
    return null;
  }
}

export async function deleteRule(ruleId: string): Promise<boolean> {
  try {
    const client = await ensureApiClient();
    const res = await client.deleteRule(ruleId);
    if (res.applied) {
      rulesCache = null;
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to delete rule:', err);
    return false;
  }
}

export async function updateRuleStatus(ruleId: string, status: Rule['status']): Promise<Rule | null> {
  try {
    const client = await ensureApiClient();
    const res = await client.updateRule(ruleId, { status });
    if (res.applied && res.data.rule) {
      rulesCache = null;
      return res.data.rule;
    }
    return null;
  } catch (err) {
    console.error('Failed to update rule status:', err);
    return null;
  }
}

export function generateRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
