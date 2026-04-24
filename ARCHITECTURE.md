# PinchChat 前端架构文档

## 项目概况

| 维度 | 详情 |
|------|------|
| 名称 | PinchChat (clawweb) v1.70.0 |
| 类型 | AI Agent WebChat 前端 SPA |
| 技术栈 | React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand |
| 通信 | WebSocket 实时流 + REST API |
| Node | >=20.19（fnm 管理，当前 22.x） |
| 构建 | `npm run build`（Vite，约 4s） |
| 测试 | `npm test`（Vitest + jsdom，已知 2 file fail 是 ESM 兼容问题） |
| Lint | `npm run lint`（当前 ~1500 errors，主要在 skills/ 目录和 any 类型） |

## 目录结构

```
src/
├── components/          # UI 组件
│   ├── AgentOrchestrator/   # 智能体编排页（创建/编辑/测试/激活）
│   ├── AgentAssets/         # 智能体资产页
│   ├── HistoryFiles/        # 历史文件页
│   ├── DocumentPreview.tsx  # 文档预览
│   ├── Chat.tsx             # 对话主区域（虚拟滚动）
│   ├── ChatMessage.tsx      # 单条消息（bubble + 选区操作）
│   ├── ChatInput.tsx        # 输入框（IME composing、图片压缩、附件）
│   ├── ThinkingBlock.tsx    # 思考过程折叠块
│   ├── ThinkingIndicator.tsx # 流式推理计时指示器
│   ├── ToolCall.tsx         # 工具调用折叠块（颜色系统 + 上下文提示）
│   ├── CodeBlock.tsx        # 代码块（行号/折叠/wrap/语言标签/copy）
│   ├── LazyMarkdown.tsx     # 懒加载 Markdown 渲染
│   ├── ImageBlock.tsx       # 图片块 + Lightbox
│   ├── Sidebar.tsx          # 侧边栏（session 列表 + 拖拽排序）
│   ├── Header.tsx           # 顶栏
│   ├── LoginScreen.tsx      # 登录页
│   ├── MessageSearch.tsx    # 消息搜索
│   ├── ThemeSwitcher.tsx    # 主题切换面板
│   └── ...
├── contexts/            # React Context
│   ├── ThemeContext.tsx      # 主题（3 模式 × 6 强调色 × 字体字号）
│   └── ToolCollapseContextDef.ts  # 工具调用全局展开/折叠
├── hooks/               # 自定义 Hooks
│   ├── useAgentEventStream.ts   # 智能体事件流（统一 4 个 handler）
│   ├── usePersistedOpen.ts      # 折叠状态持久化（虚拟滚动卸载后恢复）
│   ├── useGateway.ts            # WebSocket 连接管理
│   ├── useToolCollapse.ts       # 工具折叠全局状态
│   ├── useBookmarks.ts         # 消息书签
│   ├── useSendShortcut.ts      # Enter/Ctrl+Enter 发送偏好
│   ├── useTheme.ts             # 主题 hook
│   ├── useLocale.ts            # i18n
│   └── ...
├── lib/                 # 工具库
│   ├── nanobotGateway.ts  # WebSocket 客户端（重连、去重、ack）
│   ├── nanobotApi.ts      # REST API 客户端
│   ├── rules.ts           # 规则 CRUD + 缓存
│   ├── credentials.ts     # Token 管理（localStorage）
│   ├── messageHandler.ts  # 流式消息累积（progress → tool_hint → final）
│   ├── i18n.ts            # 零依赖 i18n
│   ├── clipboard.ts       # 剪贴板
│   ├── notificationSound.ts # 通知音效
│   ├── exportChat.ts       # 导出 Markdown
│   └── highlight.ts        # hljs 配置
├── stores/              # Zustand Store
│   ├── chatStore.ts       # 消息 + session 状态
│   └── connectionStore.ts  # 连接状态
├── types/               # TypeScript 类型
│   └── index.ts           # ChatMessage、MessageBlock、Session 等
├── skills/              # ⚠️ 运行时 agent skill（81 个 @ts-nocheck，不应改）
└── main.tsx             # 入口
```

## 关键架构决策

### 1. 虚拟滚动（@tanstack/react-virtual）

Chat.tsx 使用虚拟滚动，只渲染可视区域 ±5 条消息。

- **estimateSize**：根据消息类型估算高度（InternalOnlyMessage 44px，普通消息 80-400px + toolCount × 36px）
- **measureElement**：渲染后动态测量真实高度
- **animate-fade-in**：用模块级 `Set<msgId>` 追踪，只在首次出现时播放动画，虚拟滚动重挂载不重播
- **TypingIndicator**：放在虚拟容器外部独立渲染，避免 absolute 定位冲突

### 2. 折叠状态持久化（usePersistedOpen）

ThinkingBlock 和 ToolCall 的展开/折叠状态用模块级 `Map<string, boolean>` 持久化。
虚拟滚动卸载组件后重挂载时，状态从 Map 恢复。

- ThinkingBlock key: `thinking-${text.slice(0, 40)}`
- ToolCall key: `tool-${name}-${JSON.stringify(input).slice(0, 60)}`

### 3. tool_use + tool_result 配对

ChatMessage.tsx 的 `renderInternalBlocks` 改为按 `toolUseId` 匹配配对，不再依赖相邻性。
中间插 thinking 块不会断配对。兜底仍检查相邻。

### 4. 智能体编排事件流（useAgentEventStream）

4 个操作（创建/激活/编辑/测试）的事件处理统一到一个 hook：

```
useAgentEventStream() → { messages, clearMessages, startStream, cancelStream }
```

- hook 内部自管消息状态（useState）
- startStream 内部：cancelStream → setMessages([]) → setChatId → send → onEvent
- progress/tool_hint 事件 → setMessages(prev => applyXxx(event, prev))
- final 事件 → 调用 onFinal 回调
- error 事件 → 调用 onError 回调
- cancelStream 强制断开旧 stream，避免竞态

渲染统一用 `StreamMessageList` 组件（ThinkingBlock + ToolCall + LazyMarkdown）。

### 5. XSS 防护

ToolCall.tsx 的 hljs 输出用 `DOMPurify.sanitize()` 包裹后再 dangerouslySetInnerHTML。

### 6. 主题系统

CSS 变量命名空间 `--pc-*`，3 主题（light/dark/oled）× 6 强调色（cyan/violet/emerald/amber/rose/blue）× 字体字号。
通过 `applyVars()` 一次性刷到 `:root`，`resolveTheme('system')` 监听 prefers-color-scheme。

## 已知问题 & 待修

| 优先级 | 问题 | 说明 |
|--------|------|------|
| P1 | Token 明文 localStorage | credentials.ts:23，建议 HttpOnly Cookie |
| P1 | ESLint ~1500 errors | 主要是 skills/ 和 any 类型，skills/ 应从 ESLint scope 排除 |
| P2 | Sidebar 拖拽排序粗糙 | 无 dragGhost/dragImage，体验"能用但不丝滑" |
| P2 | ImageBlock Lightbox 无缩放/拖拽 | 只有 max-w/max-h img，缺 pinch/pan |
| P2 | 全局事件监听耦合 | mousedown 5个、keydown 4个、DOMContentLoaded 3个死代码 |
| P2 | DOMContentLoaded 死代码 | HistoryFilesPage/AgentAssetsPage/DocumentPreview 的 DOMContentLoaded 永远不会在 SPA 里触发 |
| P3 | Chat.tsx 仍然较大 | 虽然虚拟滚动精简了 ref 管理，搜索/书签/导出仍在同一个文件 |
| P3 | useNotifications 的 click 监听 | 每次点击都跑一遍 requestPermission，应只注册一次 |
| P3 | Sidebar App.tsx 拖拽重复 | 两个组件各自写 onMove/onUp，应抽 useDragResize |

## 与我沟通的方式

### 改 UI 渲染
说"改 ThinkingBlock/ToolCall/ChatMessage 的渲染"，我会知道这些组件在 src/components/ 下，折叠状态用 usePersistedOpen，虚拟滚动下卸载重挂载。

### 改智能体编排
说"改智能体创建/编辑/测试/激活"，我会知道核心逻辑在 AgentOrchestratorPage.tsx，事件流用 useAgentEventStream hook，渲染用 StreamMessageList。

### 改对话/消息
说"改 Chat/消息列表/虚拟滚动"，我会知道 Chat.tsx 用 @tanstack/react-virtual，messageHandler.ts 处理流式累积，chatStore.ts 管理 session/消息状态。

### 改主题/样式
说"改主题/颜色/字体"，我会知道 ThemeContext.tsx 用 CSS 变量体系，Tailwind 插件在 vite.config.ts，index.css 定义了 --pc-* 变量。

### 改后端通信
说"改 WebSocket/API"，我会知道 nanobotGateway.ts 是 WS 客户端（重连/去重/ack），nanobotApi.ts 是 REST 客户端。

### 性能问题
说"长对话卡/滚动卡"，我会先查虚拟滚动的 estimateSize 精度和 overscan，再查 memo 是否生效（useCallback 包裹的回调才有效）。

### 安全问题
说"XSS/Token 安全"，我会知道 ToolCall 用了 DOMPurify，credentials.ts 明文存 token。
