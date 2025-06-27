import React from 'react';
import styled from 'styled-components';

const Panel = styled.div`
  display: flex;
  gap: 32px;
  margin-top: 16px;
  width: 100%;
  max-width: 700px;
  justify-content: center;
`;
const Box = styled.div`
  flex: 1;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  padding: 24px 18px;
  min-height: 90px;
  display: flex;
  flex-direction: column;
  font-size: 18px;
  line-height: 1.7;
  word-break: break-all;
`;
const Title = styled.div`
  font-size: 14px;
  color: #888;
  margin-bottom: 8px;
  font-weight: 500;
`;
const Content = styled.div`
  color: #222;
  font-family: 'Fira Mono', 'Menlo', 'Consolas', monospace;
`;

function SubtitlePanel({ transcription, translation }) {
  return (
    <Panel>
      <Box>
        <Title>原文</Title>
        <Content>{transcription || <span style={{color:'#bbb'}}>等待识别...</span>}</Content>
      </Box>
      <Box>
        <Title>翻译</Title>
        <Content>{translation || <span style={{color:'#bbb'}}>等待翻译...</span>}</Content>
      </Box>
    </Panel>
  );
}

export default SubtitlePanel;
