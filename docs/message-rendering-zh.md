# PinchChat 消息渲染机制文档

## 1. 概述

PinchChat 是一个基于 OpenClaw Gateway 的 WebChat UI，其消息渲染系统负责将后端推送的消息流渲染为用户可交互的界面。

### 核心文件

| 文件 | 职责 |
|------|------|
| `src/components/Chat.tsx` | 消息列表容器，管理滚动、分组、日期分隔符 |
| `src/components/ChatMessage.tsx` | 单条消息渲染核心组件 |
| `src/components/ThinkingBlock.tsx` | 思考过程块渲染 |
| `src/components/ToolCall.tsx` | 工具调用块渲染 |
| `src/components/ImageBlock.tsx` | 图片块渲染 |
| `src/components/DocumentPreview.tsx` | 文档预览（Markdown/HTML/视频/其他） |
| `src/components/HtmlPreview.tsx` | HTML 内容预览 |
| `src/lib/messageCache.ts` | IndexedDB 消息缓存（会话压缩后保留历史） |
| `src/types/index.ts` | 类型定义 |

---

## 2. 数据模型

### ChatMessage 结构

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;              // 原始文本内容
  timestamp: number;
  blocks: MessageBlock[];       // 结构化块数组
  isStreaming?: boolean;        // 是否为流式消息
  runId?: string;
  isSystemEvent?: boolean;      // 系统事件消息
  metadata?: Record<string, unknown>;
  multimodalResponse?: MultimodalResponse;
  sendStatus?: 'sending' | 'sent' | 'error';
  streamStartedAt?: number;
  generationTimeMs?: number;
  isArchived?: boolean;         // 缓存消息标记
  isCompactionSeparator?: boolean; // 上下文压缩分隔符
}
```

### MessageBlock 类型

```typescript
type MessageBlock =
  | { type: 'text'; text: string }           // 文本块
  | { type: 'thinking'; text: string }       // 思考块
  | { type: 'tool_use'; name: string; input: Record<string, unknown>; id?: string }
  | { type: 'tool_result'; content: string; toolUseId?: string; name?: string }
  | { type: 'image'; mediaType: string; data?: string; url?: string };
```

**⚠️ 当前没有 `task` 类型的块**。任务相关数据存在于：
- `tool_result.content` 中（可能包含任务描述）
- `metadata.subagent_task_id` 等字段（见 `CronLogEntry`）

---

## 3.1 DocumentPreview 文档渲染子系统

`DocumentPreview.tsx` 是一条独立于 `MessageBlock` 的文档渲染通道。

### 3.1.1 两条渲染通道

| 通道 | 数据来源 | 组件 |
|------|----------|------|
| `DocumentPreview` | `message.multimodalResponse.media` | `DocumentPreview.tsx` |
| `HtmlPreview` | `message.content` 字符串中的文件路径 | `HtmlPreview.tsx` |

**HtmlPreview 路径提取**（`extractHtmlPath`）使用正则匹配：
```typescript
const patterns = [
  /\/Users\/[^\s]+\.html/,
  /\/home\/[^\s]+\.html/,
  /[A-Za-z]:\\[^\s]+\.html/,
  /\.nanobot\/[^\s]+\.html/,
  /\/var\/[^\s]+\.html/,
  /\/tmp\/[^\s]+\.html/,
];
```

### 3.1.2 DocumentPreview 支持的文件类型

| 文件类型 | 检测方式 | 渲染方式 |
|----------|----------|----------|
| markdown | 扩展名 `.md`/`.txt` 或 `mimeType === 'text/markdown'` | `LazyMarkdown` + 目录侧边栏（解析 `#` headers） |
| html | 扩展名 `.html`/`.htm` | `iframe sandbox` + echarts/chart 样式自动注入 |
| image | 扩展名 `.png`/`.jpg`/`.jpeg`/`.webp`/`.gif`/`.svg` | `<img>` |
| video | 扩展名 `.mp4`/`.webm`/`.mov`/`.mkv` | `<video controls>` |
| other | 其他所有类型 | `<pre>` 原始文本显示 |

### 3.1.3 提取函数

```typescript
// 从 multimodalResponse.media 提取文档（排除图片类型）
extractDocuments(multimodalResponse): DocumentInfo[]

// 从 multimodalResponse.media 提取图片
extractImages(multimodalResponse): DocumentInfo[]

// 从 multimodalResponse.media 提取 HTML 文档
extractHtmlDocuments(multimodalResponse): HtmlDocumentInfo[]
```

### 3.1.4 Markdown 目录生成

```typescript
function parseHeaders(content: string): Header[] {
  // 匹配 # 到 ###### 标题
  const match = line.match(/^(#{1,6})\s+(.*)/);
  // 生成 id: text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
}
```

### 3.1.5 HTML 渲染特殊处理

HTML 类型会注入额外的样式和脚本：
- 图表容器强制 `width: 100%; height: 100vh`
- 自动触发 `echarts.resize()` 和 `Chart.resize()`
- `window.dispatchEvent(new Event('resize'))` 触发响应式调整

---

## 3.2 ChatMessage.tsx 中的渲染调用

```typescript
// 1. multimodalResponse 中的图片
{message.multimodalResponse && extractImages(message.multimodalResponse).map((img, i) => (
  <ImageBlock key={`img-${i}`} src={`/api/v1/admin/assets/${img.assetId}/download`} alt={img.fileName} />
))}

// 2. content 中的 HTML 路径
{extractHtmlPath(message.content || '') && (
  <HtmlPreview filePath={extractHtmlPath(message.content || '') as string} />
)}

// 3. multimodalResponse 中的文档
{message.multimodalResponse && extractDocuments(message.multimodalResponse).map((doc, i) => (
  <DocumentPreview key={`doc-${i}`} assetId={doc.assetId} fileName={doc.fileName} mimeType={doc.mimeType} />
))}
```

---

## 3. 渲染流程

```
WebSocket Frame
      ↓
useGateway.ts handleEvent()
      ↓
setMessages() → Chat.tsx
      ↓
visibleMessages (过滤 + 分组)
      ↓
ChatMessageComponent (逐条渲染)
      ↓
├── SystemEventMessage     (isSystemEvent)
├── InternalOnlyMessage    (仅内部块，无用户可见文本)
└── Standard Message      (常规消息)
       ├── Avatar
       ├── Bubble
       │    ├── CollapsibleContent (长内容折叠)
       │    ├── TextBlocks (LazyMarkdown)
       │    ├── ImageBlocks (from multimodalResponse.media)
       │    ├── HtmlPreview (from content path)
       │    ├── DocumentPreview (from multimodalResponse.media)
       │    ├── MultimodalResponse (images/documents)
       │    ├── StreamingIndicator
       │    ├── InternalsSummary (thinking/tool_use/tool_result)
       │    └── ActionButtons
       └── Timestamp + Status
```

---

## 4. Chat.tsx 关键逻辑

### 4.1 消息过滤

```typescript
function hasVisibleContent(msg: ChatMessage): boolean {
  if (msg.role === 'user') return true;
  if (msg.role === 'assistant' && isNoReply(msg)) return false;
  if (msg.blocks.length === 0) return !!msg.content;
  return msg.blocks.some(b =>
    (b.type === 'text' && b.text.trim()) ||
    b.type === 'thinking' ||
    b.type === 'tool_use' ||
    b.type === 'tool_result'
  );
}
```

**⚠️ 问题点**：`hasVisibleContent` 不检查 `image` 类型的块！如果有图片消息但无文本，`hasVisibleContent` 返回 `false`，消息可能被过滤掉。

### 4.2 消息分组

```typescript
const GROUP_GAP_MS = 2 * 60 * 1000; // 2分钟内的连续消息归为同一组
const isFirstInGroup = showSep || !prev || 
                       prev.msg.role !== msg.role || 
                       prev.msg.isSystemEvent !== msg.isSystemEvent || 
                       (msg.timestamp - prev.msg.timestamp > GROUP_GAP_MS);
```

### 4.3 日期分隔符

按日期分组显示分隔符，同一天消息不显示分隔。

---

## 5. ChatMessage.tsx 渲染逻辑

### 5.1 渲染决策树

```
isSystemEvent → SystemEventMessage
    ↓ 否
blocks.length > 0 && !hasText && !isStreaming → InternalOnlyMessage
    ↓ 否
Standard Message Rendering
```

### 5.2 InternalOnlyMessage（纯内部消息）

当 assistant 消息只有 `thinking`、`tool_use`、`tool_result` 块而无用户可见文本时，显示为 `InternalOnlyMessage`：

```typescript
function InternalOnlyMessage({ message }) {
  return (
    <div className="animate-fade-in flex gap-3 px-4 py-1">
      <div className="shrink-0 mt-0.5 flex h-6 w-6 items-center justify-center ...">
        <Wrench className="h-3 w-3 text-pc-text-muted" />
      </div>
      <div className="min-w-0 flex-1">
        {renderInternalBlocks(message.blocks)}
      </div>
    </div>
  );
}
```

### 5.3 文本块渲染

```typescript
function renderTextBlocks(blocks: MessageBlock[]) {
  return getTextBlocks(blocks).map((block, i) => (
    <div key={`text-${i}`} className="markdown-body">
      <LazyMarkdown components={markdownComponents}>
        {autoFormatText(block.text)}
      </LazyMarkdown>
    </div>
  ));
}
```

### 5.4 内部块渲染

```typescript
function renderInternalBlocks(blocks: MessageBlock[]) {
  const internals = getInternalBlocks(blocks); // thinking | tool_use | tool_result
  for (let i = 0; i < internals.length; i++) {
    const block = internals[i];
    if (block.type === 'thinking') {
      elements.push(<ThinkingBlock key={`int-${i}`} text={block.text} />);
    } else if (block.type === 'tool_use') {
      const nextBlock = internals[i + 1];
      const result = nextBlock?.type === 'tool_result' ? nextBlock.content : undefined;
      elements.push(<ToolCall key={`int-${i}`} name={block.name} input={block.input} result={result} />);
      if (result !== undefined) i++; // 跳过已配对的 tool_result
    } else if (block.type === 'tool_result') {
      elements.push(<ToolCall key={`int-${i}`} name={block.name || 'tool'} result={block.content} />);
    }
  }
  return elements;
}
```

**⚠️ 问题点**：`renderInternalBlocks` 假设 `tool_use` 后面紧跟对应的 `tool_result`。如果块顺序不同或交错，会导致配对错误。

### 5.5 折叠长内容

```typescript
const COLLAPSE_THRESHOLD = 3000; // 字符数阈值
const COLLAPSED_MAX_HEIGHT = 400; // px

function CollapsibleContent({ content, isStreaming, children }) {
  const shouldCollapse = !isStreaming && content.length > COLLAPSE_THRESHOLD;
  // 渲染折叠 UI 或完整内容
}
```

---

## 6. 任务相关场景分析

### 6.1 当前任务表示方式

任务（Task）在当前架构中**没有**专门的 `MessageBlock` 类型。任务信息可能出现在：

1. **Tool Result 中**：任务执行结果作为 `tool_result.content` 返回
2. **CronLogEntry metadata**：
   ```typescript
   interface CronLogEntry {
     role: 'user' | 'assistant' | 'tool';
     content: string;
     tool_calls?: Array<{ name: string; input: Record<string, unknown> }>;
     metadata?: {
       subagent_task_id?: string;
       subagent_label?: string;
       subagent_status?: string;
     };
   }
   ```
3. **ExecutionTimeline.tsx**：独立的任务执行时间线组件，不在消息流中

### 6.2 潜在问题

| 场景 | 问题 | 影响 |
|------|------|------|
| 任务块无文本 | 如果任务消息只有 `tool_use/tool_result`，会被 `hasVisibleContent` 判定为不可见 | 任务消息不显示 |
| 任务作为 tool_result | `renderInternalBlocks` 假设 tool_use-tool_result 配对 | 如果任务结果单独返回，配对失败 |
| 长任务内容 | 任务描述过长时折叠逻辑仅基于 `content` 长度 | 任务信息可能被意外折叠 |
| 任务中的图片 | 图片块不触发 `hasVisibleContent` | 带图片的任务可能不显示 |

---

## 7. 流式渲染

### 7.1 流式消息处理

```typescript
// useGateway.ts
if (event.eventType === 'progress') {
  setMessages(prev => {
    const last = prev[prev.length - 1];
    if (last && last.role === 'assistant' && last.isStreaming && last.runId === event.eventId) {
      // 更新现有流式消息
      return [...prev.slice(0, -1), updated];
    }
    // 创建新流式消息
    return [...prev, { ...msg, isStreaming: true, streamStartedAt: Date.now() }];
  });
}
```

### 7.2 流式指示器

```typescript
{message.isStreaming && (
  hasVisibleContent 
    ? <ThinkingIndicator />  // 无可见内容时显示
    : null
)}
```

---

## 8. 消息缓存与压缩

### 8.1 IndexedDB 缓存

```typescript
// messageCache.ts
export async function setCachedMessages(sessionKey: string, messages: ChatMessage[]): Promise<void>
export async function getCachedMessages(sessionKey: string): Promise<ChatMessage[]>
```

### 8.2 压缩合并

```typescript
export function mergeWithCache(gatewayMessages, cachedMessages) {
  // 检测压缩：cached 有但 gateway 没有的消息
  const missingFromGateway = cachedMessages.filter(m => !gatewayIds.has(m.id));
  
  // 标记为已归档，插入压缩分隔符
  const separator: ChatMessage = {
    id: 'compaction-separator-' + Date.now(),
    isCompactionSeparator: true,
    // ...
  };
  
  return { messages: [...archivedMessages, separator, ...gatewayMessages], wasCompacted: true };
}
```

---

## 9. 已知问题与优化建议

### 问题 1：`hasVisibleContent` 不检查 image/document 块

```typescript
// 当前实现
return msg.blocks.some(b =>
  (b.type === 'text' && b.text.trim()) ||
  b.type === 'thinking' ||
  b.type === 'tool_use' ||
  b.type === 'tool_result'
);
// 缺失: b.type === 'image'
```

**更严重的是**：`hasVisibleContent` **完全不检查 `multimodalResponse`**！

如果一条消息只有 `multimodalResponse`（包含图片/文档），没有 `content` 也没有任何 `blocks`，这条消息会被判定为**不可见**并被过滤掉。

**修复建议**：
1. 添加 `b.type === 'image'` 检查
2. 或者：如果 `message.multimodalResponse` 存在且有 media，应该视为可见

### 问题 2：tool_use 与 tool_result 配对逻辑脆弱

当前实现假设 `tool_use` 后面**紧跟**对应的 `tool_result`，但协议并未保证此顺序。

**修复建议**：通过 `toolUseId` / `tool_result.toolUseId` 进行匹配，而非依赖顺序。

### 问题 3：任务消息可能不显示

当任务仅以 `tool_use` + `tool_result` 形式返回，无任何 `text` 块时：
- `hasVisibleContent` 返回 `false`（因不检查 `tool_use/tool_result`）
- 消息被过滤掉

**修复建议**：在 `hasVisibleContent` 中添加对 `tool_use`/`tool_result` 的检查。

### 问题 4：长任务内容折叠问题

折叠阈值基于 `message.content` 长度，但任务信息可能在 `tool_result.content` 中，不受折叠逻辑影响。

**建议**：如果需要，确保任务描述也被正确折叠。

### 问题 5：缺少 task 类型的 MessageBlock

当前任务信息分散在各处，缺乏统一的任务抽象。

**建议**：如果任务是你的核心功能，考虑添加：

```typescript
type MessageBlock =
  // ... existing types
  | { type: 'task'; taskId: string; status: 'pending' | 'running' | 'completed' | 'failed'; result?: string };
```

---

## 10. 调试技巧

### 启用 WebSocket 调试

```javascript
localStorage.setItem('pinchchat:debug', '1');
```

### 查看 Raw JSON

点击消息上的 `{ }` 按钮查看完整消息载荷。

### 查看 Metadata

Hover 消息，点击 ℹ️ 图标查看元数据。

---

## 11. 总结

消息渲染机制是一个涉及多个组件和数据流的复杂系统。当前架构设计良好，但存在一些边缘情况：

1. **`hasVisibleContent` 不检查 `multimodalResponse`** — 消息只有图片/文档时会被过滤
2. **image 块不触发消息可见性判断** — 可能导致图片消息被过滤
3. **tool_use/tool_result 配对依赖顺序** — 脆弱的假设
4. **缺少专门的任务块类型** — 任务信息表示分散

如果你的问题是"有任务的情况渲染有问题"，最可能的原因是**任务消息被 `hasVisibleContent` 过滤掉**（因为它只有 multimodalResponse 而没有 text blocks），或者**任务以 tool_use/tool_result 形式返回但配对逻辑失败**。

建议首先检查：
1. Network 面板中任务消息的实际载荷
2. `hasVisibleContent` 是否正确识别任务消息
3. `renderInternalBlocks` 的配对逻辑是否正确处理任务块
4. 任务消息是否有 `multimodalResponse` 但没有 `content`/`blocks`
