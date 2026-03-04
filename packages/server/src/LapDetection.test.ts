// packages/server/src/LapDetection.test.ts
import { describe, it, expect } from 'vitest';
import { GameLoop } from './GameLoop';
import { CHECKPOINT_POSITIONS, TOTAL_LAPS } from '@racing/shared';

function advanceToRacing(loop: GameLoop): void {
  loop.startCountdown();
  for (let i = 0; i < 200; i++) loop.tick();
}

function teleportPlayer(loop: GameLoop, id: string, x: number, z: number): void {
  // Teleport both the physics body and the state
  const car = (loop as any).carBodies.get(id);
  if (car) {
    car.body.position.x = x;
    car.body.position.z = z;
    car.body.velocity.set(0, 0, 0);
  }
  loop.state.players[id].position = { ...loop.state.players[id].position, x, z };
}

describe('Lap Detection', () => {
  it('starts with checkpointIdx=0 and lap=1', () => {
    const loop = new GameLoop(['p1']);
    expect(loop.state.players['p1'].checkpointIdx).toBe(0);
    expect(loop.state.players['p1'].lap).toBe(1);
  });

  it('does not increment lap before crossing all checkpoints', () => {
    const loop = new GameLoop(['p1']);
    advanceToRacing(loop);
    // Cross CP1 only
    const cp1 = CHECKPOINT_POSITIONS[1];
    teleportPlayer(loop, 'p1', cp1.x, cp1.z);
    for (let t = 0; t < 5; t++) loop.tick();
    expect(loop.state.players['p1'].checkpointIdx).toBe(1);
    expect(loop.state.players['p1'].lap).toBe(1);
  });

  it('increments lap when all 8 checkpoints crossed in order', () => {
    const loop = new GameLoop(['p1']);
    advanceToRacing(loop);

    for (let i = 1; i <= 7; i++) {
      const cp = CHECKPOINT_POSITIONS[i];
      teleportPlayer(loop, 'p1', cp.x, cp.z);
      for (let t = 0; t < 5; t++) loop.tick();
      expect(loop.state.players['p1'].checkpointIdx).toBe(i);
    }
    // Cross CP0 (start/finish) to complete lap
    const cp0 = CHECKPOINT_POSITIONS[0];
    teleportPlayer(loop, 'p1', cp0.x, cp0.z);
    for (let t = 0; t < 5; t++) loop.tick();

    expect(loop.state.players['p1'].lap).toBe(2);
  });

  it('marks player finished after TOTAL_LAPS laps', () => {
    const loop = new GameLoop(['p1']);
    advanceToRacing(loop);

    for (let lap = 0; lap < TOTAL_LAPS; lap++) {
      for (let i = 1; i <= 7; i++) {
        const cp = CHECKPOINT_POSITIONS[i];
        teleportPlayer(loop, 'p1', cp.x, cp.z);
        for (let t = 0; t < 5; t++) loop.tick();
      }
      const cp0 = CHECKPOINT_POSITIONS[0];
      teleportPlayer(loop, 'p1', cp0.x, cp0.z);
      for (let t = 0; t < 5; t++) loop.tick();
    }

    expect(loop.state.players['p1'].finished).toBe(true);
    expect(loop.state.players['p1'].finishTime).not.toBeNull();
    expect(loop.state.players['p1'].finishTime).toBeGreaterThan(0);
  });

  it('records bestLapMs on lap completion', () => {
    const loop = new GameLoop(['p1']);
    advanceToRacing(loop);

    for (let i = 1; i <= 7; i++) {
      const cp = CHECKPOINT_POSITIONS[i];
      teleportPlayer(loop, 'p1', cp.x, cp.z);
      for (let t = 0; t < 5; t++) loop.tick();
    }
    teleportPlayer(loop, 'p1', CHECKPOINT_POSITIONS[0].x, CHECKPOINT_POSITIONS[0].z);
    for (let t = 0; t < 5; t++) loop.tick();

    expect(loop.state.players['p1'].bestLapMs).not.toBeNull();
    expect(loop.state.players['p1'].bestLapMs).toBeGreaterThan(0);
  });

  it('transitions to finished phase when all players complete race', () => {
    const loop = new GameLoop(['p1']);
    advanceToRacing(loop);

    for (let lap = 0; lap < TOTAL_LAPS; lap++) {
      for (let i = 1; i <= 7; i++) {
        const cp = CHECKPOINT_POSITIONS[i];
        teleportPlayer(loop, 'p1', cp.x, cp.z);
        for (let t = 0; t < 5; t++) loop.tick();
      }
      teleportPlayer(loop, 'p1', CHECKPOINT_POSITIONS[0].x, CHECKPOINT_POSITIONS[0].z);
      for (let t = 0; t < 5; t++) loop.tick();
    }

    loop.tick(); // trigger checkRaceFinish
    expect(loop.state.phase).toBe('finished');
    expect(loop.state.raceResults).toBeDefined();
    expect(loop.state.raceResults!.length).toBe(1);
    expect(loop.state.raceResults![0].position).toBe(1);
  });
});
