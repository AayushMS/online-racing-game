// packages/client/src/screens/HomeScreen.tsx
import React, { useState } from 'react';
import { useSocketContext } from '../network/SocketContext';
import { useSocketEvent } from '../network/useSocket';
import { EV_CREATE_ROOM, EV_JOIN_ROOM, EV_MATCHMAKE, EV_ROOM_STATE } from '@racing/shared';
import { AppState, Screen } from '../App';

interface Props {
  navigate: (screen: Screen, patch?: Partial<AppState>) => void;
}

export function HomeScreen({ navigate }: Props) {
  const socket = useSocketContext();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');

  useSocketEvent(EV_ROOM_STATE, (data: any) => {
    navigate('lobby', { nickname, roomCode: data.code, initialRoomState: data });
  });

  useSocketEvent<string>('error', (msg) => {
    setError(msg);
  });

  const validNick = nickname.trim().length >= 2;

  const createRoom = () => {
    if (!validNick) { setError('Enter a nickname (min 2 chars)'); return; }
    socket.emit(EV_CREATE_ROOM, { nickname: nickname.trim(), roomName: `${nickname.trim()}'s Race`, isPrivate: false });
  };

  const joinRoom = () => {
    if (!validNick) { setError('Enter a nickname'); return; }
    if (roomCode.trim().length !== 6) { setError('Enter a 6-character room code'); return; }
    socket.emit(EV_JOIN_ROOM, { nickname: nickname.trim(), code: roomCode.trim().toUpperCase() });
  };

  const matchmake = () => {
    if (!validNick) { setError('Enter a nickname'); return; }
    socket.emit(EV_MATCHMAKE, { nickname: nickname.trim() });
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'linear-gradient(135deg, #1a0a2e 0%, #0d2050 100%)',
      gap: 20,
    }}>
      <h1 style={{
        fontSize: 72, fontWeight: 900, letterSpacing: 4,
        color: '#FFE44D', textShadow: '0 0 40px #ff8800, 6px 6px 0 #aa2200',
        marginBottom: 10,
      }}>
        KART CHAOS
      </h1>
      <p style={{ color: '#aaa', fontSize: 16, marginBottom: 20 }}>Online 3D Racing · 5–8 Players</p>

      <input
        placeholder="Your nickname..."
        value={nickname}
        onChange={e => { setNickname(e.target.value); setError(''); }}
        maxLength={16}
        style={{
          padding: '12px 24px', fontSize: 20, borderRadius: 12, border: '2px solid #444',
          background: '#111', color: '#fff', width: 320, outline: 'none',
        }}
      />

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Btn color="#ff4444" onClick={createRoom}>🏁 Create Room</Btn>
        <Btn color="#4444ff" onClick={matchmake}>⚡ Quick Race</Btn>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          placeholder="Room code..."
          value={roomCode}
          onChange={e => setRoomCode(e.target.value.toUpperCase())}
          maxLength={6}
          style={{
            padding: '10px 16px', fontSize: 18, borderRadius: 10, border: '2px solid #555',
            background: '#111', color: '#fff', width: 160, letterSpacing: 4, outline: 'none',
          }}
        />
        <Btn color="#44aa44" onClick={joinRoom}>Join</Btn>
      </div>

      {error && <p style={{ color: '#ff6666', fontSize: 14 }}>{error}</p>}

      <p style={{ color: '#555', fontSize: 12, marginTop: 30 }}>
        Arrow keys / WASD to drive · SPACE to use item
      </p>
    </div>
  );
}

function Btn({ children, onClick, color }: { children: React.ReactNode; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 28px', fontSize: 18, fontWeight: 'bold', borderRadius: 12,
        border: 'none', background: color, color: '#fff', cursor: 'pointer',
        boxShadow: '0 4px 0 #0004',
      }}
    >
      {children}
    </button>
  );
}
