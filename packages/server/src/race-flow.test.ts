// packages/server/src/race-flow.test.ts
import { describe, it, expect } from 'vitest';
import { GameLoop } from './GameLoop';
import { PowerUpManager } from './PowerUpManager';
import { CHECKPOINT_POSITIONS, ITEM_BOX_WORLD_POSITIONS, TOTAL_LAPS } from '@racing/shared';

function advanceToRacing(loop: GameLoop): void {
  loop.startCountdown();
  for (let i = 0; i < 200; i++) loop.tick();
}

function completeLap(loop: GameLoop, id: string): void {
  for (let i = 1; i <= 7; i++) {
    const cp = CHECKPOINT_POSITIONS[i];
    loop.state.players[id].position = { ...loop.state.players[id].position, x: cp.x, z: cp.z };
    const car = (loop as any).carBodies.get(id);
    if (car) { car.body.position.x = cp.x; car.body.position.z = cp.z; }
    for (let t = 0; t < 5; t++) loop.tick();
  }
  const cp0 = CHECKPOINT_POSITIONS[0];
  loop.state.players[id].position = { ...loop.state.players[id].position, x: cp0.x, z: cp0.z };
  const car = (loop as any).carBodies.get(id);
  if (car) { car.body.position.x = cp0.x; car.body.position.z = cp0.z; }
  for (let t = 0; t < 5; t++) loop.tick();
}

describe('Race Flow Integration', () => {
  it('full lifecycle: waiting → countdown → racing → 3 laps → finished', () => {
    const loop = new GameLoop(['p1', 'p2'], { p1: 'Alice', p2: 'Bob' });

    expect(loop.state.phase).toBe('waiting');
    advanceToRacing(loop);
    expect(loop.state.phase).toBe('racing');

    for (let lap = 0; lap < TOTAL_LAPS; lap++) completeLap(loop, 'p1');
    expect(loop.state.players['p1'].finished).toBe(true);

    for (let lap = 0; lap < TOTAL_LAPS; lap++) completeLap(loop, 'p2');
    loop.tick();

    expect(loop.state.phase).toBe('finished');
  });

  it('first finisher is position 1 in raceResults', () => {
    const loop = new GameLoop(['p1', 'p2'], { p1: 'Alice', p2: 'Bob' });
    advanceToRacing(loop);

    for (let lap = 0; lap < TOTAL_LAPS; lap++) completeLap(loop, 'p1');
    for (let lap = 0; lap < TOTAL_LAPS; lap++) completeLap(loop, 'p2');
    loop.tick();

    const results = loop.state.raceResults!;
    expect(results[0].nickname).toBe('Alice');
    expect(results[0].position).toBe(1);
    expect(results[1].nickname).toBe('Bob');
    expect(results[1].position).toBe(2);
  });

  it('raceResults includes bestLapMs > 0 for each finisher', () => {
    const loop = new GameLoop(['p1'], { p1: 'Solo' });
    advanceToRacing(loop);

    for (let lap = 0; lap < TOTAL_LAPS; lap++) completeLap(loop, 'p1');
    loop.tick();

    expect(loop.state.raceResults).toBeDefined();
    expect(loop.state.raceResults!.length).toBe(1);
    expect(loop.state.raceResults![0].bestLapMs).not.toBeNull();
    expect(loop.state.raceResults![0].bestLapMs!).toBeGreaterThan(0);
  });

  it('phase transitions through countdown → racing with correct tick timing', () => {
    const loop = new GameLoop(['p1']);
    loop.startCountdown();
    expect(loop.state.phase).toBe('countdown');
    expect(loop.state.countdown).toBe(3);

    for (let i = 0; i < 60; i++) loop.tick();
    expect(loop.state.countdown).toBeLessThan(3);

    for (let i = 0; i < 140; i++) loop.tick();
    expect(loop.state.phase).toBe('racing');
  });
});
