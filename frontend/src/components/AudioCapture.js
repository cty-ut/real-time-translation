import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  padding: 20px;
  text-align: center;
`;

const VisualizerContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 80px;
  margin: 20px 0;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  padding: 20px;
`;

const AudioBar = styled.div`
  width: 4px;
  background: ${props => props.isActive ? '#4CAF50' : '#ccc'};
  border-radius: 2px;
  margin: 0 1px;
  transition: height 0.1s ease;
  height: ${props => props.height}px;
`;

const StatusText = styled.p`
  margin: 10px 0;
  color: ${props => props.isListening ? '#4CAF50' : '#666'};
  font-weight: 500;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 4px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin: 10px 0;
`;

const Progress = styled.div`
  height: 100%;
  background: #4CAF50;
  border-radius: 2px;
  transition: width 0.3s ease;
  width: ${props => props.progress}%;
`;

const AudioCapture = ({ 
  isActive, 
  language, 
  onError,
  socket,
  targetLanguage = 'zh',
  lastTranscription // 新增 props
}) => {
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [sessionId, setSessionId] = useState(null);

  const audioChunks = useRef([]);
  const audioContext = useRef(null);
  const analyser = useRef(null);
  const microphone = useRef(null);
  const dataArray = useRef(null);
  const animationFrame = useRef(null);
  const silenceTimer = useRef(null);
  const recordingTimer = useRef(null);
  const mediaStream = useRef(null);

  // 配置 - 优化实时性
  const SILENCE_THRESHOLD = 0.005;
  const SILENCE_DURATION = 700;    // 静音检测时长 (ms)
  const MAX_RECORDING_DURATION = 5000;  // 最大录音时长 (ms)
  const MIN_RECORDING_DURATION = 500;   // 最小录音时长 (ms)
  const MIN_AUDIO_SIZE = 1000;  // 最小音频文件大小 (bytes)

  // 初始化音频设备
  useEffect(() => {
    if (isActive) {
      initializeAudio();
    } else {
      cleanup();
    }

    return cleanup;
  }, [isActive]);

  const initializeAudio = async () => {
    try {
      // 清理之前的资源
      cleanup();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000
        }
      });

      if (stream.getAudioTracks().length === 0) {
        throw new Error('没有找到音频轨道');
      }

      // 保存媒体流引用
      mediaStream.current = stream;

      // 设置音频分析
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
      
      // 确保AudioContext处于运行状态
      if (audioContext.current.state === 'suspended') {
        await audioContext.current.resume();
      }
      
      analyser.current = audioContext.current.createAnalyser();
      microphone.current = audioContext.current.createMediaStreamSource(stream);
      
      // 优化音频分析器设置以提高敏感度
      analyser.current.fftSize = 512;
      analyser.current.smoothingTimeConstant = 0.3;
      analyser.current.minDecibels = -90;
      analyser.current.maxDecibels = -10;
      
      microphone.current.connect(analyser.current);
      
      const bufferLength = analyser.current.frequencyBinCount;
      dataArray.current = new Uint8Array(bufferLength);

      // 设置录音器 - 优化音频格式兼容性
      let options = {};
      
      // 按优先级尝试不同的音频格式
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm;codecs=vp8,opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav'
      ];
      
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          options = { 
            mimeType,
            audioBitsPerSecond: 16000  // 设置音频比特率
          };
          console.log(`使用音频格式: ${mimeType}`);
          break;
        }
      }
      
      if (!options.mimeType) {
        console.log('使用默认音频格式');
        options = {
          audioBitsPerSecond: 16000
        };
      }
      
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        processAudioChunks();
      };

      recorder.onerror = (event) => {
        onError('录音器错误: ' + event.error.message);
      };

      // 使用回调确保状态更新后再开始录音
      setMediaRecorder(() => {
        // 延迟启动以确保状态已更新
        setTimeout(() => {
          if (isActive) {
            startListeningWithRecorder(recorder);
          }
        }, 100);
        return recorder;
      });

    } catch (error) {
      onError('无法访问麦克风，请检查权限设置: ' + error.message);
    }
  };

  const startListeningWithRecorder = (recorder) => {
    if (!recorder || recorder.state === 'recording') {
      return;
    }

    audioChunks.current = [];
    setIsRecording(true);
    
    // 记录录制开始时间
    window.recordingStartTime = Date.now();
    
    try {
      // 设置录音参数 - 使用更短的时间片
      recorder.start(100); // 减少到100ms提高响应性
    } catch (error) {
      onError('启动录音失败: ' + error.message);
      return;
    }
    
    // 开始音频可视化
    visualizeAudio();
    
    // 设置最大录音时长
    recordingTimer.current = setTimeout(() => {
      if (recorder.state === 'recording') {
        stopRecording();
      }
    }, MAX_RECORDING_DURATION);
  };

  const startListening = () => {
    if (!mediaRecorder) {
      return;
    }

    startListeningWithRecorder(mediaRecorder);
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
      
      if (recordingTimer.current) {
        clearTimeout(recordingTimer.current);
        recordingTimer.current = null;
      }
      
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current);
        silenceTimer.current = null;
      }
    }
  };

  const visualizeAudio = () => {
    if (!analyser.current || !dataArray.current || !isActive) {
      return;
    }

    // 使用两种方法检测音频：频域和时域
    
    // 方法1：频域分析 (原有方法)
    analyser.current.getByteFrequencyData(dataArray.current);
    const freqAverage = dataArray.current.reduce((a, b) => a + b) / dataArray.current.length;
    const freqLevel = freqAverage / 255;
    
    // 方法2：时域分析 (更敏感)
    const timeDataArray = new Uint8Array(analyser.current.fftSize);
    analyser.current.getByteTimeDomainData(timeDataArray);
    
    // 计算RMS (均方根) 来检测音频强度
    let sumSquares = 0;
    for (let i = 0; i < timeDataArray.length; i++) {
      const normalized = (timeDataArray[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / timeDataArray.length);
    
    // 使用两种方法中较高的一个
    const normalizedLevel = Math.max(freqLevel, rms);
    
    setAudioLevel(normalizedLevel);

    // 检测静音
    if (normalizedLevel < SILENCE_THRESHOLD) {
      if (!silenceTimer.current && isRecording) {
        silenceTimer.current = setTimeout(() => {
          // 检查是否达到最小录制时长
          const recordingDuration = Date.now() - (window.recordingStartTime || 0);
          if (recordingDuration >= MIN_RECORDING_DURATION) {
            stopRecording();
          } else {
            // 未达到最小时长，继续录制
            silenceTimer.current = null;
          }
        }, SILENCE_DURATION);
      }
    } else {
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current);
        silenceTimer.current = null;
      }
    }

    if (isActive) {
      animationFrame.current = requestAnimationFrame(visualizeAudio);
    }
  };

  const processAudioChunks = async () => {
    if (audioChunks.current.length === 0) {
      setTimeout(startListening, 500);
      return;
    }

    try {
      setProcessingProgress(10);
      
      const audioBlob = new Blob(audioChunks.current, { type: audioChunks.current[0]?.type || 'audio/webm' });
      
      // 检查音频时长和大小 - 使用更严格的检查
      if (audioBlob.size < MIN_AUDIO_SIZE) {
        console.log(`音频文件太小 (${audioBlob.size} bytes)，跳过处理`);
        setTimeout(startListening, 500);
        return;
      }

      const arrayBuffer = await audioBlob.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        throw new Error('音频数据为空');
      }
      
      setProcessingProgress(30);

      if (socket && socket.connected) {
        const currentSessionId = Date.now().toString();
        setSessionId(currentSessionId);
        sendAudioForTranscription(arrayBuffer, audioBlob.type, currentSessionId);
        setProcessingProgress(100); // Assume sent
        setTimeout(() => {
          setProcessingProgress(0);
          if (isActive) {
            startListening();
          }
        }, 200);
      } else {
        onError('WebSocket 未连接');
        setProcessingProgress(0);
        if (isActive) {
          setTimeout(startListening, 1000);
        }
      }

    } catch (error) {
      onError('音频处理失败: ' + error.message);
      setProcessingProgress(0);
      if (isActive) {
        setTimeout(startListening, 1000);
      }
    }
  };

  const sendAudioForTranscription = (audioData, mimeType, sessionId) => {
    if (!socket || !socket.connected) {
      onError('WebSocket 未连接，无法发送音频');
      return;
    }

    socket.emit('audio_chunk', {
      audio: audioData,
      language: language,
      target_lang: targetLanguage,
      sessionId: sessionId,
      mimeType: mimeType || mediaRecorder?.mimeType || 'audio/webm'
    });

    setProcessingProgress(50); // 更新进度条
  };

  const cleanup = () => {
    // 清理动画帧
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
    
    // 清理定时器
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
    
    if (recordingTimer.current) {
      clearTimeout(recordingTimer.current);
      recordingTimer.current = null;
    }

    // 停止录音
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      try {
        mediaRecorder.stop();
      } catch (error) {
        // Ignore
      }
    }

    // 断开音频节点连接
    if (microphone.current) {
      try {
        microphone.current.disconnect();
        microphone.current = null;
      } catch (error) {
        // Ignore
      }
    }

    // 关闭音频上下文
    if (audioContext.current && audioContext.current.state !== 'closed') {
      try {
        audioContext.current.close();
        audioContext.current = null;
      } catch (error) {
        // Ignore
      }
    }

    // 停止媒体流
    if (mediaStream.current) {
      try {
        mediaStream.current.getTracks().forEach(track => {
          track.stop();
        });
        mediaStream.current = null;
      } catch (error) {
        // Ignore
      }
    }

    // 重置状态
    setIsRecording(false);
    setAudioLevel(0);
    setProcessingProgress(0);
    setMediaRecorder(null);
    
    // 清理音频数据
    audioChunks.current = [];
    dataArray.current = null;
    analyser.current = null;
  };

  // 生成可视化柱状图
  const generateVisualizerBars = () => {
    const bars = [];
    const barCount = 20;
    
    for (let i = 0; i < barCount; i++) {
      const height = isRecording 
        ? 10 + Math.random() * audioLevel * 50 
        : 10;
      
      bars.push(
        <AudioBar
          key={i}
          height={height}
          isActive={isRecording && audioLevel > 0.01}
        />
      );
    }
    
    return bars;
  };

  return (
    <Container>
      <StatusText isListening={isRecording}>
        {isRecording ? '🎤 正在监听...' : 
         processingProgress > 0 ? '🔄 处理中...' : 
         '⏸️ 等待中...'}
      </StatusText>

      <VisualizerContainer>
        {generateVisualizerBars()}
      </VisualizerContainer>

      {processingProgress > 0 && (
        <ProgressBar>
          <Progress progress={processingProgress} />
        </ProgressBar>
      )}

      {lastTranscription && (
        <StatusText style={{ color: '#666', fontSize: '14px', fontStyle: 'italic' }}>
          最后识别: {lastTranscription}
        </StatusText>
      )}
    </Container>
  );
};

export default AudioCapture;
