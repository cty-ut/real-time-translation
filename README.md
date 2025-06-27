# Translator 项目

本项目是一个多端语音翻译系统，包含前端、后端、语音识别和翻译服务，支持音频上传、实时字幕、英中互译等功能。

## 目录结构

- `frontend/` 前端 React 应用，负责用户界面和音频采集
- `backend/` Node.js 服务，处理 API、WebSocket、音频转发等
- `services/translator/` 机器翻译服务（Python，基于 HuggingFace 模型）
- `services/whisper/` 语音识别服务（Python，基于 OpenAI Whisper）

## 快速开始

### 1. 克隆仓库
```bash
git clone <your-repo-url>
cd translator
```

### 2. 安装依赖

#### 前端
```bash
cd frontend
npm install
```

#### 后端
```bash
cd ../backend
npm install
```

#### 服务端（Python 依赖）
```bash
cd ../services/translator
pip install -r requirements.txt
cd ../whisper
pip install -r requirements.txt
```

### 3. 启动服务

建议使用 `docker-compose` 一键启动：
```bash
docker-compose up --build
```

或分别手动启动各模块，详见各目录下 `README.md`。

## 功能简介
- 语音实时识别与翻译（英中互译）
- 支持音频文件上传与流式处理
- 实时字幕显示
- 前后端分离，支持本地和容器化部署

## 贡献
欢迎提交 issue 和 PR！如需贡献代码，请先阅读 `CONTRIBUTING.md`（如有）。

## License
MIT
