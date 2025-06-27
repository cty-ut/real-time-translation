#!/usr/bin/env python3
"""
测试音频转录功能的脚本
"""
import requests
import io
import json

def test_whisper_service():
    """测试Whisper服务是否正常工作"""
    try:
        # 测试健康检查
        health_response = requests.get('http://localhost:8001/health', timeout=5)
        print(f"Whisper健康检查: {health_response.status_code} - {health_response.text}")
        
        # 测试翻译服务
        translator_health = requests.get('http://localhost:8002/health', timeout=5)
        print(f"翻译服务健康检查: {translator_health.status_code} - {translator_health.text}")
        
        # 测试后端服务
        backend_health = requests.get('http://localhost:8000/api/health', timeout=5)
        print(f"后端服务健康检查: {backend_health.status_code}")
        print(json.dumps(backend_health.json(), indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(f"健康检查失败: {e}")

def test_transcribe_with_mp3():
    """使用 test.mp3 文件测试 whisper 服务"""
    try:
        audio_file_path = 'test.mp3'
        with open(audio_file_path, 'rb') as f:
            files = {
                'file': (audio_file_path, f, 'audio/mpeg')
            }
            data = {
                'language': 'auto'
            }
            response = requests.post(
                'http://localhost:8001/transcribe',  # Directly test the whisper service
                files=files,
                data=data,
                timeout=60  # Increased timeout for transcription
            )

        print(f"\n=== Whisper 转录测试 ({audio_file_path}) ===")
        print(f"Whisper 转录测试: {response.status_code}")
        if response.status_code == 200:
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        else:
            print(f"错误响应: {response.text}")

    except Exception as e:
        print(f"Whisper 转录测试失败: {e}")


if __name__ == '__main__':
    print("=== 语音转录系统测试 ===")
    test_whisper_service()
    test_transcribe_with_mp3()
