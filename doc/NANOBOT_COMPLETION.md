# Nanobot 前端适配 - 完成记录

> 文档日期: 2026-03-19

## 已完成的对接

### 1. WebSocket 连接

| 功能 | 状态 | 说明 |
|------|------|------|
| 基础连接 | ✅ | 直接连接，无握手协议 |
| 自动重连 | ✅ | 指数退避重连 |
| Session Bind | ✅ | 订阅 transport session |
| 事件 ACK | ✅ | 确认收到事件 |
| 跨域代理 | ✅ | Vite 代理 `/ws` 到 nanobot |

### 2. REST API 对接

| 接口 | 状态 | 路径 |
|------|------|------|
| 会话列表 | ✅ | `GET /api/v1/admin/sessions` |
| 会话历史 | ✅ | `GET /api/v1/admin/sessions/{key}/history` |
| 技能列表 | ✅ | `GET /api/v1/admin/skills` |
| 技能状态 | ✅ | `GET/POST /api/v1/admin/skills/state` |
| 配置重载 | ✅ | `POST /api/v1/admin/config/reload` |
| 工具提示重载 | ✅ | `POST /api/v1/admin/tool-hints/reload` |
| 渠道状态 | ✅ | `GET /api/v1/admin/channels` |
| Cron 任务 | ✅ | `GET /api/v1/admin/cron/jobs` |
| 历史查询 | ✅ | `GET /api/v1/admin/history` |

### 3. 消息协议对接

#### 发送消息
```typescript
{
  messageId: string;
  channel: "transport";
  chatId: string;
  senderId: string;
  content: string;
  ts: string;
}
```

#### 事件处理

| nanobot 事件 | 处理 | 状态 |
|--------------|------|------|
| `progress` | 追加流式内容 | ✅ |
| `tool_hint` | 显示工具调用 | ✅ |
| `final` | 完成消息 | ✅ |
| `error` | 显示错误 | ✅ |

### 4. 前端界面适配

| 组件 | 修改内容 |
|------|----------|
| LoginScreen | 简化为 3 个输入: WS URL, REST URL, Token (可选) |
| App | 移除不支持的功能 (会话压缩/重命名等) |
| Header | 适配 nanobot 状态显示 |
| Sidebar | 适配会话列表 |

## 修改的文件清单

```
src/
├── lib/
│   ├── nanobotGateway.ts    # 新增 - WebSocket 客户端
│   ├── nanobotApi.ts        # 新增 - REST API 客户端
│   ├── credentials.ts       # 修改 - 简化存储
│   └── gateway.ts           # 备份 - 旧 OpenClaw 客户端
├── hooks/
│   ├── useGateway.ts        # 重写 - 适配 nanobot
│   └── useSecondarySession.ts # 修改 - 适配 nanobot
├── components/
│   └── LoginScreen.tsx      # 修改 - 简化登录
├── App.tsx                  # 修改 - 移除不支持功能
└── vite.config.ts           # 修改 - 添加代理
```

## Vite 代理配置

```typescript
server: {
  proxy: {
    '/ws': {
      target: 'ws://localhost:8787',
      ws: true,
    },
    '/api': {
      target: 'http://localhost:18790',
    },
  },
}
```

## 使用方式

1. 启动 nanobot (确保 `channels.transport.enabled=true`)
2. 启动前端: `npm run dev`
3. 访问 http://localhost:5173
4. 登录输入:
   - WebSocket URL: `/ws`
   - REST API URL: `/api`
   - Token: 留空 (如果 nanobot 无需认证)

## 待完善功能

- [ ] tool_hint 结果展示 (tool_result)
- [ ] 会话切换和历史加载
- [ ] 消息发送状态 (sending/sent/error)
- [ ] 连接状态 Banner
- [ ] 错误处理和提示

## 参考资料

- nanobot Transport: `/Users/nathan/AIGC/clawbot/nanobot/transport/ws_gateway.py`
- nanobot 协议: `/Users/nathan/AIGC/clawbot/nanobot/transport/contracts.py`
- nanobot API: `/Users/nathan/AIGC/clawbot/doc/API.md`
