const axios = require('axios');
const logger = require('./logger');

/**
 * 带重试的 HTTP 请求
 */
async function retryRequest(url, options = {}, maxRetries = 3) {
  const retryDelay = parseInt(process.env.RETRY_DELAY) || 1000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Attempting request to ${url} (attempt ${attempt}/${maxRetries})`);
      const response = await axios(url, options);
      return response;
    } catch (error) {
      logger.warn(`Request attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === maxRetries) {
        logger.error(`All ${maxRetries} attempts failed for ${url}`);
        throw error;
      }
      
      // 指数退避
      const delay = retryDelay * Math.pow(2, attempt - 1);
      logger.info(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * 检查服务健康状态
 */
async function checkServiceHealth(serviceName, url) {
  try {
    const response = await retryRequest(`${url}/health`, {
      method: 'GET',
      timeout: 5000
    }, 1);
    
    return {
      name: serviceName,
      status: 'healthy',
      url: url,
      response: response.data
    };
  } catch (error) {
    return {
      name: serviceName,
      status: 'unhealthy',
      url: url,
      error: error.message
    };
  }
}

module.exports = {
  retryRequest,
  checkServiceHealth
};
