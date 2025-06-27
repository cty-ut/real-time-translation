import os
from typing import Dict, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
import logging
from transformers import MarianMTModel, MarianTokenizer
from cachetools import TTLCache
import torch
import asyncio
import functools

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建 FastAPI 应用
app = FastAPI(title="Translation Service")

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 请求模型
class TranslationRequest(BaseModel):
    text: str
    source_lang: str
    target_lang: str

class TranslationResponse(BaseModel):
    translated_text: str
    source_lang: str
    target_lang: str
    confidence: float

# 全局变量
models: Dict[str, Dict] = {}
translation_cache = TTLCache(maxsize=1000, ttl=3600)  # 1小时缓存

def _translate_blocking(model, tokenizer, text, **kwargs):
    """
    在独立的执行器中运行阻塞的翻译函数。
    """
    logger.info("Starting translation in executor...")
    translated_tokens = model.generate(**tokenizer(text, return_tensors="pt", padding=True).to(model.device), **kwargs)
    result = tokenizer.decode(translated_tokens[0], skip_special_tokens=True)
    logger.info("Translation finished in executor.")
    return result

# 支持的翻译方向和对应的模型
SUPPORTED_MODELS = {
    "ja-zh": "Helsinki-NLP/opus-mt-ja-zh",
    "en-zh": "Helsinki-NLP/opus-mt-en-zh", 
    "zh-ja": "Helsinki-NLP/opus-mt-zh-ja",
    "zh-en": "Helsinki-NLP/opus-mt-zh-en"
}

def load_translation_models():
    """加载翻译模型"""
    global models
    
    logger.info("Loading translation models...")
    
    for direction, model_name in SUPPORTED_MODELS.items():
        try:
            logger.info(f"Loading model: {model_name}")
            
            # 加载分词器和模型
            tokenizer = MarianTokenizer.from_pretrained(model_name, cache_dir="/app/models")
            model = MarianMTModel.from_pretrained(model_name, cache_dir="/app/models")
            
            # M2 芯片优化
            if torch.backends.mps.is_available():
                model = model.to("mps")
                logger.info(f"Model {direction} loaded on MPS")
            else:
                model = model.to("cpu")
                logger.info(f"Model {direction} loaded on CPU")
            
            models[direction] = {
                "tokenizer": tokenizer,
                "model": model
            }
            
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            continue
    
    logger.info(f"Successfully loaded {len(models)} translation models")

@app.on_event("startup")
async def startup_event():
    """应用启动时加载模型"""
    load_translation_models()

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "loaded_models": list(models.keys()),
        "cache_size": len(translation_cache),
        "service": "translator"
    }

@app.get("/supported_languages")
async def get_supported_languages():
    """获取支持的语言对"""
    return {
        "supported_directions": list(SUPPORTED_MODELS.keys()),
        "languages": {
            "ja": "Japanese",
            "en": "English", 
            "zh": "Chinese"
        }
    }

def get_model_direction(source_lang: str, target_lang: str) -> str:
    """获取模型方向"""
    direction = f"{source_lang}-{target_lang}"
    if direction in models:
        return direction
    
    # 检查是否有反向模型
    reverse_direction = f"{target_lang}-{source_lang}"
    if reverse_direction in models:
        return reverse_direction
    
    raise ValueError(f"Unsupported translation direction: {source_lang} -> {target_lang}")

@app.post("/translate")
async def translate_text(request: TranslationRequest):
    """
    翻译文本接口
    
    Args:
        request: 包含待翻译文本和语言方向的请求
    
    Returns:
        翻译结果
    """
    try:
        # 检查缓存
        cache_key = f"{request.text}_{request.source_lang}_{request.target_lang}"
        if cache_key in translation_cache:
            logger.info("Cache hit for translation")
            cached_result = translation_cache[cache_key]
            return JSONResponse(content={"success": True, "result": cached_result.dict()})
        
        # 获取对应的模型
        direction = get_model_direction(request.source_lang, request.target_lang)
        
        if direction not in models:
            raise HTTPException(
                status_code=400, 
                detail=f"Translation model not available for {request.source_lang} -> {request.target_lang}"
            )
        
        tokenizer = models[direction]["tokenizer"]
        model = models[direction]["model"]
        
        # 文本预处理
        text = request.text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="Empty text provided")
        
        logger.info(f"Translating: '{text}' ({request.source_lang} -> {request.target_lang})")
        
        # 进行翻译
        loop = asyncio.get_running_loop()
        blocking_task = functools.partial(_translate_blocking, model, tokenizer, text)
        translated_text = await loop.run_in_executor(None, blocking_task)
        
        # 计算置信度 (简化版本)
        confidence = min(1.0, len(translated_text) / max(1, len(text)) * 0.8 + 0.2)
        
        result = TranslationResponse(
            translated_text=translated_text,
            source_lang=request.source_lang,
            target_lang=request.target_lang,
            confidence=confidence
        )
        
        # 缓存结果
        translation_cache[cache_key] = result
        
        logger.info(f"Translation completed: '{translated_text}'")
        return JSONResponse(content={"success": True, "result": result.dict()})
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Translation error: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

@app.post("/translate_batch")
async def translate_batch(texts: List[str], source_lang: str, target_lang: str):
    """
    批量翻译接口
    
    Args:
        texts: 待翻译文本列表
        source_lang: 源语言
        target_lang: 目标语言
    
    Returns:
        翻译结果列表
    """
    try:
        results = []
        
        for text in texts:
            request = TranslationRequest(
                text=text,
                source_lang=source_lang,
                target_lang=target_lang
            )
            result = await translate_text(request)
            results.append(result)
        
        return {"translations": results}
        
    except Exception as e:
        logger.error(f"Batch translation error: {e}")
        raise HTTPException(status_code=500, detail=f"Batch translation failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )
