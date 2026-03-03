// packages/client/src/screens/PodiumScreen.tsx
import React from 'react';
import { AppState, Screen } from '../App';

interface Props {
  appState: AppState;
  navigate: (screen: Screen, patch?: Partial<AppState>) => void;
}

export function PodiumScreen({ appState, navigate }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'linear-gradient(135deg, #1a0a2e 0%, #0a2010 100%)',
      color: '#fff', gap: 28,
    }}>
      <h1 style={{ fontSize: 64, color: '#FFE44D', textShadow: '0 0 30px #ff8800' }}>
        🏆 Race Finished!
      </h1>
      <div style={{ fontSize: 22, color: '#aaa' }}>Great race, {appState.nickname}!</div>
      <div style={{ display: 'flex', gap: 16, marginTop: 20 }}>
        <button
          onClick={() => navigate('lobby', appState)}
          style={{ padding: '14px 32px', fontSize: 20, fontWeight: 'bold', borderRadius: 12, border: 'none', background: '#4444ff', color: '#fff', cursor: 'pointer' }}
        >
          🔁 Race Again
        </button>
        <button
          onClick={() => navigate('home')}
          style={{ padding: '14px 32px', fontSize: 20, fontWeight: 'bold', borderRadius: 12, border: 'none', background: '#333', color: '#fff', cursor: 'pointer' }}
        >
          🏠 Home
        </button>
      </div>
    </div>
  );
}
