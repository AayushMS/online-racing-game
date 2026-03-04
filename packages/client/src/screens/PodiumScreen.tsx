// packages/client/src/screens/PodiumScreen.tsx
import React from 'react';
import { RaceResult } from '@racing/shared';
import { AppState, Screen } from '../App';

interface Props {
  appState: AppState;
  navigate: (screen: Screen, patch?: Partial<AppState>) => void;
}

function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const tenth = Math.floor((ms % 1000) / 100);
  return `${min}:${sec.toString().padStart(2, '0')}.${tenth}`;
}

const MEDAL = ['🥇', '🥈', '🥉'];
const PODIUM_HEIGHT = [140, 100, 70];
const PODIUM_COLOR = ['#FFD700', '#C0C0C0', '#CD7F32'];

export function PodiumScreen({ appState, navigate }: Props) {
  const results: RaceResult[] = appState.raceResults ?? [];
  const top3 = results.slice(0, 3);
  const rest = results.slice(3);

  const bestLapOverall = results.reduce<number | null>((best, r) => {
    if (r.bestLapMs === null) return best;
    return best === null || r.bestLapMs < best ? r.bestLapMs : best;
  }, null);

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #1a0a2e 0%, #0a2010 100%)',
      color: '#fff', fontFamily: 'monospace', display: 'flex', flexDirection: 'column',
      alignItems: 'center', paddingTop: 40, gap: 24,
    }}>
      <h1 style={{ fontSize: 52, color: '#FFE44D', textShadow: '0 0 30px #ff8800', margin: 0 }}>
        🏆 Race Results
      </h1>

      {/* Podium blocks */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 20 }}>
        {[top3[1], top3[0], top3[2]].map((r, visualIdx) => {
          if (!r) return <div key={visualIdx} style={{ width: 130 }} />;
          const rank = r.position - 1;
          const height = PODIUM_HEIGHT[rank] ?? 60;
          const color = PODIUM_COLOR[rank] ?? '#888';
          const isMe = r.nickname === appState.nickname;
          return (
            <div key={r.playerId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 130 }}>
              <div style={{ fontSize: 32 }}>{MEDAL[rank] ?? ''}</div>
              <div style={{
                fontWeight: 'bold', fontSize: 15, color: isMe ? '#ffee44' : '#fff',
                marginBottom: 6, textAlign: 'center',
              }}>{r.nickname}{isMe ? ' (You)' : ''}</div>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>{formatMs(r.finishTime)}</div>
              {r.bestLapMs !== null && (
                <div style={{ fontSize: 11, color: r.bestLapMs === bestLapOverall ? '#7fffb0' : '#888' }}>
                  Best {formatMs(r.bestLapMs)}{r.bestLapMs === bestLapOverall ? ' ⚡' : ''}
                </div>
              )}
              <div style={{
                width: 130, height, background: color, borderRadius: '8px 8px 0 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 'bold', color: '#000', marginTop: 6,
                boxShadow: `0 0 20px ${color}55`,
              }}>{rank + 1}</div>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 32px',
          width: 400, maxWidth: '90vw',
        }}>
          {rest.map(r => (
            <div key={r.playerId} style={{
              display: 'flex', justifyContent: 'space-between', padding: '6px 0',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              color: r.nickname === appState.nickname ? '#ffee44' : '#ccc',
            }}>
              <span>P{r.position} {r.nickname}</span>
              <span style={{ color: '#888' }}>{formatMs(r.finishTime)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <button
          onClick={() => navigate('lobby', { screen: 'lobby', nickname: appState.nickname, roomCode: appState.roomCode })}
          style={{ padding: '14px 32px', fontSize: 18, fontWeight: 'bold', borderRadius: 12, border: 'none', background: '#4444ff', color: '#fff', cursor: 'pointer' }}
        >🔁 Race Again</button>
        <button
          onClick={() => navigate('home')}
          style={{ padding: '14px 32px', fontSize: 18, fontWeight: 'bold', borderRadius: 12, border: 'none', background: '#333', color: '#fff', cursor: 'pointer' }}
        >🏠 Home</button>
      </div>
    </div>
  );
}
