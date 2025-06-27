import React, { useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import StatusBar from './components/StatusBar';
import ListenButton from './components/ListenButton';
import SubtitlePanel from './components/SubtitlePanel';
import useSocket from './hooks/useSocket';

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: #f6f8fa;
    color: #222;
  }
`;

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const Main = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 8px 16px 8px;
`;

function App() {
  const [isListening, setIsListening] = useState(false);
  const { connected, error, sendAudio, lastTranscription, lastTranslation } = useSocket();

  return (
    <AppContainer>
      <GlobalStyle />
      <StatusBar connected={connected} error={error} />
      <Main>
        <ListenButton
          isListening={isListening}
          setIsListening={setIsListening}
          sendAudio={sendAudio}
          disabled={!connected}
        />
        <SubtitlePanel
          transcription={lastTranscription}
          translation={lastTranslation}
        />
      </Main>
    </AppContainer>
  );
}

export default App;
