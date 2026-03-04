// packages/client/src/components/MiniMap.tsx
import React, { useRef, useEffect } from 'react';
import { GameState, CURVE_SAMPLES } from '@racing/shared';

interface Props {
  state: GameState;
  myId: string;
}

const SIZE = 130;
const PAD = 14;
const KART_COLORS = ['#ff4444', '#4488ff', '#44cc44', '#ff8833', '#cc44ff'];

// Pre-compute track bounds for normalisation
const xs = CURVE_SAMPLES.map(s => s.x);
const zs = CURVE_SAMPLES.map(s => s.z);
const minX = Math.min(...xs), maxX = Math.max(...xs);
const minZ = Math.min(...zs), maxZ = Math.max(...zs);

function toCanvas(worldX: number, worldZ: number): [number, number] {
  const cx = PAD + ((worldX - minX) / (maxX - minX)) * (SIZE - PAD * 2);
  const cy = PAD + ((worldZ - minZ) / (maxZ - minZ)) * (SIZE - PAD * 2);
  return [cx, cy];
}

export function MiniMap({ state, myId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, SIZE, SIZE);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(0, 0, SIZE, SIZE, 10);
    ctx.fill();

    // Track line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const first = toCanvas(CURVE_SAMPLES[0].x, CURVE_SAMPLES[0].z);
    ctx.moveTo(first[0], first[1]);
    for (const s of CURVE_SAMPLES) {
      const [cx2, cy2] = toCanvas(s.x, s.z);
      ctx.lineTo(cx2, cy2);
    }
    ctx.closePath();
    ctx.stroke();

    // Player dots
    const players = Object.values(state.players);
    for (const p of players) {
      const [cx2, cy2] = toCanvas(p.position.x, p.position.z);
      const isMe = p.id === myId;
      const color = isMe ? '#ffffff' : KART_COLORS[p.carIndex % KART_COLORS.length];
      const radius = isMe ? 5 : 3.5;

      ctx.beginPath();
      ctx.arc(cx2, cy2, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (isMe) {
        // Direction arrow
        const angle = 2 * Math.atan2(p.rotation.y, p.rotation.w);
        const ax = Math.sin(angle) * 8, az = -Math.cos(angle) * 8;
        ctx.beginPath();
        ctx.moveTo(cx2, cy2);
        ctx.lineTo(cx2 + ax * ((SIZE - PAD * 2) / (maxX - minX)),
                   cy2 + az * ((SIZE - PAD * 2) / (maxZ - minZ)));
        ctx.strokeStyle = '#ffee44';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  });  // run every render (state changes)

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.15)',
      }}
    />
  );
}
