# 翻译系统后端服务

实时语音翻译系统的后端协调服务，负责前端与AI服务之间的通信协调。

## 功能特性

- 🎤 语音转文字转发
- 🌍 文本翻译转发  
- 🔌 WebSocket 实时通信
- 📁 文件上传处理
- 🏥 健康检查监控
- 📊 连接状态统计
- 🛡️ 错误处理和重试
- 📝 完整日志记录

## 目录结构

```
backend/
├── middleware/          # 中间件
│   └── index.js        # 通用中间件集合
├── routes/             # 路由模块
│   ├── health.js       # 健康检查路由
│   └── audio.js        # 音频处理路由
├── utils/              # 工具函数
│   ├── logger.js       # 日志工具
│   └── request.js      # HTTP请求工具
├── websocket/          # WebSocket处理
│   └── handlers.js     # Socket事件处理器
├── uploads/            # 临时文件目录
├── logs/              # 日志文件目录
├── server.js          # 主服务文件
├── package.json       # 项目配置
└── .env.example       # 环境变量示例
```

## 环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
# 服务端口
PORT=8000

# AI 服务地址
WHISPER_URL=http://whisper-service:8000
TRANSLATOR_URL=http://translator-service:8000

# CORS 配置
CORS_ORIGIN=http://localhost:3000

# 其他配置...
```

## 开发运行

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产模式
npm start
```

## API 接口

### 健康检查
- `GET /health` - 服务健康状态
- `GET /api/health` - 详细健康检查
- `GET /api/info` - 系统信息
- `GET /api/stats` - 连接统计

### 音频处理
- `POST /transcribe` - 语音转文字
- `POST /translate` - 文本翻译
- `GET /languages` - 支持的语言

## WebSocket 事件

### 客户端发送
- `audio_transcribe` - 音频转录请求
- `translate_request` - 翻译请求
- `detect_language` - 语言检测
- `ping` - 心跳检测

### 服务端发送
- `transcription_result` - 转录结果
- `translation_result` - 翻译结果
- `processing_status` - 处理状态
- `language_detected` - 检测到的语言
- `pong` - 心跳响应

## 日志

日志文件存储在 `logs/` 目录：
- `combined.log` - 所有日志
- `error.log` - 错误日志

## Docker 部署

使用项目根目录的 `docker-compose.yml` 进行容器化部署。
