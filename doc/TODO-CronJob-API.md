# TODO: Cron Job API 前端对接

> 创建时间: 2026-03-20
> 状态: 待开发

---

## 一、背景

前端项目 `clawweb` 的 Dashboard 面板需要对接后端 `clawbot` 的 Cron Job API。当前实现情况：

| 功能 | 后端 API | 前端已实现 |
|------|----------|------------|
| 列出任务 | GET /cron/jobs | ✅ |
| 添加任务 | POST /cron/jobs | ❌ |
| 删除任务 | DELETE /cron/jobs | ❌ |
| 获取详情 | GET /cron/jobs/{job_id} | ❌ |
| 修改任务 | PATCH /cron/jobs/{job_id} | ❌ |
| 启用/禁用 | POST /cron/jobs/{job_id}/state | ❌ |

本 TODO 聚焦于 **详情、修改、启用/禁用** 三个 API 的前端对接。

---

## 二、涉及文件

| 文件 | 修改内容 |
|------|----------|
| `src/lib/nanobotApi.ts` | 添加 3 个 API 方法 |
| `src/hooks/useDashboard.ts` | 添加操作方法 |
| `src/components/Dashboard/CronList.tsx` | 添加详情/编辑/删除 UI |
| `src/components/Dashboard/DashboardPanel.tsx` | 传递回调函数 |
| `src/types/index.ts` | 扩展类型定义 |

---

## 三、后端 API 规格

### 3.1 获取任务详情

```
GET /api/v1/admin/cron/jobs/{job_id}
```

**响应:**
```json
{
  "applied": true,
  "data": {
    "id": "abc123",
    "name": "每日天气报告",
    "enabled": true,
    "delete_after_run": false,
    "schedule": {
      "kind": "cron",
      "expr": "0 7 * * *",
      "tz": "Asia/Shanghai"
    },
    "state": {
      "next_run_at": "2026-03-20T07:00:00+08:00",
      "last_run_at": "2026-03-19T07:00:00+08:00",
      "last_status": "success"
    }
  }
}
```

### 3.2 修改任务

```
PATCH /api/v1/admin/cron/jobs/{job_id}
```

**请求体 (全部可选):**
```json
{
  "name": "新名称",
  "schedule": {
    "kind": "cron",
    "expr": "0 8 * * *",
    "tz": "Asia/Shanghai"
  },
  "message": "新消息内容",
  "deliver": true,
  "channel": "telegram",
  "to": "user-id"
}
```

**响应:**
```json
{
  "applied": true,
  "data": {
    "job": { ... }
  }
}
```

### 3.3 启用/禁用任务

```
POST /api/v1/admin/cron/jobs/{job_id}/state
```

**请求体:**
```json
{
  "enabled": true
}
```

**响应:**
```json
{
  "applied": true,
  "data": {
    "job_id": "abc123",
    "enabled": true
  }
}
```

---

## 四、实现步骤

### Step 1: nanobotApi.ts - 添加 API 方法

**文件**: `src/lib/nanobotApi.ts`

添加以下方法到 `NanobotApiClient` 类:

```typescript
async getCronJob(jobId: string): Promise<NanobotApiResponse<{ job: CronJobDetail }>> {
  return this.request(`/v1/admin/cron/jobs/${encodeURIComponent(jobId)}`);
}

async updateCronJob(jobId: string, payload: Partial<CronJobUpdatePayload>): Promise<NanobotApiResponse<{ job: CronJobDetail }>> {
  return this.request(`/v1/admin/cron/jobs/${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

async setCronJobState(jobId: string, enabled: boolean): Promise<NanobotApiResponse<{ job_id: string; enabled: boolean }>> {
  return this.request(`/v1/admin/cron/jobs/${encodeURIComponent(jobId)}/state`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}
```

新增类型定义:

```typescript
export interface CronJobDetail {
  id: string;
  name: string;
  enabled: boolean;
  delete_after_run: boolean;
  schedule: {
    kind: string;
    at_ms?: number;
    every_ms?: number;
    expr?: string;
    tz?: string;
  };
  state: {
    next_run_at?: string;
    last_run_at?: string;
    last_status?: string;
  };
}

export interface CronJobUpdatePayload {
  name?: string;
  schedule?: CronJobDetail['schedule'];
  message?: string;
  deliver?: boolean;
  channel?: string;
  to?: string;
}
```

### Step 2: useDashboard.ts - 添加操作方法

**文件**: `src/hooks/useDashboard.ts`

扩展 `CronJob` 接口添加可选字段:

```typescript
export interface CronJob {
  // ... existing fields
  payload?: {
    message?: string;
    deliver?: boolean;
    channel?: string;
    to?: string;
  };
}
```

添加操作回调:

```typescript
const toggleCronJob = useCallback(async (jobId: string, enabled: boolean) => {
  if (!apiClient) return false;
  try {
    await apiClient.setCronJobState(jobId, enabled);
    setData(prev => ({
      ...prev,
      cronJobs: prev.cronJobs.map(j =>
        j.id === jobId ? { ...j, enabled } : j
      ),
    }));
    return true;
  } catch {
    return false;
  }
}, [apiClient]);

const deleteCronJob = useCallback(async (jobId: string) => {
  if (!apiClient) return false;
  try {
    await apiClient.deleteCronJob(jobId);
    setData(prev => ({
      ...prev,
      cronJobs: prev.cronJobs.filter(j => j.id !== jobId),
    }));
    return true;
  } catch {
    return false;
  }
}, [apiClient]);

const updateCronJob = useCallback(async (jobId: string, payload: any) => {
  if (!apiClient) return false;
  try {
    const res = await apiClient.updateCronJob(jobId, payload);
    if (res.applied) {
      setData(prev => ({
        ...prev,
        cronJobs: prev.cronJobs.map(j =>
          j.id === jobId ? { ...j, ...res.data.job } : j
        ),
      }));
    }
    return res.applied;
  } catch {
    return false;
  }
}, [apiClient]);
```

**注意**: 需在 `nanobotApi.ts` 添加 `deleteCronJob` 方法。

### Step 3: CronList.tsx - 添加交互 UI

**文件**: `src/components/Dashboard/CronList.tsx`

修改组件:

1. 添加 `onToggle`, `onDelete`, `onEdit` 回调 props
2. 每行添加操作按钮 (启用/禁用开关、删除)
3. 点击任务名称打开详情/编辑弹窗

```typescript
interface Props {
  jobs: CronJob[];
  onToggle: (jobId: string, enabled: boolean) => void;
  onDelete: (jobId: string) => void;
  onEdit: (job: CronJob) => void;
}
```

### Step 4: DashboardPanel.tsx - 传递回调

**文件**: `src/components/Dashboard/DashboardPanel.tsx`

```typescript
const { data, fetchAll, toggleSkill, reloadConfig, toggleCronJob, deleteCronJob, updateCronJob } = useDashboard(apiClient);

// cron tab
<CronList 
  jobs={data.cronJobs} 
  onToggle={toggleCronJob}
  onDelete={deleteCronJob}
  onEdit={updateCronJob}
/>
```

### Step 5: 类型导出 (可选)

**文件**: `src/types/index.ts`

如果需要集中管理类型，在此处导出 CronJob 相关类型。

---

## 五、UI 设计

### 5.1 CronList 当前布局

```
┌─────────────────────────────────────┐
│ [📅] 每日天气报告    [Active]       │
│      0 7 * * *                      │
│      Next: 2026-03-20 07:00         │
│      ✓ Last: 2026-03-19 07:00       │
└─────────────────────────────────────┘
```

### 5.2 期望布局

```
┌─────────────────────────────────────────┐
│ [📅] 每日天气报告    [Active] [🖊] [🗑] │
│      0 7 * * *                         │
│      Next: 2026-03-20 07:00            │
│      ✓ Last: 2026-03-19 07:00          │
└─────────────────────────────────────────┘
```

- 点击 `[Active]` 可切换启用状态
- 点击 `[🖊]` 打开编辑弹窗
- 点击 `[🗑]` 确认删除

### 5.3 详情/编辑弹窗

使用类似 SettingsModal 的弹窗设计，包含:

- 任务名称 (可编辑)
- Cron 表达式 (可编辑)
- 时区 (可编辑)
- 消息内容 (可编辑)
- 交付渠道 (可编辑)
- 启用状态 (开关)
- 运行历史 (只读)

---

## 六、注意事项

1. **错误处理**: 所有 API 调用需要 try-catch，用户操作失败时显示 toast 提示
2. **乐观更新**: 操作成功后立即更新 UI，失败时回滚
3. **确认删除**: 删除操作需二次确认
4. **i18n**: 所有文案需支持国际化
5. **类型安全**: 保持 TypeScript 严格类型检查

---

## 七、验收标准

- [ ] `getCronJob` API 对接成功
- [ ] `updateCronJob` API 对接成功
- [ ] `setCronJobState` API 对接成功
- [ ] CronList 界面可查看任务详情
- [ ] CronList 界面可编辑任务
- [ ] CronList 界面可删除任务
- [ ] 启用/禁用开关正常工作
- [ ] 错误提示正常显示
- [ ] 类型检查通过
- [ ] ESLint 检查通过
