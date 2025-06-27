import os
import whisper
import tempfile
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
import subprocess
from contextlib import asynccontextmanager
import asyncio
import functools

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 全局变量
model = None

def _transcribe_blocking(model, audio, **options):
    """
    在独立的执行器中运行阻塞的 whisper.transcribe 函数。
    """
    logger.info(f"Starting transcription in executor with options: {options}")
    result = whisper.transcribe(model, audio, **options)
    logger.info("Transcription call finished in executor.")
    return result

def load_whisper_model():
    """加载 Whisper 模型"""
    global model
    model_size = os.getenv("MODEL_SIZE", "small")
    device = os.getenv("DEVICE", "cpu")
    
    logger.info(f"Loading Whisper model: {model_size} on {device}")
    
    try:
        model = whisper.load_model(model_size, device=device, download_root="/app/models")
        logger.info("Whisper model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load Whisper model: {e}")
        raise

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the model
    load_whisper_model()
    yield
    # Clean up the model
    global model
    model = None

# 创建 FastAPI 应用
app = FastAPI(title="Whisper Speech Recognition Service", lifespan=lifespan)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "service": "whisper"
    }

def convert_audio_to_wav(input_data, is_webm):
    """使用 ffmpeg 将内存中的音频数据转换为 wav 格式"""
    try:
        input_format = None
        # 检查是否是实时录音的 webm 格式
        if is_webm:
            logger.info("Forcing input format to webm for real-time audio stream.")
            input_format = 'webm'
        # 保留之前的 header 检测逻辑作为备用
        elif input_data.startswith(b'\x1a\x45\xdf\xa3'):
            logger.info("Detected WebM audio format based on header.")
            input_format = 'webm'

        # 使用管道将输入数据传递给 ffmpeg
        cmd = [
            'ffmpeg',
            '-y',
        ]

        if input_format:
            cmd.extend(['-f', input_format])

        cmd.extend([
            '-i', 'pipe:0',  # 从标准输入读取
            '-ar', '16000', # 采样率
            '-ac', '1', # 单声道
            '-f', 'wav',
            'pipe:1' # 输出到标准输出
        ])

        logger.info(f"Executing FFmpeg command: {' '.join(cmd)}")

        # 运行 ffmpeg 进程
        process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        wav_data, stderr = process.communicate(input=input_data)

        if process.returncode != 0:
            logger.error(f"FFmpeg conversion failed. Return code: {process.returncode}")
            logger.error(f"FFmpeg stderr: {stderr.decode()}")
            return None

        logger.info(f"FFmpeg conversion successful, WAV data size: {len(wav_data)}")
        return wav_data

    except Exception as e:
        logger.error(f"Audio conversion error: {e}")
        return None

def validate_audio_data(data):
    """验证音频数据的基本完整性"""
    if len(data) < 100:
        return False
    
    # 检查常见音频文件头
    if (data.startswith(b'\x1a\x45\xdf\xa3') or  # WebM/Matroska
        (data.startswith(b'RIFF') and b'WAVE' in data[:12]) or  # WAV
        data.startswith(b'OggS')):  # OGG
        return True
    
    logger.warning("Audio data validation failed, but proceeding anyway")
    return False

async def transcribe_audio_data(data: bytes, language: str):
    """转录音频数据"""
    global model
    if model is None:
        raise HTTPException(status_code=503, detail="Whisper model is not loaded yet.")

    if len(data) < 100:
        logger.error("Audio data is too small to be valid.")
        raise HTTPException(status_code=400, detail="Audio data is too small to be valid.")

    # 创建临时文件来存储音频数据
    temp_file_path = None
    try:
        # 强制将音频转换为WAV格式
        wav_data = convert_audio_to_wav(data, False)
        if not wav_data:
            raise HTTPException(status_code=400, detail="Audio conversion failed.")

        # 创建临时文件保存转换后的音频数据
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file.write(wav_data)
            temp_file_path = temp_file.name

        logger.info(f"Created temp file: {temp_file_path}")

        # 从临时文件加载音频
        logger.info("Loading audio from temp file...")
        audio_np = whisper.load_audio(temp_file_path)
        logger.info(f"Audio loaded successfully, shape: {audio_np.shape}")

        # 执行转录
        logger.info("Starting transcription...")
        
        # 添加超时处理和更简单的参数
        transcribe_options = {
            "language": language if language != 'auto' else None,
            "fp16": False,
            "verbose": True,
            "no_speech_threshold": 0.6,
            "logprob_threshold": -1.0,
            "compression_ratio_threshold": 2.4,
            "condition_on_previous_text": False
        }
        
        logger.info(f"Starting transcription with options: {transcribe_options}")
        
        loop = asyncio.get_running_loop()
        blocking_task = functools.partial(_transcribe_blocking, model, audio_np, **transcribe_options)
        result = await loop.run_in_executor(None, blocking_task)

        logger.info("Transcription call finished.")
        logger.info(f"Transcription completed successfully. Text: \'{result['text'][:100]}...\'")
        return {"text": result["text"], "language": result.get("language", "unknown")}

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
    finally:
        # 清理临时文件
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.debug(f"Cleaned up temp file: {temp_file_path}")
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup temp file: {cleanup_error}")

@app.post("/transcribe_realtime")
async def transcribe_realtime(file: UploadFile = File(...), language: str = Form("auto")):
    """实时转录音频文件"""
    try:
        audio_data = await file.read()
        logger.info(f"Received real-time audio chunk. Size: {len(audio_data)}, Language: {language}")
        
        transcription_result = await transcribe_audio_data(audio_data, language)
        return transcription_result

    except Exception as e:
        logger.error(f"Real-time transcription error: {e}")
        # 确保即使在 transcribe_audio_data 中抛出 HTTPException，也能正确处理
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form("auto"),
    realtime: str = Form("false") # 新增参数，用于区分实时流
):
    """
    接收音频文件，进行语音识别并返回结果。
    新增 realtime 参数来明确告知这是前端实时录音流。
    """
    logger.info(f"Received audio file for transcription. Size: {file.size}, Language: {language}, Realtime: {realtime}")

    # 读取上传的音频文件内容
    contents = await file.read()

    # 根据 realtime 参数判断是否为 webm
    is_webm = realtime.lower() == 'true'

    # 转换音频为 WAV 格式
    wav_data = convert_audio_to_wav(contents, is_webm)
    if wav_data is None:
        raise HTTPException(status_code=400, detail="Audio conversion failed.")

    # 创建一个临时的 WAV 文件
    with tempfile.NamedTemporaryFile(delete=True, suffix=".wav") as temp_wav_file:
        # 写入转换后的音频数据
        temp_wav_file.write(wav_data)
        temp_wav_file.flush()  # 确保数据写入

        logger.info(f"Transcribing audio from temp WAV file: {temp_wav_file.name}")

        # 从临时文件加载音频
        audio_np = whisper.load_audio(temp_wav_file.name)

        # 执行转录
        logger.info("Starting transcription...")
        
        # 添加超时处理和更简单的参数
        transcribe_options = {
            "language": language if language != 'auto' else None,
            "fp16": False,
            "verbose": True,
            "no_speech_threshold": 0.6,
            "logprob_threshold": -1.0,
            "compression_ratio_threshold": 2.4,
            "condition_on_previous_text": False
        }
        
        logger.info(f"Starting transcription with options: {transcribe_options}")
        
        loop = asyncio.get_running_loop()
        blocking_task = functools.partial(_transcribe_blocking, model, audio_np, **transcribe_options)
        result = await loop.run_in_executor(None, blocking_task)
        
        logger.info("Transcription call finished.")
        logger.info(f"Transcription completed successfully. Text: \'{result['text'][:100]}...\'")
        
        # 包装成统一的成功响应格式
        response_data = {
            "text": result["text"],
            "language": result.get("language", "unknown")
        }
        return {"success": True, "result": response_data}

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )
