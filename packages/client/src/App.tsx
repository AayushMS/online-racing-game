// packages/client/src/App.tsx
import React, { useState } from 'react';
import { SocketProvider } from './network/SocketContext';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { PodiumScreen } from './screens/PodiumScreen';

export type Screen = 'home' | 'lobby' | 'game' | 'podium';

export interface AppState {
  screen: Screen;
  nickname: string;
  roomCode: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialRoomState?: any;
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
      {appState.screen === 'home' && <HomeScreen navigate={navigate} />}
      {appState.screen === 'lobby' && <LobbyScreen appState={appState} navigate={navigate} />}
      {appState.screen === 'game' && <GameScreen appState={appState} navigate={navigate} />}
      {appState.screen === 'podium' && <PodiumScreen appState={appState} navigate={navigate} />}
    </SocketProvider>
  );
}
