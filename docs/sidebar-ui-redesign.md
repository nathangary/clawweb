# Sidebar UI 改版设计文档

## 变更背景

参考 ChatGPT、Grok 等主流 AI Chat UI 的设计，将 Dashboard 和 SkillHub 入口按钮放置在 Session List（历史记录）上方，与 Sidebar 宽度一致。

## 变更内容

### 1. 布局调整

**变更前：**
- Dashboard 和 SkillHub 按钮位于 Header 右侧（settings 按钮旁边）
- Session list 直接显示在搜索框下方

**变更后：**
- Dashboard 和 SkillHub 按钮移动到 Sidebar 中，位于 Filter chips 区域和 Session list 之间
- 两个按钮上下排列，宽度与 Sidebar 一致

### 2. 预期布局

```
┌─────────────────────────┐
│ [Logo]  Title    [New]  │  ← 顶部 header (h-14)
├─────────────────────────┤
│ [Search...]             │  ← 搜索框
├─────────────────────────┤
│ [All] [Active] [Cron]   │  ← Filter chips
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ ☷ Dashboard         │ │  ← 新增区域
│ ├─────────────────────┤ │
│ │ ✨ SkillHub         │ │     (按钮上下排列)
│ └─────────────────────┘ │
├─────────────────────────┤
│ ChatGPT  •••            │
│ Claude  •••             │  ← Session list
│ ...                     │
└─────────────────────────┘
```

### 3. UI 规范

- 两个按钮并排垂直排列
- 按钮样式：使用与 Sidebar 其他元素一致的样式
- 按钮图标 + 文字
- 宽度填满 Sidebar
- 按钮之间可用分隔线区分

## 技术实现

### 需要修改的文件

1. `src/components/Sidebar.tsx`
   - 在 Filter chips 和 Session list 之间添加一个新的区域
   - 渲染 Dashboard 和 SkillHub 按钮
   - 从 Header 移除这两个按钮（或保留但隐藏）

### Props 传递

Sidebar 组件需要接收：
- `onOpenDashboard?: () => void`
- `onOpenSkillHub?: () => void`

这些 props 来自 App.tsx，已经存在。

## 设计参考

- ChatGPT sidebar 设计
- Grok sidebar 设计

## 状态

- [x] 待开发
- [ ] 开发中
- [ ] 待测试
- [ ] 已完成