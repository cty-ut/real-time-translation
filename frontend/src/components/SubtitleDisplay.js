import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  padding: 20px;
  min-height: 300px;
  max-height: 500px;
  overflow-y: auto;
`;

const EmptyState = styled.div`
  text-align: center;
  color: #999;
  font-style: italic;
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
`;

const SubtitleItem = styled.div`
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
  &:last-child {
    border-bottom: none;
  }
`;

const OriginalText = styled.p`
  font-size: 16px;
  color: #666;
  margin: 0 0 5px 0;
`;

const TranslatedText = styled.p`
  font-size: 18px;
  color: #333;
  font-weight: 500;
  margin: 0;
`;

const Metadata = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  font-size: 12px;
  color: #999;
  flex-wrap: wrap;
  gap: 10px;
`;

const LanguageTag = styled.span`
  background: rgba(76, 175, 80, 0.1);
  color: #4CAF50;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
`;

const ConfidenceBar = styled.div`
  width: 60px;
  height: 4px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
`;

const ConfidenceFill = styled.div`
  height: 100%;
  background: ${props => 
    props.confidence > 0.8 ? '#4CAF50' :
    props.confidence > 0.6 ? '#FF9800' :
    '#F44336'
  };
  width: ${props => (props.confidence * 100)}%;
  transition: width 0.3s ease;
`;

const Timestamp = styled.span`
  font-family: monospace;
`;

const ListeningIndicator = styled.div`
  text-align: center;
  padding: 20px;
  color: #4CAF50;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  
  &::before {
    content: '🎤';
    animation: pulse 1.5s infinite;
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }
`;

const SubtitleDisplay = ({ subtitles, isListening }) => {
  const containerRef = useRef(null);

  // 自动滚动到最新字幕
  useEffect(() => {
    if (containerRef.current && subtitles.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [subtitles]);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getLanguageLabel = (lang) => {
    const labels = {
      'ja': '日语',
      'en': '英语',
      'zh': '中文',
      'auto': '自动'
    };
    return labels[lang] || lang;
  };

  if (subtitles.length === 0 && !isListening) {
    return (
      <Container>
        <EmptyState>
          <div style={{ fontSize: '48px', opacity: 0.3 }}>💬</div>
          <div>暂无字幕内容</div>
          <div style={{ fontSize: '12px', color: '#ccc' }}>
            点击"开始监听"开始实时翻译
          </div>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container ref={containerRef}>
      {subtitles.map((subtitle) => (
        <SubtitleItem key={subtitle.id}>
          <OriginalText>
            {subtitle.original}
          </OriginalText>
          
          <TranslatedText>
            {subtitle.translated}
          </TranslatedText>
          
          <Metadata>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <LanguageTag>
                {getLanguageLabel(subtitle.sourceLang)} → {getLanguageLabel(subtitle.targetLang)}
              </LanguageTag>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>准确度:</span>
                <ConfidenceBar>
                  <ConfidenceFill confidence={subtitle.confidence} />
                </ConfidenceBar>
                <span>{Math.round(subtitle.confidence * 100)}%</span>
              </div>
            </div>
            
            <Timestamp>
              {formatTimestamp(subtitle.timestamp)}
            </Timestamp>
          </Metadata>
        </SubtitleItem>
      ))}
      
      {isListening && (
        <ListeningIndicator>
          正在监听，请开始说话...
        </ListeningIndicator>
      )}
    </Container>
  );
};

export default SubtitleDisplay;
