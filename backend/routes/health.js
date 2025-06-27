const express = require('express');
const { checkServiceHealth } = require('../utils/request');
const logger = require('../utils/logger');

const router = express.Router();

// 环境变量
const WHISPER_URL = process.env.WHISPER_URL || 'http://localhost:8001';
const TRANSLATOR_URL = process.env.TRANSLATOR_URL || 'http://localhost:8002';

/**
 * 健康检查接口
 */
router.get('/health', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // 检查所有服务状态
    const [whisperHealth, translatorHealth] = await Promise.allSettled([
      checkServiceHealth('whisper', WHISPER_URL),
      checkServiceHealth('translator', TRANSLATOR_URL)
    ]);
    
    const responseTime = Date.now() - startTime;
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      environment: process.env.NODE_ENV || 'development',
      version: require('../package.json').version,
      services: {
        whisper: whisperHealth.status === 'fulfilled' ? whisperHealth.value : {
          name: 'whisper',
          status: 'unhealthy',
          error: whisperHealth.reason?.message || 'Unknown error'
        },
        translator: translatorHealth.status === 'fulfilled' ? translatorHealth.value : {
          name: 'translator', 
          status: 'unhealthy',
          error: translatorHealth.reason?.message || 'Unknown error'
        }
      }
    };
    
    // 如果任何关键服务不健康，返回 503
    const allServicesHealthy = Object.values(healthStatus.services)
      .every(service => service.status === 'healthy');
    
    const statusCode = allServicesHealthy ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 系统信息接口
 */
router.get('/info', (req, res) => {
  const packageInfo = require('../package.json');
  
  res.json({
    name: packageInfo.name,
    version: packageInfo.version,
    description: packageInfo.description,
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    platform: process.platform,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
});

/**
 * 服务配置接口
 */
router.get('/config', (req, res) => {
  res.json({
    services: {
      whisper: {
        url: WHISPER_URL,
        enabled: true
      },
      translator: {
        url: TRANSLATOR_URL,
        enabled: true
      }
    },
    features: {
      realtime_transcription: true,
      translation: true,
      websocket: true,
      file_upload: true
    },
    limits: {
      max_file_size: process.env.MAX_FILE_SIZE || '10MB',
      supported_formats: ['webm', 'wav', 'mp3', 'm4a', 'ogg']
    }
  });
});

module.exports = router;
