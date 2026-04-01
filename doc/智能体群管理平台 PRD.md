# 智能体编排平台 PRD 文档

**产品名称**：Agent Orchestrator

**版本**：v1.0

**编制日期**：2026-03-24

---

## 1. 产品概述

### 1.1 核心功能

| 功能 | 描述 |
|------|------|
| **自然语言创建规则** | 用户描述需求 → AI 生成规则（技能选择 + 流程编排） |
| **手动修改规则** | AI 生成后用户可调整技能选择、流程顺序、参数配置 |
| **可视化流程图** | 节点编辑器，拖拽式编排，支持分支/循环/并行 |
| **步骤列表视图** | 线性展示流程步骤，可拖拽调整顺序 |
| **规则执行** | 手动触发 + 自动触发（定时/Webhook） |
| **执行监控** | 实时日志、执行历史、运行状态 |

---

## 2. 功能需求

### 2.1 规则创建（AI 生成）

**输入**：用户用自然语言描述想要实现的功能

**处理**：
- AI 分析用户意图
- 从技能库中选择合适的技能
- 生成流程编排方案（技能的调用顺序和参数）

**输出**：
- 规则名称（AI 生成）
- 选中的技能列表
- 流程编排（技能顺序、参数配置）

### 2.2 规则修改

- 修改规则名称
- 增删改选中的技能
- 调整技能顺序
- 配置/修改每个技能的参数

### 2.3 流程编排

#### 2.3.1 可视化流程图

- **节点类型**：技能节点、分支节点、循环节点、并行节点、开始/结束节点
- **操作**：拖拽技能到画布生成节点，连线表示执行顺序
- **分支**：条件分支（if/else）、多分支（switch）
- **循环**：while/for 循环，支持设置循环条件和最大次数
- **并行**：多个技能同时执行，聚合节点等待完成后继续

#### 2.3.2 步骤列表

- 线性展示流程步骤，每步显示：序号、技能名称、状态
- 拖拽调整步骤顺序
- 点击查看/编辑详情

#### 2.3.3 视图切换

- 流程图 ↔ 步骤列表 一键切换，数据同步

### 2.4 执行管理

#### 2.4.1 手动触发

- 规则详情页点击「运行」
- 填写运行时参数
- 实时展示执行进度和日志
- 执行完成后显示结果

#### 2.4.2 自动触发

- **定时触发**：Cron 表达式
- **Webhook 触发**：HTTP 调用触发

#### 2.4.3 执行历史

- 执行记录列表：时间、状态、耗时、触发方式
- 查看执行详情：输入、输出、日志

### 2.5 监控

- 仪表板：规则数量、运行次数、成功率、趋势图
- 日志中心：实时日志流、筛选、导出

---

## 3. 数据模型

### 3.1 规则（Rule）

```typescript
interface Rule {
  id: string;
  name: string;                    // 规则名称
  description: string;             // 用户原始描述
  skills: SkillRef[];              // 引用的技能列表
  flow: FlowConfig;               // 流程配置
  trigger?: TriggerConfig;         // 触发配置
  createdAt: string;
  updatedAt: string;
}

interface SkillRef {
  skillId: string;                 // 技能 ID
  name: string;                    // 技能名称
  params: Record<string, any>;     // 技能参数
}

interface FlowConfig {
  type: 'graph' | 'list';
  graph?: FlowGraph;               // 流程图数据
  list?: FlowList;                // 步骤列表数据
}
```

### 3.2 流程图（FlowGraph）

```typescript
interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface FlowNode {
  id: string;
  type: 'start' | 'end' | 'skill' | 'condition' | 'loop' | 'parallel' | '聚合';
  skillId?: string;               // 技能节点时
  label: string;
  position?: { x: number; y: number };
  config?: any;                    // 条件/循环/并行配置
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;                  // 条件分支时使用
}
```

### 3.3 步骤列表（FlowList）

```typescript
interface FlowList {
  steps: FlowStep[];
}

interface FlowStep {
  id: string;
  skillId: string;
  skillName: string;
  order: number;
  params: Record<string, any>;
}
```

---

## 4. 验收标准

### 4.1 规则创建

- [ ] AI 根据用户自然语言描述生成规则
- [ ] 生成内容包括：规则名称、选中的技能、流程编排

### 4.2 规则修改

- [ ] 可修改规则名称
- [ ] 可增删改选中的技能
- [ ] 可调整技能顺序
- [ ] 可配置技能参数

### 4.3 流程编排

- [ ] 可视化流程图编辑
- [ ] 步骤列表视图
- [ ] 支持分支（if/else/switch）
- [ ] 支持循环
- [ ] 支持并行执行
- [ ] 两种视图可切换，数据同步

### 4.4 执行

- [ ] 手动触发执行
- [ ] 定时触发（Cron）
- [ ] Webhook 触发
- [ ] 实时查看执行日志
- [ ] 执行历史记录

### 4.5 监控

- [ ] 仪表板统计
- [ ] 日志查看
