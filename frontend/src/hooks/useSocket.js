import { useEffect, useRef, useState } from 'react';

// 获取 ws 地址，优先用 .env 配置
const WS_URL = (process.env.REACT_APP_BACKEND_URL || 'ws://localhost:8000').replace(/^http/, 'ws');

export default function useSocket() {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [lastTranscription, setLastTranscription] = useState('');
  const [lastTranslation, setLastTranslation] = useState('');
  const wsRef = useRef(null);

  useEffect(() => {
    let ws;
    function connect() {
      ws = new window.WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        setError('');
      };
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 2000); // 自动重连
      };
      ws.onerror = (e) => {
        setError('WebSocket 连接错误');
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.transcription_result) {
            setLastTranscription(data.transcription_result);
          }
          if (data.translation_result) {
            setLastTranslation(data.translation_result);
          }
        } catch (e) {
          // 忽略解析错误
        }
      };
    }
    connect();
    return () => {
      ws && ws.close();
    };
  }, []);

  // 发送音频数据
  const sendAudio = (audioBlob) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(audioBlob);
    }
  };

  return {
    connected,
    error,
    sendAudio,
    lastTranscription,
    lastTranslation,
  };
}
