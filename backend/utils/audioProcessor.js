const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const { retryRequest } = require('./request');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
const WHISPER_URL = process.env.WHISPER_URL || 'http://localhost:8001';
const TRANSLATOR_URL = process.env.TRANSLATOR_URL || 'http://localhost:8002';

/**
 * 将音频 Buffer 保存到临时文件
 * @param {Buffer} audioBuffer - 音频数据
 * @param {string} mimeType - 音频的 MIME 类型
 * @returns {Promise<string>} 临时文件的绝对路径
 */
const saveAudioToFile = async (audioBuffer, mimeType) => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  // 从 MIME 类型推断文件扩展名
  const extension = mimeType.split('/')[1].split(';')[0] || 'webm';
  const tempFileName = `${uuidv4()}.${extension}`;
  const tempFilePath = path.join(UPLOADS_DIR, tempFileName);

  await fs.promises.writeFile(tempFilePath, audioBuffer);
  logger.info(`音频文件已保存: ${tempFilePath}`);
  return tempFilePath;
};

/**
 * 调用 Whisper 服务进行语音转录
 * @param {string} filePath - 音频文件的路径
 * @param {string} language - 音频语言
 * @returns {Promise<object>} 转录结果
 */
const transcribeAudio = async (filePath, language) => {
  const form = new FormData();
  form.append('audio', fs.createReadStream(filePath));
  form.append('language', language);

  logger.info(`正在调用 Whisper 服务进行转录: ${filePath}`);
  const response = await retryRequest(`${WHISPER_URL}/transcribe`, {
    method: 'POST',
    data: form,
    headers: form.getHeaders(),
    timeout: 90000, // 90秒超时
  });

  if (!response.data.success) {
    throw new Error(`Whisper 服务错误: ${response.data.error}`);
  }
  return response.data.result;
};

/**
 * 调用翻译服务进行文本翻译
 * @param {string} text - 要翻译的文本
 * @param {string} source_lang - 源语言
 * @param {string} target_lang - 目标语言
 * @returns {Promise<object>} 翻译结果
 */
const translateText = async (text, source_lang, target_lang) => {
  logger.info(`正在调用翻译服务: [${source_lang} -> ${target_lang}] \"${text}\"`);
  const response = await retryRequest(`${TRANSLATOR_URL}/translate`, {
    method: 'POST',
    data: {
      text,
      source_lang,
      target_lang,
    },
    timeout: 30000, // 30秒超时
  });

  if (!response.data.success) {
    throw new Error(`翻译服务错误: ${response.data.error}`);
  }
  return response.data.result;
};

module.exports = {
  saveAudioToFile,
  transcribeAudio,
  translateText,
};
