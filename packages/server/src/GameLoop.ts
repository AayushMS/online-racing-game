// packages/server/src/GameLoop.ts
import * as CANNON from 'cannon-es';
import { GameState, PlayerState, TOTAL_LAPS, TICK_MS, COUNTDOWN_SECONDS } from '@racing/shared';
import { createPhysicsWorld } from './physics/PhysicsWorld';
import { CarBody, PlayerInput } from './physics/CarBody';

const START_POSITIONS: CANNON.Vec3[] = [
  new CANNON.Vec3(0, 1, 10),
  new CANNON.Vec3(3, 1, 10),
  new CANNON.Vec3(-3, 1, 10),
  new CANNON.Vec3(6, 1, 13),
  new CANNON.Vec3(-6, 1, 13),
  new CANNON.Vec3(0, 1, 16),
  new CANNON.Vec3(3, 1, 16),
  new CANNON.Vec3(-3, 1, 16),
];

export class GameLoop {
  state: GameState;
  private world: CANNON.World;
  private carBodies: Map<string, CarBody> = new Map();
  private pendingInputs: Map<string, PlayerInput> = new Map();
  private countdownTicks = 0;
  private readonly dt = TICK_MS / 1000;

  constructor(playerIds: string[]) {
    this.world = createPhysicsWorld();

    const players: Record<string, PlayerState> = {};
    playerIds.forEach((id, i) => {
      const startPos = START_POSITIONS[i] ?? START_POSITIONS[0];
      const car = new CarBody(this.world, startPos);
      this.carBodies.set(id, car);
      players[id] = {
        id,
        nickname: 'Player',
        carIndex: i % 5,
        position: { x: startPos.x, y: startPos.y, z: startPos.z },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        speed: 0,
        heldItem: null,
        activeBuff: undefined,
        lap: 1,
        lapProgress: 0,
        finished: false,
        finishTime: null,
      };
    });

    this.state = {
      phase: 'waiting',
      tick: 0,
      countdown: COUNTDOWN_SECONDS,
      players,
      itemBoxes: [],
      activeEffects: [],
    };
  }

  startCountdown(): void {
    this.state.phase = 'countdown';
    this.countdownTicks = 0;
  }

  applyInput(playerId: string, input: PlayerInput): void {
    this.pendingInputs.set(playerId, input);
  }

  tick(): void {
    this.state.tick++;

    if (this.state.phase === 'countdown') {
      this.countdownTicks++;
      const elapsed = this.countdownTicks * this.dt;
      this.state.countdown = Math.max(0, COUNTDOWN_SECONDS - Math.floor(elapsed));
      if (elapsed >= COUNTDOWN_SECONDS) this.state.phase = 'racing';
      return;
    }

    if (this.state.phase !== 'racing') return;

    // Apply inputs
    for (const [id, car] of this.carBodies) {
      const input = this.pendingInputs.get(id);
      if (input) car.applyInput(input, this.dt);
    }

    // Step physics
    this.world.step(this.dt);

    // Sync state
    for (const [id, car] of this.carBodies) {
      const p = car.body.position;
      const q = car.body.quaternion;
      this.state.players[id].position = { x: p.x, y: p.y, z: p.z };
      this.state.players[id].rotation = { x: q.x, y: q.y, z: q.z, w: q.w };
      this.state.players[id].speed = car.getSpeed();
    }
  }
}
