import React, { useRef } from 'react';
import styled from 'styled-components';

const Button = styled.button`
  background: ${props => (props.isListening ? '#f44336' : '#1976d2')};
  color: #fff;
  border: none;
  border-radius: 50px;
  font-size: 22px;
  padding: 22px 48px;
  margin: 32px 0 24px 0;
  box-shadow: 0 4px 16px rgba(25, 118, 210, 0.08);
  cursor: pointer;
  outline: none;
  transition: background 0.2s;
  font-weight: 600;
  letter-spacing: 1px;
  &:disabled {
    background: #bdbdbd;
    cursor: not-allowed;
  }
`;

function ListenButton({ isListening, setIsListening, sendAudio, disabled }) {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleClick = async () => {
    if (isListening) {
      // 停止录音
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
      return;
    }
    // 开始录音
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new window.MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          sendAudio(e.data);
        }
      };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start(300); // 300ms 一片
      setIsListening(true);
    } catch (err) {
      alert('无法获取麦克风权限: ' + err.message);
    }
  };

  return (
    <Button
      isListening={isListening}
      onClick={handleClick}
      disabled={disabled}
    >
      {isListening ? '⏹️ 停止监听' : '🎤 开始监听'}
    </Button>
  );
}

export default ListenButton;
