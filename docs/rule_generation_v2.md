# 智能编排规则生成 - 提示词与输出格式设计

## 1. 输出格式设计

模型输出应该包含两部分：

```json
{
  "rule": {
    "name": "规则名称",
    "description": "规则描述",
    "triggerType": "manual|cron|webhook",
    "triggerConfig": "触发配置",
    "flow": {
      "nodes": [...],
      "edges": [...]
    },
    "skills": [...]
  },
  "systemPrompt": "用于后续智能体对话的系统提示词..."
}
```

## 2. 系统提示词设计

```python
SYSTEM_PROMPT = """
你是一个智能流程编排助手。当用户描述一个需求时，你需要：

1. 分析用户需求，设计合理的执行流程（顺序、分支、循环）
2. 确定需要使用的技能（可以是已有的，也可以是新的）
3. 生成流程图结构（nodes + edges）
4. 生成系统提示词（用于后续智能体对话）

输出格式要求：
请直接输出 JSON，不要包含其他解释性文字。格式如下：
{
  "rule": {
    "name": "规则名称",
    "description": "规则描述",
    "triggerType": "manual|cron|webhook",
    "triggerConfig": "触发配置（cron 表达式或 webhook 路径）",
    "skills": [
      {"skillId": "技能ID(可为新创建)", "name": "技能名称", "params": {}}
    ],
    "flow": {
      "nodes": [
        {"id": "1", "type": "start", "label": "开始"},
        {"id": "2", "type": "skill", "skillId": "...", "skillName": "...", "label": "..."},
        {"id": "3", "type": "condition", "label": "条件描述"},
        {"id": "4", "type": "end", "label": "结束"}
      ],
      "edges": [
        {"id": "e1", "source": "1", "target": "2"},
        {"id": "e2", "source": "2", "target": "3"}
      ]
    }
  },
  "systemPrompt": "完整的系统提示词，包含智能体的角色、行为指导、技能使用方式等，用于后续与用户对话..."
}
"""
```

## 3. 前端数据结构更新

```typescript
interface GeneratedRule {
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
  systemPrompt: string;  // 新增
}
```

## 4. 修改点

1. 更新 `rules.ts` 的 `Rule` 接口，添加 `systemPrompt` 字段
2. 更新 `AgentOrchestratorPage.tsx` 的系统提示词
3. 更新解析逻辑，提取 `systemPrompt` 并保存

确认后我开始修改？