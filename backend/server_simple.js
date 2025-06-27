const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
require('dotenv').config();

// 配置
const PORT = process.env.PORT || 8000;
const WHISPER_URL = process.env.WHISPER_URL || 'http://whisper-service:8000';
const TRANSLATOR_URL = process.env.TRANSLATOR_URL || 'http://translator-service:8000';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// 确保上传目录存在
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 创建 Express 应用
const app = express();
const server = http.createServer(app);

// 配置 Socket.IO
const io = socketIo(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"]
  }
});

// 中间件
app.use(cors({
  origin: CORS_ORIGIN
}));
app.use(express.json());

// 配置 multer 用于文件上传
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 限制
  }
});

// 日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 健康检查
app.get('/health', async (req, res) => {
  try {
    // 检查AI服务状态
    const [whisperHealth, translatorHealth] = await Promise.allSettled([
      axios.get(`${WHISPER_URL}/health`, { timeout: 5000 }),
      axios.get(`${TRANSLATOR_URL}/health`, { timeout: 5000 })
    ]);

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        whisper: {
          url: WHISPER_URL,
          status: whisperHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          error: whisperHealth.status === 'rejected' ? whisperHealth.reason.message : null
        },
        translator: {
          url: TRANSLATOR_URL,
          status: translatorHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          error: translatorHealth.status === 'rejected' ? translatorHealth.reason.message : null
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 语音转文字接口
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const { language } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log(`Transcribing audio: ${req.file.filename}, language: ${language}`);

    // 创建 FormData 发送给 Whisper 服务
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    
    if (language) {
      formData.append('language', language);
    }

    // 调用 Whisper 服务
    const whisperResponse = await axios.post(
      `${WHISPER_URL}/transcribe_realtime`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000
      }
    );

    // 清理临时文件
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      result: whisperResponse.data
    });

  } catch (error) {
    console.error('Transcription error:', error.message);
    
    // 清理临时文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 翻译接口
app.post('/translate', async (req, res) => {
  try {
    const { text, source_lang, target_lang } = req.body;

    if (!text || !source_lang || !target_lang) {
      return res.status(400).json({
        error: 'Missing required fields: text, source_lang, target_lang'
      });
    }

    console.log(`Translating: "${text}" (${source_lang} -> ${target_lang})`);

    // 调用翻译服务
    const translationResponse = await axios.post(
      `${TRANSLATOR_URL}/translate`,
      {
        text,
        source_lang,
        target_lang
      },
      {
        timeout: 15000
      }
    );

    res.json({
      success: true,
      result: translationResponse.data
    });

  } catch (error) {
    console.error('Translation error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取支持的语言
app.get('/languages', async (req, res) => {
  try {
    const response = await axios.get(`${TRANSLATOR_URL}/supported_languages`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching languages:', error.message);
    res.status(500).json({
      error: 'Failed to fetch supported languages'
    });
  }
});

// WebSocket 连接处理
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // 音频转录请求 (WebSocket)
  socket.on('audio_transcribe', async (data) => {
    try {
      const { audioData, language, sessionId, targetLanguage } = data;
      
      // 发送处理状态
      socket.emit('processing_status', {
        sessionId,
        status: 'processing',
        step: 'transcribing'
      });

      // 将 ArrayBuffer 转换为 Buffer
      const audioBuffer = Buffer.from(audioData);
      
      // 创建临时文件
      const tempFilePath = `uploads/temp_${sessionId}_${Date.now()}.webm`;
      fs.writeFileSync(tempFilePath, audioBuffer);

      // 创建 FormData 发送给 Whisper 服务
      const formData = new FormData();
      formData.append('audio', fs.createReadStream(tempFilePath), {
        filename: `audio_${sessionId}.webm`,
        contentType: 'audio/webm'
      });
      
      if (language) {
        formData.append('language', language);
      }

      // 调用 Whisper 服务
      const whisperResponse = await axios.post(
        `${WHISPER_URL}/transcribe_realtime`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 30000
        }
      );

      // 清理临时文件
      fs.unlinkSync(tempFilePath);

      // 发送转录结果
      socket.emit('transcription_result', {
        sessionId,
        success: true,
        text: whisperResponse.data.text,
        language: whisperResponse.data.language,
        confidence: whisperResponse.data.confidence || 0.8,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('WebSocket transcription error:', error.message);
      
      // 清理临时文件
      try {
        const files = fs.readdirSync('uploads/').filter(file => 
          file.startsWith(`temp_${data.sessionId}_`)
        );
        files.forEach(file => fs.unlinkSync(`uploads/${file}`));
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError.message);
      }

      socket.emit('transcription_result', {
        sessionId: data.sessionId,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // 实时翻译请求
  socket.on('translate_request', async (data) => {
    try {
      const { text, source_lang, target_lang, sessionId } = data;
      
      // 调用翻译服务
      const translationResponse = await axios.post(
        `${TRANSLATOR_URL}/translate`,
        {
          text,
          source_lang,
          target_lang
        },
        {
          timeout: 10000
        }
      );

      // 发送翻译结果
      socket.emit('translation_result', {
        sessionId,
        originalText: text,
        translatedText: translationResponse.data.translated_text,
        sourceLang: source_lang,
        targetLang: target_lang,
        confidence: translationResponse.data.confidence,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Real-time translation error:', error.message);
      socket.emit('error', {
        message: error.message,
        type: 'translation'
      });
    }
  });

  // 语言检测请求
  socket.on('detect_language', async (data) => {
    try {
      const { text } = data;
      
      // 简单的语言检测逻辑
      let detectedLang = 'en'; // 默认
      
      if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
        detectedLang = /[\u3040-\u309F\u30A0-\u30FF]/.test(text) ? 'ja' : 'zh';
      }
      
      socket.emit('language_detected', {
        text,
        language: detectedLang,
        confidence: 0.8
      });

    } catch (error) {
      console.error('Language detection error:', error.message);
      socket.emit('error', {
        message: error.message,
        type: 'language_detection'
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`🚀 Translation backend server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`🎤 Whisper service: ${WHISPER_URL}`);
  console.log(`🔤 Translation service: ${TRANSLATOR_URL}`);
  console.log(`🌐 CORS origin: ${CORS_ORIGIN}`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
