# 智能编排规则生成 - 开发设计文档

## 1. 需求概述

用户通过自然语言描述需求，AI 自动生成规则（流程图数据结构）。生成过程类似普通聊天，包含思考过程（think）和工具调用（tool），最终将模型输出解析为本地规则文件。

## 2. 核心流程

```
用户输入描述
    ↓
构造系统提示词 + 用户描述 → 发送给后端
    ↓
模型返回 (包含 thinking, tool_use, tool_result, final content)
    ↓
解析模型输出 → 生成 Rule 对象
    ↓
保存到本地存储（localStorage）或后端
    ↓
渲染流程图
```

## 3. 系统提示词设计

```python
# 规则生成系统提示词
SYSTEM_PROMPT = """
你是一个智能流程编排助手。当用户描述一个需求时，你需要：
1. 分析用户需求，确定需要哪些技能（skill）
2. 设计合理的执行流程，包括顺序、分支、循环
3. 以 JSON 格式输出规则结构

可用技能类型：
- webhook-listener: 监听 Webhook 事件
- cron-trigger: 定时触发
- check-stock: 检查库存
- notify-warehouse: 通知仓库
- send-email: 发送邮件
- query-sales: 查询销售数据
- generate-report: 生成报表
- create-ticket: 创建工单
- send-notification: 发送通知

输出格式要求：
请直接输出 JSON，不要包含其他解释性文字。格式如下：
{
  "name": "规则名称",
  "description": "规则描述",
  "triggerType": "manual|cron|webhook",
  "triggerConfig": "触发配置（cron 表达式或 webhook 路径）",
  "skills": [
    {"skillId": "技能ID", "name": "技能名称", "params": {}}
  ],
  "flow": {
    "nodes": [
      {"id": "1", "type": "start", "label": "开始"},
      {"id": "2", "type": "skill", "skillId": "...", "skillName": "...", "label": "..."},
      {"id": "3", "type": "condition", "label": "条件描述", "condition": "条件表达式"},
      {"id": "4", "type": "end", "label": "结束"}
    ],
    "edges": [
      {"id": "e1", "source": "1", "target": "2"},
      {"id": "e2", "source": "2", "target": "3"},
      {"id": "e3", "source": "3", "target": "4", "label": "是"},
      {"id": "e4", "source": "3", "target": "5", "label": "否"}
    ]
  }
}
"""
```

## 4. 规则数据结构

```typescript
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
```

## 5. 前端实现方案

### 5.1 复用现有 Gateway

可以复用 `NanobotGatewayClient`，但需要为规则生成创建独立的 session：

```typescript
// 新建一个专门的 client 用于规则生成
const ruleClient = new NanobotGatewayClient(wsUrl, token);
const ruleChatId = `rule-gen-${Date.now()}`;
ruleClient.connect();

// 使用专门的 session key
const ruleSessionKey = `transport:${ruleChatId}`;
```

或者更简单的方式：复用现有的 useGateway hook，但创建一个特殊的规则生成函数。

### 5.2 消息发送

```typescript
const generateRule = async (description: string): Promise<Rule> => {
  // 使用专门的规则生成 session
  const ruleSessionKey = `transport:rule-gen`;
  
  // 发送消息（系统提示词在服务端处理，或者通过 metadata 传递）
  client.send(ruleSessionKey, description);
  
  // 等待返回，解析 JSON
};
```

**注意**：需要确认后端是否支持自定义 session key。

### 5.3 接收与解析

需要监听 events，解析返回的 content：

```typescript
const handleRuleEvent = (event: NanobotOutboundEvent) => {
  if (event.eventType === 'final') {
    const jsonStr = event.content.trim();
    const rule = JSON.parse(jsonStr) as Rule;
    // 保存到本地存储
    saveRule(rule);
  }
};
```

## 6. 待确认问题

1. **后端 session 管理**：规则生成是否需要独立的 session？还是可以复用现有 session？
2. **系统提示词位置**：是在前端构造，还是后端统一处理？
3. **规则存储**：存储在前端 localStorage 还是后端 API？
4. **错误处理**：JSON 解析失败如何处理？

## 7. 实现步骤

1. 在 `useGateway.ts` 或新建 hook 中添加规则生成函数
2. 修改 `AgentOrchestratorPage.tsx` 的 `handleGenerateRule` 函数
3. 添加规则解析和保存逻辑
4. 测试完整流程