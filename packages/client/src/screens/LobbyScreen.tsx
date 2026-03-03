// packages/client/src/screens/LobbyScreen.tsx
import React, { useState } from 'react';
import { useSocketContext } from '../network/SocketContext';
import { useSocketEvent } from '../network/useSocket';
import { EV_PLAYER_READY, EV_START_RACE, EV_ROOM_STATE, EV_RACE_STARTED } from '@racing/shared';
import { AppState, Screen } from '../App';

interface Props {
  appState: AppState;
  navigate: (screen: Screen, patch?: Partial<AppState>) => void;
}

interface PlayerEntry {
  nickname: string;
  ready: boolean;
  isHost: boolean;
}

interface RoomStateData {
  code: string;
  name: string;
  players: Record<string, PlayerEntry>;
  phase: string;
}

export function LobbyScreen({ appState, navigate }: Props) {
  const socket = useSocketContext();
  const [roomState, setRoomState] = useState<RoomStateData | null>(appState.initialRoomState ?? null);
  const [ready, setReady] = useState(false);

  useSocketEvent<RoomStateData>(EV_ROOM_STATE, setRoomState);
  useSocketEvent<void>(EV_RACE_STARTED, () => navigate('game'));

  const myEntry = roomState?.players[socket.id ?? ''];
  const isHost = myEntry?.isHost ?? false;

  const handleReady = () => {
    if (ready) return;
    socket.emit(EV_PLAYER_READY);
    setReady(true);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'linear-gradient(135deg, #0d2050 0%, #1a0a2e 100%)',
      gap: 20, color: '#fff',
    }}>
      <h2 style={{ fontSize: 36, color: '#FFE44D' }}>Waiting Room</h2>

      {roomState && (
        <div style={{
          background: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 32px',
          fontSize: 18, letterSpacing: 3, color: '#adf',
        }}>
          Room Code: <strong style={{ fontSize: 28, color: '#FFE44D' }}>{roomState.code}</strong>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 320 }}>
        {roomState && Object.entries(roomState.players).map(([id, p]) => (
          <div key={id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 18px',
          }}>
            <span>{p.isHost ? '👑 ' : '  '}{p.nickname}</span>
            <span style={{ color: p.ready ? '#44ff88' : '#ff6644' }}>
              {p.ready ? '✓ Ready' : 'Not ready'}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
        {!ready && (
          <button onClick={handleReady} style={btnStyle('#44aa44')}>✓ Ready Up</button>
        )}
        {isHost && (
          <button onClick={() => socket.emit(EV_START_RACE)} style={btnStyle('#ff4444')}>
            🏁 Start Race
          </button>
        )}
      </div>

      <p style={{ color: '#555', fontSize: 13 }}>Share the room code with friends!</p>
    </div>
  );
}

const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '12px 28px', fontSize: 18, fontWeight: 'bold', borderRadius: 12,
  border: 'none', background: bg, color: '#fff', cursor: 'pointer',
});
