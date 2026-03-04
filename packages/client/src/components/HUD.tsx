// packages/client/src/components/HUD.tsx
import React from 'react';
import { GameState, ItemType, TOTAL_LAPS, CAR_MAX_SPEED } from '@racing/shared';

interface HUDProps {
  state: GameState;
  myId: string;
  lapTimes: number[];   // ms per completed lap
}

const ITEM_EMOJI: Record<ItemType, string> = {
  missile: '🚀', banana: '🍌', boost: '⚡', shield: '🛡', oil: '🛢',
};

const POSITION_SUFFIX = ['', 'ST', 'ND', 'RD', 'TH', 'TH', 'TH', 'TH', 'TH'];

function getPosition(state: GameState, myId: string): number {
  const sorted = Object.values(state.players).sort(
    (a, b) => (b.lap + b.lapProgress) - (a.lap + a.lapProgress)
  );
  return sorted.findIndex(p => p.id === myId) + 1;
}

function formatMs(ms: number): string {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const tenth = Math.floor((ms % 1000) / 100);
  return `${min}:${sec.toString().padStart(2, '0')}.${tenth}`;
}

export function HUD({ state, myId, lapTimes }: HUDProps) {
  const me = state.players[myId];
  if (!me) return null;

  const pos = getPosition(state, myId);
  const totalPlayers = Object.keys(state.players).length;
  const speedRatio = Math.min(me.speed / CAR_MAX_SPEED, 1);
  const arcDeg = speedRatio * 270;
  const isBoosting = me.activeBuff?.type === 'boost';
  const bestLap = lapTimes.length > 0 ? Math.min(...lapTimes) : null;
  const lastLap = lapTimes.length > 0 ? lapTimes[lapTimes.length - 1] : null;

  // SVG arc for speed ring: arc from -135° to 135° (270° total sweep)
  const r = 44, cx = 55, cy = 55;
  const startAngle = -225 * (Math.PI / 180);
  const sweepAngle = arcDeg * (Math.PI / 180);
  const endAngle = startAngle + sweepAngle;
  const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
  const largeArc = arcDeg > 180 ? 1 : 0;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', fontFamily: 'monospace' }}>

      {/* Position badge — top left */}
      <div style={{
        position: 'absolute', top: 20, left: 20,
        background: 'rgba(0,0,0,0.65)', borderRadius: 14, padding: '6px 16px',
        display: 'flex', alignItems: 'baseline', gap: 2,
      }}>
        <span style={{ fontSize: 48, fontWeight: 'bold', color: pos <= 3 ? '#FFE44D' : '#fff', lineHeight: 1 }}>{pos}</span>
        <span style={{ fontSize: 18, color: '#aaa' }}>{POSITION_SUFFIX[pos] ?? 'TH'}/{totalPlayers}</span>
      </div>

      {/* Lap counter + timers — top right */}
      <div style={{
        position: 'absolute', top: 20, right: 20,
        background: 'rgba(0,0,0,0.65)', borderRadius: 14, padding: '8px 18px',
        textAlign: 'right',
      }}>
        <div style={{ fontSize: 26, fontWeight: 'bold', color: '#fff' }}>
          LAP <span style={{ color: '#FFE44D' }}>{Math.min(me.lap, TOTAL_LAPS)}</span>/{TOTAL_LAPS}
        </div>
        {lastLap && <div style={{ fontSize: 13, color: '#aaa', marginTop: 2 }}>Last: {formatMs(lastLap)}</div>}
        {bestLap && <div style={{ fontSize: 13, color: '#7fffb0', marginTop: 1 }}>Best: {formatMs(bestLap)}</div>}
      </div>

      {/* Speed ring — bottom right */}
      <div style={{ position: 'absolute', bottom: 30, right: 20 }}>
        <svg width={110} height={110} style={{ display: 'block' }}>
          {/* Track arc */}
          <path
            d={`M ${cx + r * Math.cos(-225 * Math.PI / 180)} ${cy + r * Math.sin(-225 * Math.PI / 180)} A ${r} ${r} 0 1 1 ${cx + r * Math.cos(-45 * Math.PI / 180)} ${cy + r * Math.sin(-45 * Math.PI / 180)}`}
            fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={8} strokeLinecap="round"
          />
          {/* Speed arc */}
          {arcDeg > 2 && (
            <path
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
              fill="none"
              stroke={isBoosting ? '#ff6644' : '#44ddff'}
              strokeWidth={8} strokeLinecap="round"
            />
          )}
          {/* Speed number */}
          <text x={cx} y={cy + 6} textAnchor="middle" fill="#fff" fontSize={20} fontWeight="bold" fontFamily="monospace">
            {Math.round(me.speed * 3.6)}
          </text>
          <text x={cx} y={cy + 22} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={11} fontFamily="monospace">
            km/h
          </text>
        </svg>
      </div>

      {/* Item slot — bottom centre */}
      <div style={{
        position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
        background: me.heldItem ? 'rgba(255,220,50,0.18)' : 'rgba(0,0,0,0.55)',
        border: me.heldItem ? '2px solid rgba(255,220,50,0.7)' : '2px solid rgba(255,255,255,0.15)',
        borderRadius: 18, padding: '8px 22px', fontSize: 44, minWidth: 80, textAlign: 'center',
        boxShadow: me.heldItem ? '0 0 16px rgba(255,220,50,0.4)' : 'none',
        transition: 'all 0.15s',
      }}>
        {me.heldItem ? ITEM_EMOJI[me.heldItem] : '·'}
      </div>

      {/* Boost indicator */}
      {isBoosting && (
        <div style={{
          position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          color: '#ff8844', fontSize: 18, fontWeight: 'bold',
          textShadow: '0 0 10px #ff4400',
        }}>BOOST!</div>
      )}

      {/* Countdown */}
      {state.phase === 'countdown' && state.countdown > 0 && (
        <div style={{
          position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%,-50%)',
          fontSize: 120, fontWeight: 'bold', color: '#FFE44D',
          textShadow: '0 0 30px #ff8800, 4px 4px 0 #000',
        }}>{state.countdown}</div>
      )}
      {state.phase === 'racing' && state.tick < 80 && (
        <div style={{
          position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%,-50%)',
          fontSize: 80, fontWeight: 'bold', color: '#44FF88',
          textShadow: '0 0 20px #00ff44, 3px 3px 0 #000',
        }}>GO!</div>
      )}

      {/* Instructions */}
      <div style={{
        position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.4)', fontSize: 11,
      }}>WASD / Arrow keys · SPACE = use item</div>
    </div>
  );
}
