
import logging
from transformers import MarianMTModel, MarianTokenizer
import torch

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_direct_test():
    """
    直接在容器内测试翻译模型的加载和翻译功能。
    """
    model_name = "Helsinki-NLP/opus-mt-en-zh"
    device = "cpu"  # 容器内通常没有 GPU，强制使用 CPU
    
    # --- 1. 加载模型和分词器 ---
    try:
        logger.info(f"正在加载翻译模型: {model_name} on {device}")
        # 使用与主应用相同的模型缓存路径
        tokenizer = MarianTokenizer.from_pretrained(model_name, cache_dir="/app/models")
        model = MarianMTModel.from_pretrained(model_name, cache_dir="/app/models")
        model.to(device)
        logger.info("✅ 翻译模型和分词器加载成功。")
    except Exception as e:
        logger.error(f"❌ 加载模型失败: {e}", exc_info=True)
        return

    # --- 2. 执行翻译 ---
    try:
        text_to_translate = "Hello, world!"
        logger.info(f"正在翻译文本: '{text_to_translate}'")
        
        # 准备输入
        inputs = tokenizer(text_to_translate, return_tensors="pt", padding=True).to(device)
        
        # 生成翻译结果
        translated_tokens = model.generate(**inputs)
        
        # 解码结果
        translated_text = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)[0]
        
        logger.info("✅ 翻译任务完成。")
        logger.info("="*20 + " 翻译结果 " + "="*20)
        logger.info(f"原文 (en): {text_to_translate}")
        logger.info(f"译文 (zh): {translated_text}")
        logger.info("="*50)
        logger.info("🎉 模型直接测试成功！")

    except Exception as e:
        logger.error(f"❌ 翻译过程中发生错误: {e}", exc_info=True)

if __name__ == "__main__":
    run_direct_test()
