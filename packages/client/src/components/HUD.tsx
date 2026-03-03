// packages/client/src/components/HUD.tsx
import React from 'react';
import { GameState, ItemType, TOTAL_LAPS } from '@racing/shared';

interface HUDProps {
  state: GameState;
  myId: string;
}

const ITEM_EMOJI: Record<ItemType, string> = {
  missile: '🚀',
  banana: '🍌',
  boost: '⚡',
  shield: '🛡',
  oil: '🛢',
};

function getPosition(state: GameState, myId: string): number {
  const sorted = Object.values(state.players).sort(
    (a, b) => (b.lap + b.lapProgress) - (a.lap + a.lapProgress)
  );
  return sorted.findIndex(p => p.id === myId) + 1;
}

export function HUD({ state, myId }: HUDProps) {
  const me = state.players[myId];
  if (!me) return null;

  const pos = getPosition(state, myId);
  const totalPlayers = Object.keys(state.players).length;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', fontFamily: 'monospace',
    }}>
      <div style={{
        position: 'absolute', top: 20, left: 20,
        background: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: '8px 18px',
        fontSize: 36, fontWeight: 'bold', color: '#fff', letterSpacing: 2,
      }}>
        {pos}<span style={{ fontSize: 18 }}>/{totalPlayers}</span>
      </div>

      <div style={{
        position: 'absolute', top: 20, right: 20,
        background: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: '8px 18px',
        fontSize: 22, fontWeight: 'bold', color: '#fff',
      }}>
        LAP {Math.min(me.lap, TOTAL_LAPS)}/{TOTAL_LAPS}
      </div>

      <div style={{
        position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.65)', borderRadius: 16, padding: '10px 24px',
        fontSize: 48, minWidth: 80, textAlign: 'center',
      }}>
        {me.heldItem ? ITEM_EMOJI[me.heldItem] : '·'}
      </div>

      <div style={{
        position: 'absolute', bottom: 40, right: 20,
        background: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: '8px 18px',
        fontSize: 20, color: '#7fffb0',
      }}>
        {Math.round(me.speed * 3.6)} km/h
      </div>

      {state.phase === 'countdown' && state.countdown > 0 && (
        <div style={{
          position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%,-50%)',
          fontSize: 120, fontWeight: 'bold', color: '#FFE44D',
          textShadow: '0 0 30px #ff8800, 4px 4px 0 #000',
        }}>
          {state.countdown}
        </div>
      )}
      {state.phase === 'racing' && state.countdown === 0 && state.tick < 80 && (
        <div style={{
          position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%,-50%)',
          fontSize: 80, fontWeight: 'bold', color: '#44FF88',
          textShadow: '0 0 20px #00ff44, 3px 3px 0 #000',
        }}>
          GO!
        </div>
      )}

      <div style={{
        position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.45)', fontSize: 12,
      }}>
        WASD / Arrow keys · SPACE = use item
      </div>
    </div>
  );
}
