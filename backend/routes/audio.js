const express = require('express');
const fs = require('fs');
const FormData = require('form-data');
const { retryRequest } = require('../utils/request');
const logger = require('../utils/logger');
const { upload } = require('../middleware');

const router = express.Router();

// 环境变量
const WHISPER_URL = process.env.WHISPER_URL || 'http://localhost:8001';
const TRANSLATOR_URL = process.env.TRANSLATOR_URL || 'http://localhost:8002';

/**
 * 语音转文字接口
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    const { language, realtime } = req.body; // 增加 realtime 参数
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No audio file provided' 
      });
    }

    tempFilePath = req.file.path;
    logger.info(`Processing transcription: ${req.file.originalname}, size: ${req.file.size}, language: ${language}, realtime: ${realtime}`);

    // 创建 FormData 发送给 Whisper 服务
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFilePath), {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    
    if (language && language !== 'auto') {
      formData.append('language', language);
    }

    // 如果是实时请求，则添加 realtime=true
    if (realtime && realtime === 'true') {
      formData.append('realtime', 'true');
    }

    // 调用 Whisper 服务 (修正之前代码中的 URL)
    const whisperResponse = await retryRequest(
      `${WHISPER_URL}/transcribe`,
      {
        method: 'POST',
        data: formData,
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 120000, // 将超时时间从 30 秒增加到 120 秒
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    if (whisperResponse.data && whisperResponse.data.success) {
      const whisperResult = whisperResponse.data.result;
      logger.info(`Transcription successful: "${whisperResult.text}"`);
      res.json({
        success: true,
        result: whisperResult
      });
    } else {
      const errorMessage = whisperResponse.data?.error || 'Transcription failed at whisper service or unexpected response format';
      logger.error('Whisper service returned a failure or malformed response:', whisperResponse.data);
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }

  } catch (error) {
    logger.error('Transcription error:', error);
    
    res.status(500).json({
      success: false,
      error: error.response?.data?.detail || error.message
    });
  } finally {
    // 清理临时文件
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        logger.debug(`Cleaned up temp file: ${tempFilePath}`);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup temp file: ${cleanupError.message}`);
      }
    }
  }
});

/**
 * 翻译接口
 */
router.post('/translate', async (req, res) => {
  try {
    const { text, source_lang, target_lang } = req.body;

    if (!text || !source_lang || !target_lang) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: text, source_lang, target_lang'
      });
    }

    logger.info(`Translating: "${text}" (${source_lang} -> ${target_lang})`);

    // 调用翻译服务
    const translationResponse = await retryRequest(
      `${TRANSLATOR_URL}/translate`,
      {
        method: 'POST',
        data: {
          text,
          source_lang,
          target_lang
        },
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (translationResponse.data && translationResponse.data.success) {
      const translatorResult = translationResponse.data.result;
      logger.info(`Translation successful: "${translatorResult.translated_text}"`);
      res.json({
        success: true,
        result: translatorResult
      });
    } else {
      const errorMessage = translationResponse.data?.error || 'Translation failed at translator service or unexpected response format';
      logger.error('Translator service returned a failure or malformed response:', translationResponse.data);
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  } catch (error) {
    logger.error('Translation error:', error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.detail || error.message
    });
  }
});

/**
 * 获取支持的语言
 */
router.get('/languages', async (req, res) => {
  try {
    const response = await retryRequest(`${TRANSLATOR_URL}/supported_languages`, {
      method: 'GET',
      timeout: 10000
    });
    
    res.json(response.data);
  } catch (error) {
    logger.error('Error fetching languages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supported languages'
    });
  }
});

module.exports = router;
