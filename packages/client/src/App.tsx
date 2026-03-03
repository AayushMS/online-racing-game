// packages/client/src/App.tsx
import React, { useState } from 'react';
import { SocketProvider } from './network/SocketContext';

export type Screen = 'home' | 'lobby' | 'game' | 'podium';

export interface AppState {
  screen: Screen;
  nickname: string;
  roomCode: string;
}

export default function App() {
  const [appState, setAppState] = useState<AppState>({
    screen: 'home',
    nickname: '',
    roomCode: '',
  });

  const navigate = (screen: Screen, patch: Partial<AppState> = {}) => {
    setAppState(s => ({ ...s, screen, ...patch }));
  };

  return (
    <SocketProvider>
      <div style={{ width: '100vw', height: '100vh' }}>
        {appState.screen === 'home' && <div>Home Screen (placeholder)</div>}
        {appState.screen === 'lobby' && <div>Lobby Screen (placeholder)</div>}
        {appState.screen === 'game' && <div>Game Screen (placeholder)</div>}
        {appState.screen === 'podium' && <div>Podium Screen (placeholder)</div>}
      </div>
    </SocketProvider>
  );
}
