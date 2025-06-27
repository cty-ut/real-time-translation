const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { cors, requestLogger, errorHandler, notFound, ensureDirectories } = require('./middleware');
const { handleConnection, getConnectionStats } = require('./websocket/handlers');
const healthRouter = require('./routes/health');
const audioRouter = require('./routes/audio');
const logger = require('./utils/logger');

// 初始化目录
ensureDirectories();

// 配置
const PORT = process.env.PORT || 8000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// 创建 Express 应用
const app = express();
const server = http.createServer(app);

// 配置 Socket.IO
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"]
  }
});

// 中间件
app.use(cors);
app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api', healthRouter);
app.use('/api/audio', audioRouter);

// WebSocket 连接处理
io.on('connection', handleConnection);

// 管理端点，用于查看 WebSocket 连接状态
app.get('/ws-stats', (req, res) => {
  res.json(getConnectionStats());
});

// 404 和错误处理
app.use(notFound);
app.use(errorHandler);

// 启动服务器
server.listen(PORT, () => {
  logger.info(`🚀 Translation backend server running on port ${PORT}`);
  logger.info(`📡 WebSocket server ready for connections`);
  logger.info(`🌐 CORS origin: ${CORS_ORIGIN}`);
  logger.info(`Whisper service URL: ${process.env.WHISPER_URL || 'http://localhost:8001'}`);
  logger.info(`Translator service URL: ${process.env.TRANSLATOR_URL || 'http://localhost:8002'}`);
});

// 优雅关闭
process.on('SIGINT', () => {
  logger.info('\n🛑 Shutting down server...');
  io.close(() => {
    server.close(() => {
      logger.info('✅ Server closed');
      process.exit(0);
    });
  });
});
