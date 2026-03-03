// packages/server/src/GameLoop.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameLoop } from './GameLoop';

describe('GameLoop', () => {
  it('starts in waiting phase', () => {
    const loop = new GameLoop(['p1', 'p2']);
    expect(loop.state.phase).toBe('waiting');
  });

  it('transitions to countdown on startCountdown()', () => {
    const loop = new GameLoop(['p1', 'p2']);
    loop.startCountdown();
    expect(loop.state.phase).toBe('countdown');
  });

  it('starts racing after countdown completes', () => {
    const loop = new GameLoop(['p1', 'p2']);
    loop.startCountdown();
    // Fast-forward past countdown
    for (let i = 0; i < 200; i++) loop.tick(); // 200 ticks = ~3.3 seconds at 60Hz
    expect(loop.state.phase).toBe('racing');
  });

  it('processes player input each tick', () => {
    const loop = new GameLoop(['p1', 'p2']);
    loop.startCountdown();
    for (let i = 0; i < 200; i++) loop.tick();
    loop.applyInput('p1', { steer: 0, throttle: 1, brake: 0, seq: 1, timestamp: Date.now() });
    loop.tick();
    const player = loop.state.players['p1'];
    expect(player.speed).toBeGreaterThan(0);
  });

  it('increments tick counter each call', () => {
    const loop = new GameLoop(['p1']);
    loop.tick();
    loop.tick();
    expect(loop.state.tick).toBe(2);
  });
});
