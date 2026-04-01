# Dashboard 功能设计

> 文档日期: 2026-03-19

## 1. 概述

在左侧边栏添加 Dashboard 入口，点击后展开一个全屏/半屏面板，展示系统状态、管理功能等。

## 2. 布局设计

### 2.1 侧边栏改造

```
┌─────────────────────────────┐
│ [Logo]  PinchChat    [≡]    │  ← 顶部: Logo + 菜单按钮
├─────────────────────────────┤
│ [📊 Dashboard]               │  ← 新增: Dashboard 入口
│ [💬 Sessions]               │  ← 重命名: 原会话列表
│ [⚙️ Settings]               │  ← 新增: 设置入口
├─────────────────────────────┤
│                             │
│     [会话列表区域]           │  ← 可折叠
│                             │
├─────────────────────────────┤
│ [+] 新会话                  │
│ [🤖 新 Agent 会话]          │
└─────────────────────────────┘
```

### 2.2 Dashboard 面板

点击 Dashboard 后，从右侧滑出一个面板：

```
┌─────────────────────────────────────┐
│  [←]  Dashboard           [×]      │  ← 返回按钮 + 关闭
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────┐ ┌─────────────┐    │
│  │ Sessions    │ │ Skills     │    │  ← 概览卡片
│  │    12      │ │    8       │    │
│  └─────────────┘ └─────────────┘    │
│                                     │
│  ┌─────────────┐ ┌─────────────┐    │
│  │ Channels    │ │ Cron Jobs   │    │
│  │    3       │ │    2        │    │
│  └─────────────┘ └─────────────┘    │
│                                     │
├─────────────────────────────────────┤
│  Skills 技能列表                     │
│  ┌─────────────────────────────────┐│
│  │ ☐ github      Built-in    [开] ││
│  │ ☐ tavily     Built-in    [关] ││
│  │ ☐ browser    Workspace  [开] ││
│  │ ☐ custom     Workspace  [关] ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  Channels 渠道状态                   │
│  ┌─────────────────────────────────┐│
│  │ ✓ Telegram    Connected        ││
│  │ ✓ Discord     Connected        ││
│  │ ✗ WhatsApp   Disconnected      ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  Cron 定时任务                      │
│  ┌─────────────────────────────────┐│
│  │ daily-report    */6 * * * *   ││
│  │ weekly-summary  0 0 * * 0     ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

## 3. 功能模块

### 3.1 概览卡片 (Overview Cards)

| 卡片 | 数据来源 | 说明 |
|------|----------|------|
| Sessions | `GET /api/v1/admin/sessions` | 会话总数 |
| Skills | `GET /api/v1/admin/skills` | 技能总数 + 启用数 |
| Channels | `GET /api/v1/admin/channels` | 渠道状态统计 |
| Cron Jobs | `GET /api/v1/admin/cron/jobs` | 任务总数 |

### 3.2 Skills 技能管理

| 功能 | API | 说明 |
|------|-----|------|
| 列表 | `GET /api/v1/admin/skills` | 显示所有技能 |
| 启用/禁用 | `POST /api/v1/admin/skills/state` | 切换技能状态 |
| 重载配置 | `POST /api/v1/admin/config/reload` | 重新加载技能配置 |

**UI 交互:**
- 点击开关切换启用/禁用
- 显示技能来源 (Built-in / Workspace)
- 支持搜索过滤

### 3.3 Channels 渠道状态

| 功能 | API | 说明 |
|------|-----|------|
| 状态列表 | `GET /api/v1/admin/channels` | 显示所有渠道 |
| 连接状态 | 字段 `status` | connected/disconnected/error |

**UI 交互:**
- 颜色指示状态 (绿=正常, 红=断开, 黄=错误)
- 显示最后活跃时间

### 3.4 Cron 定时任务

| 功能 | API | 说明 |
|------|-----|------|
| 任务列表 | `GET /api/v1/admin/cron/jobs` | 显示所有任务 |
| 新增任务 | `POST /api/v1/admin/cron/jobs` | 创建定时任务 (TODO) |
| 删除任务 | `DELETE /api/v1/admin/cron/jobs` | 删除任务 (TODO) |

**UI 交互:**
- 显示任务名、调度表达式、下次执行时间
- 启用/禁用开关
- 上次执行状态

### 3.5 Sessions 会话管理

| 功能 | API | 说明 |
|------|-----|------|
| 会话列表 | `GET /api/v1/admin/sessions` | 当前已有功能 |
| 会话历史 | `GET /api/v1/admin/sessions/{key}/history` | 当前已有功能 |

## 4. API 接口清单

### 4.1 Skills

```typescript
// 获取技能列表
GET /api/v1/admin/skills
Response: { skills: [{ name, source, enabled }] }

// 设置技能状态
POST /api/v1/admin/skills/state
Body: { skill_name: string, enabled: boolean, persist?: boolean }
```

### 4.2 Channels

```typescript
// 获取渠道状态
GET /api/v1/admin/channels
Response: { channels: { [name]: { status, last_seen } }, enabled_channels: string[] }
```

### 4.3 Cron

```typescript
// 获取任务列表
GET /api/v1/admin/cron/jobs
Response: { jobs: [{ id, name, enabled, schedule, state }] }
```

## 5. 技术实现

### 5.1 组件结构

```
src/
├── components/
│   ├── Sidebar/
│   │   ├── Sidebar.tsx        # 主侧边栏
│   │   ├── SidebarNav.tsx    # 导航菜单
│   │   └── Dashboard.tsx      # 新增: Dashboard 入口按钮
│   └── Dashboard/
│       ├── DashboardPanel.tsx  # Dashboard 面板容器
│       ├── OverviewCards.tsx   # 概览卡片
│       ├── SkillsList.tsx      # 技能列表
│       ├── ChannelsList.tsx    # 渠道状态
│       └── CronList.tsx       # 定时任务
├── hooks/
│   └── useDashboard.ts        # Dashboard 数据获取
└── lib/
    └── dashboardApi.ts        # Dashboard API 封装
```

### 5.2 状态管理

- Dashboard 数据在独立 hook 中管理
- 支持手动刷新
- 自动刷新间隔: 30s

### 5.3 UI 样式

- 使用现有 CSS 变量
- 卡片使用 `bg-[var(--pc-bg-surface)]`
- 按钮使用现有组件样式
- 状态颜色:
  - 成功: `text-emerald-400`
  - 错误: `text-red-400`
  - 警告: `text-amber-400`
  - 禁用: `text-pc-text-muted`

## 6. 后续扩展

- [ ] 技能详情弹窗
- [ ] 新建 Cron 任务表单
- [ ] 会话搜索和过滤
- [ ] 渠道配置编辑
- [ ] 系统配置面板
- [ ] 日志查看器
