import React from 'react';
import styled from 'styled-components';

const PanelContainer = styled.div`
  padding: 20px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
  align-items: center;
  gap: 20px;
`;

const ControlButton = styled.button`
  background: ${props => props.isRecording ? '#f44336' : '#4CAF50'};
  color: white;
  border: none;
  padding: 12px 25px;
  border-radius: 50px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  min-width: 150px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const SelectContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const SelectLabel = styled.label`
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 5px;
`;

const Select = styled.select`
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: white;
  min-width: 150px;
  font-size: 1rem;
`;

const ControlPanel = ({ 
  isRecording, 
  onStart,
  onStop,
  language, 
  onLanguageChange,
  targetLanguage,
  onTargetLanguageChange,
}) => {

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ja', label: 'Japanese' },
    { value: 'auto', label: 'Auto Detect' },
  ];

  const targetLanguageOptions = [
    { value: 'zh', label: 'Chinese' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: 'Japanese' },
  ];

  const handleToggle = () => {
    if (isRecording) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <PanelContainer>
      <ControlButton onClick={handleToggle} isRecording={isRecording}>
        {isRecording ? '停止录音' : '开始录音'}
      </ControlButton>

      <SelectContainer>
        <SelectLabel htmlFor="source-lang">源语言</SelectLabel>
        <Select 
          id="source-lang"
          value={language} 
          onChange={(e) => onLanguageChange(e.target.value)}
          disabled={isRecording}
        >
          {languageOptions.map(lang => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </Select>
      </SelectContainer>

      <SelectContainer>
        <SelectLabel htmlFor="target-lang">目标语言</SelectLabel>
        <Select 
          id="target-lang"
          value={targetLanguage} 
          onChange={(e) => onTargetLanguageChange(e.target.value)}
          disabled={isRecording}
        >
          {targetLanguageOptions.map(lang => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </Select>
      </SelectContainer>
    </PanelContainer>
  );
};

export default ControlPanel;
