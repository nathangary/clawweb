# 图片上传交互设计文档

## 一、当前问题

前端发送图片给后端时，后端无法正确接收和处理图片。

## 二、当前交互流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                           前端 (PinchChat)                           │
├─────────────────────────────────────────────────────────────────────┤
│  ChatInput.tsx                                                       │
│  ├── 用户选择图片 → compressImage() 压缩 → base64 数据              │
│  └── onSend(text, attachments)                                      │
│      ↓                                                               │
│  nanobotGateway.ts send()                                           │
│  {                                                                  │
│    messageId: "msg-xxx",                                            │
│    channel: "transport",                                            │
│    chatId: "web-xxx",                                               │
│    senderId: "webchat",                                             │
│    content: "用户文本",                                             │
│    attachments: [{                                                  │
│      type: "image/jpeg",                                            │
│      url: "",                                                        │
│      localPath: "base64数据..."                                     │
│    }],                                                               │
│    ts: "..."                                                         │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓ WebSocket
┌─────────────────────────────────────────────────────────────────────┐
│                      后端 (Nanobot/ClawBot)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ws_gateway.py                                                       │
│  ├── 接收 JSON 消息                                                 │
│  ├── InboundTransportMessage.model_validate(msg)                    │
│  │   └── attachments: [TransportAttachment(...)]                  │
│  │                                                                    │
│  contracts.py to_bus_message()                                      │
│  ├── attachment_media = [a.local_path or a.url for ...]            │
│  └── media = [*self.media, *attachment_media]                     │
│      ↓                                                               │
│  bus.publish_inbound(InboundMessage)                               │
│  └── media: ["base64数据..."]                                       │
│      ↓                                                               │
│  agent/loop.py                                                       │
│  └── context.build_messages(..., media=msg.media)                  │
│      ↓                                                               │
│  context.py _build_user_content()                                   │
│  ├── for path in media:                                            │
│  │   └── p = Path(path); p.is_file() ❌ base64 不是文件！           │
│  └── return text (图片被丢弃)                                        │
└─────────────────────────────────────────────────────────────────────┘
```

## 三、根因分析

**后端 `context.py:_build_user_content()` 期望 media 是文件路径，但前端发送的是 base64 字符串。**

```python
# 当前代码
for path in media:
    p = Path(path)
    if not p.is_file():  # base64 字符串不是文件路径 → 跳过
        continue
    # ...处理文件
```

## 四、解决方案：先存储，后读取

### 方案设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                           前端 (不变)                                │
├─────────────────────────────────────────────────────────────────────┤
│  发送格式保持不变:                                                   │
│  attachments: [{ type, url, localPath: base64数据 }]                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     修改点 1: Transport 接收                         │
├─────────────────────────────────────────────────────────────────────┤
│  contracts.py:InboundTransportMessage.to_bus_message()             │
│                                                                    │
│  修改前:                                                            │
│    attachment_media = [a.local_path or a.url for a in ...]         │
│                                                                    │
│  修改后:                                                            │
│    将 base64 数据保存到临时文件，返回文件路径列表                    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     修改点 2: Context 构建                           │
├─────────────────────────────────────────────────────────────────────┤
│  context.py: _build_user_content()                                  │
│                                                                    │
│  修改前:                                                            │
│    p.is_file() → 只支持文件路径                                     │
│                                                                    │
│  修改后:                                                            │
│    检测是文件路径还是 base64 数据                                   │
│    - 文件路径: 直接读取 (现有逻辑)                                  │
│    - base64 数据: 已有逻辑能处理                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 具体实现

#### 修改点 1: `nanobot/transport/contracts.py`

```python
import tempfile
import os

class InboundTransportMessage:
    def to_bus_message(self) -> InboundMessage:
        attachment_media = []
        
        for a in self.attachments:
            path_or_data = a.local_path or a.url
            if not path_or_data:
                continue
            
            # 如果是 base64 数据，保存为临时文件
            if self._is_base64(path_or_data):
                file_path = self._save_base64_to_file(path_or_data, a.type)
                if file_path:
                    attachment_media.append(file_path)
            else:
                # 已经是文件路径或 URL
                attachment_media.append(path_or_data)
        
        return InboundMessage(
            ...
            media=[*self.media, *attachment_media],
            ...
        )
    
    def _is_base64(self, s: str) -> bool:
        """判断字符串是否为 base64 数据"""
        if len(s) < 100:
            return False
        # 检查 base64 字符集
        return all(c in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=" for c in s[:100])
    
    def _save_base64_to_file(self, b64_data: str, mime_type: str) -> str | None:
        """将 base64 数据保存到临时文件，返回文件路径"""
        try:
            # 确定文件扩展名
            ext = self._mime_to_ext(mime_type)
            # 创建临时文件
            fd, path = tempfile.mkstemp(suffix=ext, dir=tempfile.gettempdir())
            os.write(fd, base64.b64decode(b64_data))
            os.close(fd)
            return path
        except Exception:
            return None
    
    def _mime_to_ext(self, mime_type: str) -> str:
        """MIME 类型转文件扩展名"""
        mapping = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/gif": ".gif",
            "image/webp": ".webp",
        }
        return mapping.get(mime_type, ".tmp")
```

#### 修改点 2: `nanobot/agent/context.py`

保持当前修改（已支持文件路径、data URL、raw base64 三种形式）。

### 优势

1. **最小改动**: 只修改 contracts.py，不影响其他 channel
2. **统一接口**: 转换为文件路径后，现有逻辑无需修改
3. **可清理**: 临时文件可在处理完成后删除

### 可选优化

在 `agent/loop.py` 处理完消息后，清理临时图片文件：
- 在 `InboundMessage.metadata` 中记录临时文件路径
- 处理完成后删除