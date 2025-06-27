
import requests
import json
import os

# --- 配置 ---
BACKEND_URL = "http://localhost:8000/api/audio"
AUDIO_FILE_PATH = "test.mp3"  # 假设文件在项目根目录
TARGET_LANG = "zh"  # 目标翻译语言：中文

def run_full_flow_test():
    """
    测试完整的后端流程:
    1. 上传音频文件进行转录。
    2. 将转录后的文本进行翻译。
    """
    print("=== 开始端到端完整流程测试 ===")

    # --- 1. 检查音频文件是否存在 ---
    if not os.path.exists(AUDIO_FILE_PATH):
        print(f"❌ 错误: 测试音频文件未找到: {AUDIO_FILE_PATH}")
        print("请确保 'test.mp3' 文件位于项目的根目录。")
        return

    # --- 2. 音频转录 (调用 /api/audio/transcribe) ---
    transcribed_text = None
    source_lang = None
    try:
        print(f"\n--- 步骤 1: 上传 '{AUDIO_FILE_PATH}' 进行转录... ---")
        with open(AUDIO_FILE_PATH, 'rb') as f:
            # 后端 'upload.single('audio')' 中间件期望的字段名是 'audio'
            files = {'audio': (os.path.basename(AUDIO_FILE_PATH), f, 'audio/mpeg')}
            # 后端接口需要 'language' 字段
            data = {'language': 'auto'} 
            
            response = requests.post(
                f"{BACKEND_URL}/transcribe",
                files=files,
                data=data,
                timeout=90  # 为转录设置较长的超时时间
            )
        
        response.raise_for_status()  # 如果是 4xx 或 5xx 错误，将抛出异常
        
        result = response.json()
        if result.get("success"):
            # 根据 audio.js 的返回格式解析
            transcribed_text = result["result"]["text"]
            source_lang = result["result"]["language"]
            print(f"✅ 转录成功!")
            print(f"   - 识别出的语言: {source_lang}")
            print(f"   - 转录文本: \"{transcribed_text}\"")
        else:
            print(f"❌ 服务端转录失败: {result.get('error')}")
            return

    except requests.exceptions.RequestException as e:
        print(f"❌ 调用转录 API 时发生严重错误: {e}")
        if e.response:
            print(f"   - 服务端响应: {e.response.text}")
        return
    except Exception as e:
        print(f"❌ 转录过程中发生未知错误: {e}")
        return

    # --- 3. 文本翻译 (调用 /api/audio/translate) ---
    if not transcribed_text or not source_lang:
        print("\n--- 跳过步骤 2: 没有需要翻译的文本。 ---")
        return
        
    try:
        print(f"\n--- 步骤 2: 将文本翻译为 '{TARGET_LANG}'... ---")
        payload = {
            "text": transcribed_text,
            "source_lang": source_lang,
            "target_lang": TARGET_LANG
        }
        
        response = requests.post(
            f"{BACKEND_URL}/translate",
            json=payload,
            timeout=30
        )
        
        response.raise_for_status()
        
        result = response.json()
        if result.get("success"):
            translated_text = result["result"]["translated_text"]
            print("✅ 翻译成功!")
            print(f"   - 翻译结果: \"{translated_text}\"")
        else:
            print(f"❌ 服务端翻译失败: {result.get('error')}")
            return

    except requests.exceptions.RequestException as e:
        print(f"❌ 调用翻译 API 时发生严重错误: {e}")
        if e.response:
            print(f"   - 服务端响应: {e.response.text}")
        return
    except Exception as e:
        print(f"❌ 翻译过程中发生未知错误: {e}")
        return

    print("\n=== ✅ 端到端完整流程测试成功! ===")


if __name__ == "__main__":
    run_full_flow_test()
