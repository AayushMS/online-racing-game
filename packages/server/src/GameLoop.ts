// packages/server/src/GameLoop.ts
import * as CANNON from 'cannon-es';
import {
  GameState, PlayerState, TOTAL_LAPS, TICK_MS, COUNTDOWN_SECONDS,
  CHECKPOINT_COUNT, CHECKPOINT_CROSS_RADIUS, RACE_FINISH_TIMEOUT_MS,
  projectOnCurve, CHECKPOINT_POSITIONS,
  BOOST_DURATION_MS, SHIELD_DURATION_MS, BANANA_SLOW_MS, OIL_SLOW_MS,
  MISSILE_HIT_RADIUS, BANANA_HIT_RADIUS, OIL_EFFECT_RADIUS,
} from '@racing/shared';
import { createPhysicsWorld } from './physics/PhysicsWorld';
import { CarBody, PlayerInput } from './physics/CarBody';
import { PowerUpManager } from './PowerUpManager';

const START_POSITIONS: Array<{ pos: CANNON.Vec3; quat: CANNON.Quaternion }> = [
  { pos: new CANNON.Vec3(-3, 1, 58), quat: new CANNON.Quaternion(0, 0.616, 0, 0.788) },
  { pos: new CANNON.Vec3( 3, 1, 58), quat: new CANNON.Quaternion(0, 0.616, 0, 0.788) },
  { pos: new CANNON.Vec3(-3, 1, 62), quat: new CANNON.Quaternion(0, 0.616, 0, 0.788) },
  { pos: new CANNON.Vec3( 3, 1, 62), quat: new CANNON.Quaternion(0, 0.616, 0, 0.788) },
  { pos: new CANNON.Vec3(-3, 1, 66), quat: new CANNON.Quaternion(0, 0.616, 0, 0.788) },
  { pos: new CANNON.Vec3( 3, 1, 66), quat: new CANNON.Quaternion(0, 0.616, 0, 0.788) },
  { pos: new CANNON.Vec3(-3, 1, 70), quat: new CANNON.Quaternion(0, 0.616, 0, 0.788) },
  { pos: new CANNON.Vec3( 3, 1, 70), quat: new CANNON.Quaternion(0, 0.616, 0, 0.788) },
];

export class GameLoop {
  state: GameState;
  private world: CANNON.World;
  private carBodies: Map<string, CarBody> = new Map();
  private pendingInputs: Map<string, PlayerInput> = new Map();
  private countdownTicks = 0;
  private readonly dt = TICK_MS / 1000;
  private raceStartTick = 0;
  private firstFinishTick: number | null = null;
  private lapStartTicks: Map<string, number> = new Map();

  constructor(playerIds: string[], nicknames: Record<string, string> = {}) {
    this.world = createPhysicsWorld();

    const players: Record<string, PlayerState> = {};
    playerIds.forEach((id, i) => {
      const sp = START_POSITIONS[i] ?? START_POSITIONS[0];
      const car = new CarBody(this.world, sp.pos, sp.quat);
      this.carBodies.set(id, car);
      players[id] = {
        id,
        nickname: nicknames[id] ?? 'Player',
        carIndex: i % 5,
        position: { x: sp.pos.x, y: sp.pos.y, z: sp.pos.z },
        rotation: { x: sp.quat.x, y: sp.quat.y, z: sp.quat.z, w: sp.quat.w },
        speed: 0,
        heldItem: null,
        activeBuff: undefined,
        lap: 1,
        lapProgress: 0,
        finished: false,
        finishTime: null,
        bestLapMs: null,
        checkpointIdx: 0,
        spinUntilTick: undefined,
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
      if (elapsed >= COUNTDOWN_SECONDS) {
        this.state.phase = 'racing';
        this.raceStartTick = this.state.tick;
        for (const id of this.carBodies.keys()) {
          this.lapStartTicks.set(id, this.state.tick);
        }
      }
      return;
    }

    if (this.state.phase !== 'racing') return;

    // Apply inputs
    for (const [id, car] of this.carBodies) {
      const input = this.pendingInputs.get(id);
      const player = this.state.players[id];
      if (!player || player.finished) continue;

      const boosted = player.activeBuff?.type === 'boost' &&
                      player.activeBuff.expiresAtTick > this.state.tick;

      if (input) car.applyInput(input, this.dt, boosted ? 1.4 : 1.0);
    }
    this.pendingInputs.clear();

    // Step physics
    this.world.step(this.dt);

    // Sync state + run game logic
    for (const [id, car] of this.carBodies) {
      const player = this.state.players[id];
      if (!player || player.finished) continue;

      const p = car.body.position;
      const q = car.body.quaternion;
      player.position = { x: p.x, y: p.y, z: p.z };
      player.rotation = { x: q.x, y: q.y, z: q.z, w: q.w };

      // Apply spin slow from banana/oil
      if (player.spinUntilTick && player.spinUntilTick > this.state.tick) {
        player.speed = car.getSpeed() * 0.3;
      } else {
        player.speed = car.getSpeed();
        if (player.spinUntilTick && player.spinUntilTick <= this.state.tick) {
          player.spinUntilTick = undefined;
        }
      }

      // Expire buffs
      if (player.activeBuff && player.activeBuff.expiresAtTick <= this.state.tick) {
        player.activeBuff = undefined;
      }

      // Lap progress
      player.lapProgress = projectOnCurve(player.position.x, player.position.z);

      // Checkpoint detection
      const nextCpIdx = (player.checkpointIdx + 1) % CHECKPOINT_COUNT;
      const cp = CHECKPOINT_POSITIONS[nextCpIdx];
      const dx = player.position.x - cp.x;
      const dz = player.position.z - cp.z;
      if (Math.sqrt(dx * dx + dz * dz) < CHECKPOINT_CROSS_RADIUS) {
        player.checkpointIdx = nextCpIdx;

        if (nextCpIdx === 0) {
          // Crossed start/finish — complete a lap
          const lapTicks = this.state.tick - (this.lapStartTicks.get(id) ?? this.raceStartTick);
          const lapMs = lapTicks * TICK_MS;
          if (player.bestLapMs === null || lapMs < player.bestLapMs) {
            player.bestLapMs = lapMs;
          }
          this.lapStartTicks.set(id, this.state.tick);

          if (player.lap >= TOTAL_LAPS) {
            player.finished = true;
            player.finishTime = (this.state.tick - this.raceStartTick) * TICK_MS;
            if (this.firstFinishTick === null) this.firstFinishTick = this.state.tick;
          } else {
            player.lap++;
          }
        }
      }
    }

    // Check race finish condition
    this.checkRaceFinish();
  }

  private checkRaceFinish(): void {
    const players = Object.values(this.state.players);
    const allFinished = players.every(p => p.finished);
    const timeoutExpired = this.firstFinishTick !== null &&
      (this.state.tick - this.firstFinishTick) * TICK_MS > RACE_FINISH_TIMEOUT_MS;

    if (allFinished || timeoutExpired) {
      this.state.phase = 'finished';

      const sorted = [...players].sort((a, b) => {
        if (a.finished && b.finished) return (a.finishTime ?? 0) - (b.finishTime ?? 0);
        if (a.finished) return -1;
        if (b.finished) return 1;
        return (b.lap + b.lapProgress) - (a.lap + a.lapProgress);
      });

      this.state.raceResults = sorted.map((p, i) => ({
        playerId: p.id,
        nickname: p.nickname,
        position: i + 1,
        finishTime: p.finishTime,
        bestLapMs: p.bestLapMs,
      }));
    }
  }

  tickPowerUps(powerUps: PowerUpManager): void {
    if (this.state.phase !== 'racing') return;

    for (const [id, player] of Object.entries(this.state.players)) {
      if (player.finished || player.heldItem) continue;

      // Item box proximity collection (within 3.5 units)
      const boxes = powerUps.getBoxStates();
      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        if (!box.active) continue;
        const dx = player.position.x - box.position.x;
        const dz = player.position.z - box.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < 3.5) {
          const result = powerUps.collectBox(id, i);
          if (result) {
            // Boost and shield: apply instantly, don't hold
            if (result.item === 'boost') {
              player.activeBuff = {
                type: 'boost',
                expiresAtTick: this.state.tick + Math.round(BOOST_DURATION_MS / TICK_MS),
              };
            } else if (result.item === 'shield') {
              player.activeBuff = {
                type: 'shield',
                expiresAtTick: this.state.tick + Math.round(SHIELD_DURATION_MS / TICK_MS),
              };
            } else {
              player.heldItem = result.item;
            }
          }
        }
      }
    }

    // Missile hit detection + banana/oil zone checks (for ALL players including item holders)
    const effects = powerUps.getActiveEffects();
    for (const [id, player] of Object.entries(this.state.players)) {
      if (player.finished) continue;

      for (const effect of effects) {
        if (effect.ownerId === id) continue; // can't hit yourself

        if (effect.type === 'missile') {
          const dx = player.position.x - effect.position.x;
          const dy = player.position.y - effect.position.y;
          const dz = player.position.z - effect.position.z;
          if (Math.sqrt(dx * dx + dy * dy + dz * dz) < MISSILE_HIT_RADIUS) {
            if (player.activeBuff?.type === 'shield') {
              player.activeBuff = undefined; // shield absorbs
            } else {
              const car = this.carBodies.get(id);
              if (car && effect.velocity) {
                const impulse = new CANNON.Vec3(
                  effect.velocity.x * 8,
                  3,
                  effect.velocity.z * 8,
                );
                car.body.applyImpulse(impulse, car.body.position);
                player.spinUntilTick = this.state.tick + Math.round(BANANA_SLOW_MS / TICK_MS);
              }
            }
            powerUps.removeEffect(effect.id);
            break; // missile can only hit one target
          }
        } else if (effect.type === 'banana' || effect.type === 'oil') {
          const radius = effect.type === 'banana' ? BANANA_HIT_RADIUS : OIL_EFFECT_RADIUS;
          const dx = player.position.x - effect.position.x;
          const dz = player.position.z - effect.position.z;
          if (Math.sqrt(dx * dx + dz * dz) < radius) {
            if (player.activeBuff?.type === 'shield') {
              player.activeBuff = undefined;
            } else if (!player.spinUntilTick || player.spinUntilTick <= this.state.tick) {
              const slowMs = effect.type === 'banana' ? BANANA_SLOW_MS : OIL_SLOW_MS;
              player.spinUntilTick = this.state.tick + Math.round(slowMs / TICK_MS);
              const car = this.carBodies.get(id);
              if (car) {
                const spinDir = Math.random() > 0.5 ? 1 : -1;
                car.body.angularVelocity.y = spinDir * 6;
              }
              if (effect.type === 'banana') powerUps.removeEffect(effect.id);
            }
          }
        }
      }
    }
  }
}
