
import whisper
import os
import logging
import torch

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_direct_test():
    """
    直接在容器内测试 Whisper 模型的加载和转录功能，
    绕过所有 FastAPI 和 FFmpeg 转换代码。
    """
    model_size = "small"
    # M2 芯片在容器内无法使用 mps，强制使用 cpu
    device = "cpu"
    # 由于 services/whisper 被挂载到 /app，所以 test.mp3 应该在 services/whisper 目录下
    # 但是 test.mp3 在项目根目录，所以我们需要找到它
    # 卷挂载的路径是 ./services/whisper:/app
    # 我们需要访问项目根目录的 test.mp3
    # 在容器内，项目根目录没有被直接挂载，但我们可以通过../来访问
    # 但是，更好的方法是把 test.mp3 也放在 services/whisper 目录中
    # 为了简单起见，我们假设 test.mp3 已经被复制到了 services/whisper 目录下
    audio_path = "/app/test.mp3"

    # --- 1. 检查测试文件是否存在 ---
    if not os.path.exists(audio_path):
        logger.error(f"测试文件未找到: {audio_path}")
        logger.error("请确保 `test.mp3` 文件位于 `services/whisper/` 目录下。")
        return

    logger.info(f"找到了测试文件: {audio_path}")

    # --- 2. 加载模型 ---
    model = None
    try:
        logger.info(f"正在加载 Whisper 模型: {model_size} on {device}")
        # 使用与主应用相同的模型缓存路径
        model = whisper.load_model(model_size, device=device, download_root="/app/models")
        logger.info("✅ Whisper 模型加载成功。")
    except Exception as e:
        logger.error(f"❌ 加载 Whisper 模型失败: {e}", exc_info=True)
        return

    # --- 3. 执行转录 ---
    try:
        logger.info(f"正在使用模型直接转录文件: {audio_path}...")
        # 设置 verbose=True 可以看到详细的转录过程
        result = model.transcribe(audio_path, verbose=True)
        
        logger.info("✅ 转录任务完成。")
        logger.info("="*20 + " 转录结果 " + "="*20)
        logger.info(f"识别出的语言: {result.get('language')}")
        logger.info(f"转录的文本: {result.get('text')}")
        logger.info("="*50)
        logger.info("🎉 模型直接测试成功！")

    except Exception as e:
        logger.error(f"❌ 转录过程中发生错误: {e}", exc_info=True)

if __name__ == "__main__":
    run_direct_test()
