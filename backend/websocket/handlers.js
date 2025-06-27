const fs = require('fs');
const logger = require('../utils/logger');
const { saveAudioToFile, transcribeAudio, translateText } = require('../utils/audioProcessor');

// 活跃连接管理
const activeConnections = new Map();

/**
 * 处理 WebSocket 连接
 */
function handleConnection(socket) {
  const connectionInfo = {
    id: socket.id,
    connectedAt: new Date(),
    lastActivity: new Date()
  };
  
  activeConnections.set(socket.id, connectionInfo);
  logger.info(`🔌 Client connected: ${socket.id} (Total: ${activeConnections.size})`);

  // 发送连接确认
  socket.emit('connection_confirmed', {
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });

  // 音频转录请求处理
  socket.on('audio_transcribe', async (data) => {
    try {
      await handleAudioTranscribe(socket, data);
    } catch (error) {
      logger.error(`Audio transcribe error for ${socket.id}:`, error);
      socket.emit('transcription_result', {
        sessionId: data.sessionId,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // 实时翻译请求处理
  socket.on('translate_request', async (data) => {
    try {
      await handleTranslateRequest(socket, data);
    } catch (error) {
      logger.error(`Translation error for ${socket.id}:`, error);
      socket.emit('translation_result', {
        sessionId: data.sessionId,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // 语言检测请求
  socket.on('detect_language', async (data) => {
    try {
      const detectedLang = detectLanguage(data.text);
      socket.emit('language_detected', {
        text: data.text,
        language: detectedLang.language,
        confidence: detectedLang.confidence,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Language detection error for ${socket.id}:`, error);
      socket.emit('error', {
        message: error.message,
        type: 'language_detection'
      });
    }
  });

  // 心跳检测
  socket.on('ping', () => {
    connectionInfo.lastActivity = new Date();
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });

  // 连接断开处理
  socket.on('disconnect', (reason) => {
    activeConnections.delete(socket.id);
    logger.info(`Client disconnected: ${socket.id}, reason: ${reason} (Remaining: ${activeConnections.size})`);
  });

  // 错误处理
  socket.on('error', (error) => {
    logger.error(`Socket error for ${socket.id}:`, error);
  });

  // 监听 'audio_chunk' 事件
  socket.on('audio_chunk', async (data) => {
    try {
      // 从 data 对象中解构出所需字段
      const { audio, language, target_lang, sessionId, mimeType } = data;

      // 确认 audio 是一个 Buffer
      if (!Buffer.isBuffer(audio)) {
        throw new Error('收到的音频数据不是有效的 Buffer');
      }

      // 1. 将音频数据保存到临时文件
      const tempFilePath = await saveAudioToFile(audio, mimeType);

      // 2. 调用 Whisper 服务进行转录
      const transcriptionResult = await transcribeAudio(tempFilePath, language);
      logger.info(`[${socket.id}] Whisper 转录完成: ${transcriptionResult.text}`);

      // 3. 将转录结果发回客户端
      socket.emit('transcription_result', {
        success: true,
        text: transcriptionResult.text,
        language: transcriptionResult.language,
        sessionId: sessionId, // 使用客户端的 sessionId
        timestamp: new Date().toISOString(),
      });

      // 4. 如果需要翻译，则调用翻译服务
      if (target_lang && target_lang !== transcriptionResult.language) {
        const translationResult = await translateText(
          transcriptionResult.text,
          transcriptionResult.language,
          target_lang
        );
        logger.info(`[${socket.id}] 翻译完成: ${translationResult.translated_text}`);

        // 5. 将翻译结果发回客户端
        socket.emit('translation_result', {
          success: true,
          translatedText: translationResult.translated_text,
          sessionId: sessionId, // 确保 sessionId 一致
          timestamp: new Date().toISOString(),
        });
      }

      // 6. 清理临时文件
      await fs.promises.unlink(tempFilePath);

    } catch (error) {
      logger.error(`[${socket.id}] 处理音频块时出错: ${error.message}`);
      socket.emit('error', { 
        message: '处理音频失败', 
        details: error.message,
        sessionId: data.sessionId // 即使失败也返回 sessionId
      });
    }
  });
}

/**
 * 处理音频转录
 */
async function handleAudioTranscribe(socket, data) {
  const { audioData, language, sessionId, targetLanguage, audioFormat } = data;
  const logPrefix = `[audio_transcribe][${sessionId}]`;

  if (!audioData || !sessionId) {
    logger.warn(`${logPrefix} Missing required fields: audioData or sessionId`);
    throw new Error('Missing required fields: audioData, sessionId');
  }

  logger.info(`${logPrefix} Received audio. Size: ${audioData.byteLength}, Format: ${audioFormat}`);
  
  // 将 ArrayBuffer 转换为 Buffer
  const audioBuffer = Buffer.from(audioData);
  let tempFilePath;

  try {
    tempFilePath = await saveAudioToFile(audioBuffer, audioFormat || 'audio/webm');
    const transcriptionResult = await transcribeAudio(tempFilePath, language);
    logger.info(`${logPrefix} Received transcription: "${transcriptionResult.text}"`);

    // 发送转录结果
    socket.emit('transcription_result', {
      sessionId,
      success: true,
      text: transcriptionResult.text,
      language: transcriptionResult.language,
      timestamp: new Date().toISOString()
    });
    logger.info(`${logPrefix} Sent transcription back to client.`);

    // 自动翻译（如果需要）
    if (targetLanguage && targetLanguage !== 'none' && transcriptionResult.text) {
        const translationResult = await translateText(
            transcriptionResult.text,
            transcriptionResult.language || language || 'auto',
            targetLanguage
        );
        logger.info(`${logPrefix} Translation completed: "${translationResult.translated_text}"`);
        socket.emit('translation_result', {
            success: true,
            sessionId: sessionId,
            translatedText: translationResult.translated_text,
            timestamp: new Date().toISOString(),
        });
    }

  } catch (error) {
    logger.error(`${logPrefix} ERROR during transcription process:`, error.message);
    socket.emit('transcription_result', {
      sessionId,
      success: false,
      error: `Transcription failed: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (tempFilePath) {
        try {
            await fs.promises.unlink(tempFilePath);
            logger.info(`${logPrefix} Cleaned up temp file: ${tempFilePath}`);
        } catch (cleanupError) {
            logger.warn(`${logPrefix} Failed to cleanup temp file: ${cleanupError.message}`);
        }
    }
  }
}

/**
 * 处理翻译请求
 */
async function handleTranslateRequest(socket, data) {
  const { text, source_lang, target_lang, sessionId } = data;
  
  if (!text || !source_lang || !target_lang || !sessionId) {
    throw new Error('Missing required fields: text, source_lang, target_lang, sessionId');
  }

  logger.info(`Processing translation for session ${sessionId}: "${text}" (${source_lang} -> ${target_lang})`);
  
  try {
    const translationResult = await translateText(text, source_lang, target_lang);
    // 将翻译结果发回客户端
    socket.emit('translation_result', {
        success: true,
        sessionId: data.sessionId, // 使用从客户端传来的 sessionId
        translatedText: translationResult.translated_text,
        timestamp: new Date().toISOString(),
    });

    logger.info(`Translation completed for session ${sessionId}: "${translationResult.translated_text}"`);
  } catch (error) {
    logger.error(`Translation error for session ${sessionId}:`, error);
    socket.emit('translation_result', {
        sessionId: data.sessionId,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
    });
  }
}

/**
 * 简单的语言检测
 */
function detectLanguage(text) {
  // 基于字符特征的简单检测
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF]/;
  const chinesePattern = /[\u4E00-\u9FAF]/;
  const koreanPattern = /[\uAC00-\uD7AF]/;
  
  if (japanesePattern.test(text)) {
    return { language: 'ja', confidence: 0.8 };
  } else if (chinesePattern.test(text)) {
    return { language: 'zh', confidence: 0.8 };
  } else if (koreanPattern.test(text)) {
    return { language: 'ko', confidence: 0.8 };
  } else {
    return { language: 'en', confidence: 0.6 };
  }
}

/**
 * 获取连接统计信息
 */
function getConnectionStats() {
  return {
    total: activeConnections.size,
    connections: Array.from(activeConnections.values()).map(conn => ({
      id: conn.id,
      connectedAt: conn.connectedAt,
      lastActivity: conn.lastActivity,
      duration: Date.now() - conn.connectedAt.getTime()
    }))
  };
}

module.exports = {
  handleConnection,
  getConnectionStats
};
