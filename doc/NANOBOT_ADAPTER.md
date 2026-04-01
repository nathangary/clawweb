# Nanobot 前端适配方案

> 本文档描述如何将 PinchChat（OpenClaw 前端）适配到 nanobot (clawbot) 后端

## 1. 背景

当前 `clawweb` 是为 OpenClaw Gateway 设计的 WebChat 前端，包含复杂的 WebSocket 握手协议和认证机制。目标是将此前端适配到 `/Users/nathan/AIGC/clawbot` 后端，实现无缝对接。

## 2. 现状分析

### 2.1 当前架构 (OpenClaw)

```
┌─────────────────────────────────────────────────────────────────┐
│                        PinchChat 前端                           │
├─────────────────────────────────────────────────────────────────┤
│  LoginScreen.tsx                                                │
│  - 要求输入 Gateway URL (ws://host:18789)                        │
│  - 要求输入 Token (authToken)                                    │
│  - 支持 token/password 两种认证模式                               │
│  - 支持 Client ID (设备标识)                                     │
├─────────────────────────────────────────────────────────────────┤
│  gateway.ts (GatewayClient)                                     │
│  - WebSocket 连接 + 复杂握手协议                                  │
│  - handleChallenge(): 响应 connect.challenge                     │
│  - 设备签名认证 (deviceIdentity)                                 │
│  - JSON-RPC 协议 (req/res/event)                                │
│  - 支持 reconnect 自动重连                                        │
├─────────────────────────────────────────────────────────────────┤
│  useGateway.ts                                                  │
│  - 依赖 OpenClaw 握手协议                                        │
│  - 处理 event=agent/chat 事件                                    │
│  - 期望消息状态: delta/final/error/aborted                       │
│  - 期望命令: sessions.list/chat.history/chat.send 等            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway                            │
│  - 默认端口: 18789                                               │
│  - 协议版本协商                                                  │
│  - connect.challenge 挑战-响应认证                               │
│  - 设备签名验证                                                  │
│  - JSON-RPC 消息格式                                             │
│  - 命令: sessions.list, chat.send, chat.history 等              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 目标架构 (nanobot)

```
┌─────────────────────────────────────────────────────────────────┐
│                        PinchChat 前端 (适配后)                    │
├─────────────────────────────────────────────────────────────────┤
│  LoginScreen.tsx (简化版)                                        │
│  - 仅需 Gateway URL                                              │
│  - Token 改为可选 (nanobot 可无认证)                              │
│  - 移除 Client ID (暂不需要)                                      │
├─────────────────────────────────────────────────────────────────┤
│  gateway.ts (NanobotGatewayClient)                               │
│  - 简化连接: 直接连接，无握手                                     │
│  - 可选 auth_token 认证                                          │
│  - 简化消息协议: 直接发送消息                                     │
│  - 支持 bind 机制订阅会话                                        │
│  - 支持 reconnect 自动重连                                        │
├─────────────────────────────────────────────────────────────────┤
│  useGateway.ts (适配版)                                          │
│  - 处理 nanobot 事件: progress/tool_hint/final/error             │
│  - 适配 nanobot 命令格式                                         │
│  - 消息状态映射                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     nanobot Transport Gateway                   │
│  - 默认端口: 8787                                                │
│  - 可选 auth_token (默认空 = 无认证)                              │
│  - 直接消息格式 (无握手)                                          │
│  - 消息字段: messageId/channel/chatId/senderId/content          │
│  - bind 命令订阅会话                                             │
│  - 事件推送: eventId/eventType/chatId/sessionKey/content       │
└─────────────────────────────────────────────────────────────────┘
```

## 3. 协议差异对比

### 3.1 WebSocket 连接

| 项目 | OpenClaw | nanobot |
|------|----------|---------|
| 端口 | 18789 | 8787 (Transport) |
| 握手 | 需要 challenge-response | 无，直接发送 |
| 认证 | Token + 设备签名 | 可选 token |
| Client ID | 需要 (webchat) | 不需要 |

### 3.2 消息格式

**OpenClaw 发送消息:**
```json
{
  "type": "req",
  "id": "uuid",
  "method": "chat.send",
  "params": {
    "sessionKey": "agent:main:main",
    "message": "Hello",
    "deliver": false
  }
}
```

**nanobot 发送消息:**
```json
{
  "messageId": "uuid",
  "channel": "transport",
  "chatId": "web-001",
  "senderId": "web-user",
  "content": "Hello"
}
```

### 3.3 事件格式

**OpenClaw 事件:**
```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "state": "delta",
    "runId": "uuid",
    "sessionKey": "agent:main:main",
    "message": { "content": "..." }
  }
}
```

**nanobot 事件:**
```json
{
  "eventId": "uuid",
  "eventType": "progress",
  "channel": "transport",
  "chatId": "web-001",
  "sessionKey": "transport:web-001",
  "content": "...",
  "done": false
}
```

### 3.4 会话订阅

**OpenClaw:** 通过初始握手自动获取会话列表

**nanobot:** 使用 `bind` 命令订阅:
```json
{
  "type": "bind",
  "session_key": "transport:web-001",
  "chat_id": "web-001"
}
```

## 4. 修改清单

### 4.1 LoginScreen.tsx

**修改项:**
1. 移除 Token 输入框（或改为可选）
2. 移除 Auth Mode 切换 (token/password)
3. 移除 Client ID 高级设置
4. 调整默认端口为 8787
5. 更新 UI 提示文案

### 4.2 gateway.ts

**完全重写为 NanobotGatewayClient:**

| 方法 | 说明 |
|------|------|
| `connect()` | 直接建立 WebSocket 连接，无握手 |
| `disconnect()` | 关闭连接 |
| `send(message)` | 发送消息 (使用 nanobot 格式) |
| `bind(sessionKey, chatId)` | 订阅会话 |
| `ack(eventId)` | 确认收到事件 |

**消息类型映射:**
```typescript
// nanobot 发送格式
interface NanobotMessage {
  messageId: string;
  channel: string;
  chatId: string;
  senderId: string;
  content: string;
  sessionKey?: string;
  media?: string[];
  attachments?: any[];
  metadata?: Record<string, any>;
  ts?: string;
}

// nanobot 事件格式
interface NanobotEvent {
  eventId: string;
  eventType: 'progress' | 'tool_hint' | 'final' | 'error';
  channel: string;
  chatId: string;
  sessionKey: string;
  content: string;
  metadata?: Record<string, any>;
  done: boolean;
  ts: string;
}
```

### 4.3 useGateway.ts

**适配事件处理:**

| OpenClaw 状态 | nanobot eventType | 处理逻辑 |
|---------------|-------------------|----------|
| `delta` | `progress` | 追加到消息内容 |
| `final` | `final` | 停止流式，刷新历史 |
| `error` | `error` | 显示错误消息 |
| `aborted` | - | 停止生成 |
| tool 事件 | `tool_hint` | 显示工具调用/结果 |

**命令映射:**

| OpenClaw 命令 | nanobot 方式 |
|---------------|--------------|
| `sessions.list` | REST API: `GET /api/v1/admin/sessions` |
| `chat.history` | REST API: `GET /api/v1/admin/sessions/{key}/history` |
| `chat.send` | WebSocket 消息 |
| `chat.abort` | (nanobot 暂无) |

### 4.4 credentials.ts

**简化存储:**
```typescript
interface StoredCredentials {
  url: string;
  token?: string;  // 可选
}
```

### 4.5 REST API 集成

nanobot 提供 REST API 用于管理功能:

| 端点 | 用途 |
|------|------|
| `GET /api/v1/admin/sessions` | 获取会话列表 |
| `GET /api/v1/admin/sessions/{key}` | 获取会话详情 |
| `GET /api/v1/admin/sessions/{key}/history` | 获取历史消息 |
| `GET /api/v1/admin/skills` | 获取技能列表 |
| `GET /api/v1/admin/channels` | 获取渠道状态 |

**注意:** REST API 需要 token 认证（如果配置了 `rest_api.token`）

## 5. 目录结构

```
clawweb/src/
├── components/
│   └── LoginScreen.tsx        # [修改] 简化登录界面
├── hooks/
│   └── useGateway.ts          # [修改] 适配 nanobot 协议
├── lib/
│   ├── gateway.ts             # [重写] NanobotGatewayClient
│   ├── credentials.ts          # [修改] 简化凭证存储
│   ├── nanobotApi.ts          # [新增] REST API 客户端
│   └── messageParser.ts       # [新增] 消息解析/映射
└── types/
    └── index.ts               # [修改] 添加 nanobot 类型定义
```

## 6. 实现步骤

### Phase 1: 核心连接 (基础可用)

1. 创建 `src/lib/nanobotGateway.ts`
   - 实现 WebSocket 连接
   - 实现消息发送/接收
   - 实现 bind 订阅机制
   
2. 创建 `src/lib/nanobotApi.ts`
   - REST API 客户端封装
   - 会话列表、历史查询

3. 修改 `src/components/LoginScreen.tsx`
   - 简化输入（仅 URL）
   - Token 可选

4. 修改 `src/hooks/useGateway.ts`
   - 替换 GatewayClient
   - 适配 nanobot 事件格式

### Phase 2: 完善功能

5. 处理 tool_hint 事件展示
6. 实现流式响应渲染
7. 会话管理功能
8. 错误处理优化

### Phase 3: 可选功能

9. Token 认证支持
10. Admin API 功能（skills、cron 等）
11. 会话管理面板

## 7. 兼容性考虑

### 7.1 向后兼容

通过环境变量控制是否启用 nanobot 模式:
```bash
VITE_BACKEND_MODE=nanobot  # 默认 openclaw
VITE_NANOBOT_WS_PORT=8787
VITE_NANOBOT_REST_PORT=18790
```

### 7.2 检测机制

启动时检测后端类型:
1. 尝试 nanobot 协议 (直接发送消息)
2. 如果失败，尝试 OpenClaw 协议
3. 或根据环境变量强制模式

## 8. 测试计划

1. **连接测试**
   - 无认证连接
   - Token 认证连接
   - 断开重连

2. **消息测试**
   - 发送消息
   - 接收流式响应
   - 工具调用展示

3. **会话测试**
   - 获取会话列表
   - 切换会话
   - 历史记录加载

## 9. 已知限制

1. nanobot Transport Gateway 暂不支持 `chat.abort` 命令
2. 部分 OpenClaw 特有功能（如设备配对）不可用
3. 需要 nanobot 开启 Transport Gateway (`channels.transport.enabled=true`)

## 10. 参考资料

- nanobot 源码: `/Users/nathan/AIGC/clawbot/nanobot/transport/ws_gateway.py`
- nanobot 协议: `/Users/nathan/AIGC/clawbot/nanobot/transport/contracts.py`
- nanobot REST API: `/Users/nathan/AIGC/clawbot/doc/API.md`
- nanobot 配置: `/Users/nathan/AIGC/clawbot/nanobot/config/schema.py` (TransportConfig)

---

*文档创建日期: 2026-03-19*
