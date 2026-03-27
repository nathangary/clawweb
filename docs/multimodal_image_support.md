# 前端多模态图片支持 - 开发设计文档

## 1. 背景

后端 `clawbot` 已重新支持多模态，现在支持三种图片传入方式：
1. **Base64 内联**: `data:image/png;base64,{b64_data}`
2. **HTTP URL**: 直接传图片 URL
3. **本地文件路径**: `file://{path}`

前端需要适配这些新的传输格式。

## 2. 现状分析

### 2.1 后端 `contracts.py` 的媒体解析逻辑

```python
# 接收的媒体格式
media: list[str]  # 支持 data:URL, http://, file:// 路径
attachments: list[TransportAttachment]  # { type, url, localPath }

# to_bus_message() 解析逻辑:
- 以 "data:" 开头 → 解析为 base64
- 以 "http" 开头 → 作为 URL
- 以 "file://" 开头 → 作为本地文件路径
```

### 2.2 前端现状

**发送端 (`ChatInput.tsx` → `nanobotGateway.ts`)**:
- 图片压缩后 base64 存入 `attachments[].content`
- `nanobotGateway.ts` 转换为 `{ type, url: '', localPath: content }`
- 问题: `localPath` 字段名不对，应该用 `base64` 或直接用 `media` 字段

**接收端 (`useGateway.ts`)**:
- 实时消息: 通过 `sendMessage` 构造 `MessageBlock`，`data: base64`
- 历史消息 (`loadHistory`): 从 `/api/v1/files/` 构造 URL

### 2.3 问题点

1. 发送格式不匹配: 传给后端的是 `attachments[].localPath`，但后端期望 `media` 字段或 `attachments[].localPath`
2. 历史消息图片解析逻辑: 从 `m.media` 提取相对路径再拼接 `/api/v1/files/`，但后端现在返回的可能是 base64 或其他格式
3. 实时消息图片: 当前直接用 `data:base64`，与后端格式一致

## 3. 方案设计

### 3.1 发送端适配

**方案**: 统一使用 `media` 字段传递 base64

修改 `nanobotGateway.ts` 的 `send()` 方法:
```typescript
// 修改前
if (attachments?.length) {
  msg.attachments = attachments.map(a => ({
    type: a.mimeType,
    url: '',
    localPath: a.content,
  }));
}

// 修改后
if (attachments?.length) {
  msg.media = attachments.map(a => 
    `data:${a.mimeType};base64,${a.content}`
  );
  // 移除 attachments 字段（后端支持从 media 解析）
}
```

### 3.2 接收端适配

#### 3.2.1 实时消息的图片渲染

当前 `sendMessage` 构造的 `MessageBlock` 已经正确:
```typescript
const imageBlocks = attachments
  .filter(a => a.mimeType.startsWith('image/'))
  .map(a => ({ type: 'image' as const, mediaType: a.mimeType, data: a.content }));
```

这部分不需要修改。

#### 3.2.2 历史消息的图片解析

修改 `useGateway.ts` 的 `loadHistory` 函数:

后端返回的消息格式可能变化:
- 旧版: `m.media` 是路径数组
- 新版: `m.media` 可能是 base64 数组或 URL 数组

需要兼容多种格式:
```typescript
// 解析媒体
if (m.media && Array.isArray(m.media)) {
  for (const path of m.media) {
    let block;
    if (path.startsWith('data:')) {
      // base64 内联
      const match = path.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        block = { type: 'image' as const, mediaType: match[1], data: match[2] };
      }
    } else if (path.startsWith('http')) {
      // HTTP URL
      block = { type: 'image' as const, mediaType: 'image/jpeg', url: path };
    } else {
      // 本地文件路径 - 拼接 API URL
      const match = path.match(/workspace[/\\](.+)$/);
      const relativePath = match ? match[1] : path;
      const url = `${baseUrl}/api/v1/files/${encodeURIComponent(relativePath)}`;
      block = { type: 'image' as const, mediaType: 'image/jpeg', url };
    }
    if (block) blocks.push(block);
  }
}
```

### 3.3 数据流图

```
用户选择图片
    ↓
ChatInput.tsx: 压缩图片 → base64
    ↓
nanobotGateway.ts: 构造 media: ["data:image/jpeg;base64,..."]
    ↓
WebSocket → 后端
    ↓
contracts.py: 解析 media → MediaItem.base64_data
    ↓
Agent 处理 → 返回
    ↓
useGateway.ts: 解析 OutboundEvent → MessageBlock (image)
    ↓
ChatMessage.tsx: renderImageBlocks → ImageBlock 组件
```

## 4. 修改清单

| 文件 | 修改内容 |
|------|----------|
| `src/lib/nanobotGateway.ts` | `send()` 方法: 用 `media` 字段替代 `attachments` |
| `src/hooks/useGateway.ts` | `loadHistory()`: 兼容 base64/URL/文件路径三种格式 |

## 5. 测试用例

1. 上传本地图片 → 发送 → 确认显示正常
2. 粘贴图片 → 发送 → 确认显示正常
3. 拖拽图片 → 发送 → 确认显示正常
4. 查看历史消息中的图片 → 确认显示正常
5. 发送纯文本 → 确认图片功能无影响