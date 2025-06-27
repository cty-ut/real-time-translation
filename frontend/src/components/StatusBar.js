import React from 'react';
import styled from 'styled-components';

const Bar = styled.div`
  width: 100%;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 10px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
  min-height: 44px;
`;
const Status = styled.span`
  color: ${props => (props.connected ? '#4caf50' : '#f44336')};
  font-weight: bold;
`;
const Error = styled.span`
  color: #f44336;
  margin-left: 16px;
  font-size: 13px;
`;

function StatusBar({ connected, error }) {
  return (
    <Bar>
      <Status connected={connected}>{connected ? '🟢 已连接' : '🔴 未连接'}</Status>
      {error && <Error>{error}</Error>}
    </Bar>
  );
}

export default StatusBar;
