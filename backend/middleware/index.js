const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// 确保必要目录存在
const ensureDirectories = () => {
  const dirs = ['uploads', 'logs'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
};

// CORS 配置
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // 只允许音频文件
  if (file.mimetype.startsWith('audio/') || 
      file.mimetype === 'application/octet-stream' ||
      file.originalname.match(/\.(webm|wav|mp3|m4a|ogg)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传音频文件'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: fileFilter
});

// 请求日志中间件
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };
    
    if (res.statusCode >= 400) {
      logger.error(`Request failed: ${JSON.stringify(logData)}`);
    } else {
      logger.info(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
    }
  });
  
  next();
};

// 错误处理中间件
const errorHandler = (error, req, res, next) => {
  logger.error(`Error in ${req.method} ${req.url}:`, error);
  
  // Multer 错误
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: '文件大小超过限制',
        message: '文件大小不能超过 10MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: '文件数量超过限制',
        message: '一次只能上传一个文件'
      });
    }
  }
  
  // 自定义错误
  if (error.message === '只允许上传音频文件') {
    return res.status(400).json({
      error: '文件类型错误',
      message: error.message
    });
  }
  
  // 默认错误
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误'
  });
};

// 404 处理
const notFound = (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `接口 ${req.method} ${req.url} 不存在`
  });
};

module.exports = {
  ensureDirectories,
  cors: cors(corsOptions),
  upload,
  requestLogger,
  errorHandler,
  notFound
};
