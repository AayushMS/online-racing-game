# Game Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the partially-broken racing game into a fully playable, polished multiplayer kart racer with working laps, powerups, smooth camera, audio, and rich HUD.

**Architecture:** Server-authoritative 60Hz loop gains lap detection (checkpoint-based), proximity powerup collection, and full effect application (boost/shield/missile/banana/oil). Client gains spring-damper camera, interpolated kart movement, CSS2D name tags, skid marks, Web Audio synthesised sounds, and a completely rebuilt HUD with minimap and lap timers.

**Tech Stack:** Three.js, Cannon-es, Socket.io, Vitest, Web Audio API, CSS2DRenderer (three/examples/jsm)

---

### Task 1: Add TrackUtils to shared package

**Files:**
- Create: `packages/shared/src/TrackUtils.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Create TrackUtils.ts**

```typescript
// packages/shared/src/TrackUtils.ts

// Raw track control points [x, z] — must match Track.ts TRACK_POINTS in client
export const TRACK_CONTROL_POINTS: Array<[number, number]> = [
  [0, 60], [40, 50], [70, 20], [70, -30], [40, -60],
  [0, -75], [-40, -60], [-70, -30], [-70, 20], [-40, 50],
];

const N = TRACK_CONTROL_POINTS.length; // 10 unique points (closed loop)

function catmullRom1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/** Evaluate the closed Catmull-Rom curve at t in [0, 1) */
export function evalTrackCurve(t: number): [number, number] {
  const segment = ((t % 1) + 1) % 1 * N;
  const i = Math.floor(segment);
  const localT = segment - i;
  const p0 = TRACK_CONTROL_POINTS[(i - 1 + N) % N];
  const p1 = TRACK_CONTROL_POINTS[i % N];
  const p2 = TRACK_CONTROL_POINTS[(i + 1) % N];
  const p3 = TRACK_CONTROL_POINTS[(i + 2) % N];
  return [
    catmullRom1D(p0[0], p1[0], p2[0], p3[0], localT),
    catmullRom1D(p0[1], p1[1], p2[1], p3[1], localT),
  ];
}

/** 500 pre-sampled points for fast nearest-neighbour projection */
export interface CurveSample { x: number; z: number; t: number; }
export const CURVE_SAMPLES: CurveSample[] = Array.from({ length: 500 }, (_, i) => {
  const t = i / 500;
  const [x, z] = evalTrackCurve(t);
  return { x, z, t };
});

/** Project world XZ onto curve, returning t in [0, 1) */
export function projectOnCurve(x: number, z: number): number {
  let best = 0, bestDist = Infinity;
  for (const s of CURVE_SAMPLES) {
    const d = (s.x - x) ** 2 + (s.z - z) ** 2;
    if (d < bestDist) { bestDist = d; best = s.t; }
  }
  return best;
}

/** 8 equidistant checkpoints. CP 0 = start/finish line near (0, 60) */
export const CHECKPOINT_T_VALUES: number[] = Array.from({ length: 8 }, (_, i) => i / 8);

/** World XZ positions of each checkpoint */
export const CHECKPOINT_POSITIONS: Array<{ x: number; z: number }> = CHECKPOINT_T_VALUES.map(t => {
  const [x, z] = evalTrackCurve(t);
  return { x, z };
});

/** 6 item box t-values spread around track */
export const ITEM_BOX_T_VALUES = [0.08, 0.25, 0.42, 0.58, 0.75, 0.92];

/** World positions for item boxes (y=0.8 for visual height) */
export const ITEM_BOX_WORLD_POSITIONS: Array<{ x: number; y: number; z: number }> =
  ITEM_BOX_T_VALUES.map(t => {
    const [x, z] = evalTrackCurve(t);
    return { x, y: 0.8, z };
  });
```

**Step 2: Export from shared index**

In `packages/shared/src/index.ts`, add at the bottom:
```typescript
export * from './TrackUtils';
```

**Step 3: Rebuild shared**
```bash
cd /home/aayushms/work/pet_projects/online_racing_game
npm run build -w packages/shared
```
Expected: exits 0, `packages/shared/dist/` updated.

**Step 4: Commit**
```bash
git add packages/shared/src/TrackUtils.ts packages/shared/src/index.ts packages/shared/dist/
git commit -m "feat(shared): add TrackUtils — CatmullRom eval, curve projection, checkpoint positions"
```

---

### Task 2: Update shared types and constants

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

**Step 1: Update constants.ts** — add powerup physics values:

Replace the entire file content:
```typescript
// packages/shared/src/constants.ts

export const MAX_PLAYERS = 8;
export const MIN_PLAYERS_TO_START = 2;
export const TOTAL_LAPS = 3;
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

export const ITEM_BOX_RESPAWN_MS = 8000;
export const BOOST_DURATION_MS = 3000;
export const BOOST_MULTIPLIER = 1.4;
export const SHIELD_DURATION_MS = 5000;
export const BANANA_SLOW_MS = 1200;
export const OIL_SLOW_MS = 1800;
export const BANANA_SLOW_FACTOR = 0.3;
export const OIL_SLOW_FACTOR = 0.4;

export const COUNTDOWN_SECONDS = 3;

export const GRAVITY = -20;

export const CAR_MAX_SPEED = 30;
export const CAR_ACCELERATION = 15;
export const CAR_BRAKE_DECEL = 25;
export const CAR_TURN_SPEED = 2.2;
export const WALL_BOUNCE = 0.3;

// Powerup physics
export const MISSILE_SPEED = 55;          // m/s forward travel
export const MISSILE_HIT_RADIUS = 3.5;    // world units
export const MISSILE_MAX_TICKS = 240;     // ~4 s lifetime
export const BANANA_HIT_RADIUS = 3.0;
export const OIL_EFFECT_RADIUS = 4.0;
export const OIL_MAX_TICKS = 300;         // 5 s on track

// Lap/checkpoint
export const CHECKPOINT_COUNT = 8;
export const CHECKPOINT_CROSS_RADIUS = 11; // world units

// Race finish timeout after first player finishes (ms)
export const RACE_FINISH_TIMEOUT_MS = 30000;
```

**Step 2: Update types.ts** — add new fields to PlayerState, ActiveEffect; add RaceResult:

Replace entire file:
```typescript
// packages/shared/src/types.ts

export interface Vec3 { x: number; y: number; z: number; }
export interface Quat { x: number; y: number; z: number; w: number; }

export type ItemType = 'missile' | 'banana' | 'boost' | 'shield' | 'oil';

export interface PlayerState {
  id: string;
  nickname: string;
  carIndex: number;
  position: Vec3;
  rotation: Quat;
  speed: number;
  heldItem: ItemType | null;
  lap: number;
  lapProgress: number;
  finished: boolean;
  finishTime: number | null;    // ticks from race start
  bestLapMs: number | null;     // best lap in ms
  checkpointIdx: number;        // 0-7, last checkpoint crossed; starts at 0
  activeBuff?: { type: 'shield' | 'boost'; expiresAtTick: number };
  spinUntilTick?: number;       // banana/oil spin effect
}

export interface ItemBoxState {
  id: string;
  position: Vec3;
  active: boolean;
}

export interface ActiveEffect {
  id: string;
  type: ItemType;
  position: Vec3;
  rotation?: Quat;
  velocity?: Vec3;
  ownerId: string;
  spawnedAt: number;            // tick when spawned
  expiresAtTick?: number;       // for banana/oil zones with fixed lifetime
}

export interface RaceResult {
  playerId: string;
  nickname: string;
  position: number;             // 1-indexed finishing position
  finishTime: number | null;    // ms from race start
  bestLapMs: number | null;
}

export interface GameState {
  phase: 'waiting' | 'countdown' | 'racing' | 'finished';
  tick: number;
  countdown: number;
  players: Record<string, PlayerState>;
  itemBoxes: ItemBoxState[];
  activeEffects: ActiveEffect[];
  raceResults?: RaceResult[];   // populated when phase === 'finished'
}

export interface RoomInfo {
  code: string;
  name: string;
  isPrivate: boolean;
  playerCount: number;
  maxPlayers: number;
  phase: GameState['phase'];
}

export interface LapRecord {
  playerId: string;
  lap: number;
  time: number;
}

export interface PlayerInputPayload {
  seq: number;
  throttle: number;
  brake: number;
  steer: number;
  timestamp: number;
}

export interface JoinRoomPayload { code: string; nickname: string; }
export interface CreateRoomPayload { nickname: string; roomName: string; isPrivate: boolean; }
export interface MatchmakePayload { nickname: string; }

export interface ClientToServerEvents {
  join_room: (payload: JoinRoomPayload, cb: (res: { ok: boolean; error?: string }) => void) => void;
  create_room: (payload: CreateRoomPayload, cb: (res: { ok: boolean; code?: string; error?: string }) => void) => void;
  matchmake: (payload: MatchmakePayload, cb: (res: { ok: boolean; error?: string }) => void) => void;
  player_ready: () => void;
  start_race: () => void;
  player_input: (payload: PlayerInputPayload) => void;
  use_item: () => void;
  leave_room: () => void;
}

export interface ServerToClientEvents {
  room_state: (info: RoomInfo & { players: Record<string, { nickname: string; carIndex: number; ready: boolean; isHost: boolean }> }) => void;
  game_state: (state: GameState) => void;
  race_started: () => void;
  race_finished: (results: RaceResult[]) => void;
  error: (message: string) => void;
  player_joined: (player: { id: string; nickname: string; carIndex: number }) => void;
  player_left: (playerId: string) => void;
  countdown: (seconds: number) => void;
}
```

**Step 3: Rebuild shared**
```bash
npm run build -w packages/shared
```

**Step 4: Commit**
```bash
git add packages/shared/src/
git commit -m "feat(shared): add RaceResult, checkpoint/buff fields, powerup constants"
```

---

### Task 3: Fix start positions and item box positions in server

**Files:**
- Modify: `packages/server/src/GameLoop.ts` (START_POSITIONS only)
- Modify: `packages/server/src/index.ts` (ITEM_BOX_POSITIONS)

**Step 1: Fix START_POSITIONS in GameLoop.ts**

Replace the START_POSITIONS array at the top of GameLoop.ts.
Cars start near t=0 on the track (near world position (0,0,60)), facing along the track tangent (roughly +X, -Z → quaternion y≈0.616, w≈0.788):

```typescript
// Near start/finish at curve t=0 (≈ world (0,0,60)), staggered grid
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
```

In the constructor, apply both pos AND quat:
```typescript
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
    checkpointIdx: 0,   // start already "at" CP0 (start/finish)
    spinUntilTick: undefined,
  };
});
```

**Step 2: Update CarBody.ts constructor signature** to accept initial quaternion:

In `packages/server/src/physics/CarBody.ts`, update constructor:
```typescript
constructor(world: CANNON.World, startPos: CANNON.Vec3, startQuat?: CANNON.Quaternion) {
  const shape = new CANNON.Box(CAR_HALF_EXTENTS);
  this.body = new CANNON.Body({ mass: 150, linearDamping: 0.4, angularDamping: 0.99 });
  this.body.addShape(shape);
  this.body.position.copy(startPos);
  if (startQuat) this.body.quaternion.copy(startQuat);
  this.body.angularFactor.set(0, 1, 0);
  world.addBody(this.body);
}
```

**Step 3: Fix ITEM_BOX_POSITIONS in index.ts**

Replace the ITEM_BOX_POSITIONS constant:
```typescript
import { ITEM_BOX_WORLD_POSITIONS } from '@racing/shared';
// ...
const ITEM_BOX_POSITIONS = ITEM_BOX_WORLD_POSITIONS;
```

**Step 4: Rebuild server and verify it compiles**
```bash
npm run build -w packages/server
```
Expected: exits 0.

**Step 5: Commit**
```bash
git add packages/server/src/
git commit -m "fix(server): fix start positions on track, use shared item box positions"
```

---

### Task 4: Implement lap detection in GameLoop

**Files:**
- Modify: `packages/server/src/GameLoop.ts`

**Step 1: Update imports**

At top of GameLoop.ts, add to the imports from `@racing/shared`:
```typescript
import {
  GameState, PlayerState, TOTAL_LAPS, TICK_MS, COUNTDOWN_SECONDS,
  CHECKPOINT_COUNT, CHECKPOINT_CROSS_RADIUS, RACE_FINISH_TIMEOUT_MS,
  projectOnCurve, CHECKPOINT_POSITIONS,
} from '@racing/shared';
```

**Step 2: Add private fields for race timing**

Inside the GameLoop class, add:
```typescript
private raceStartTick = 0;
private firstFinishTick: number | null = null;
private lapStartTicks: Map<string, number> = new Map();
```

**Step 3: Replace the tick() method with the full implementation**

```typescript
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

    // Boost: temporarily raise max speed
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

    // Build race results sorted by finish time, then by lap+progress
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
```

**Step 4: Update CarBody.applyInput() to accept speed multiplier**

In `packages/server/src/physics/CarBody.ts`, update signature:
```typescript
applyInput(input: PlayerInput, dt: number, speedMultiplier = 1.0): void {
  const maxSpeed = CAR_MAX_SPEED * speedMultiplier;
  // ... rest of the method, replace CAR_MAX_SPEED with maxSpeed
```

**Step 5: Rebuild and verify**
```bash
npm run build -w packages/shared && npm run build -w packages/server
```

**Step 6: Commit**
```bash
git add packages/server/src/
git commit -m "feat(server): implement lap detection, checkpoint tracking, race finish logic"
```

---

### Task 5: Implement item box proximity collection and powerup effects

**Files:**
- Modify: `packages/server/src/GameLoop.ts`
- Modify: `packages/server/src/PowerUpManager.ts`
- Modify: `packages/server/src/index.ts`

**Step 1: Add item box proximity check to GameLoop.tick()**

Add a `tickPowerUps(powerUps: PowerUpManager): void` method to GameLoop:

```typescript
tickPowerUps(powerUps: PowerUpManager): void {
  if (this.state.phase !== 'racing') return;

  for (const [id, player] of Object.entries(this.state.players)) {
    if (player.finished || player.heldItem) continue;

    // Item box proximity collection
    const boxes = powerUps.getBoxStates();
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (!box.active) continue;
      const dx = player.position.x - box.position.x;
      const dz = player.position.z - box.position.z;
      if (Math.sqrt(dx * dx + dz * dz) < 3.5) {
        const result = powerUps.collectBox(id, i);
        if (result) {
          player.heldItem = result.item;
          // Apply instant effects
          if (result.item === 'boost') {
            player.heldItem = null;
            player.activeBuff = {
              type: 'boost',
              expiresAtTick: this.state.tick + Math.round(BOOST_DURATION_MS / TICK_MS),
            };
          } else if (result.item === 'shield') {
            player.heldItem = null;
            player.activeBuff = {
              type: 'shield',
              expiresAtTick: this.state.tick + Math.round(SHIELD_DURATION_MS / TICK_MS),
            };
          }
        }
      }
    }

    // Missile hit detection
    const effects = powerUps.getActiveEffects();
    for (const effect of effects) {
      if (effect.type !== 'missile' || effect.ownerId === id) continue;
      const dx = player.position.x - effect.position.x;
      const dy = player.position.y - effect.position.y;
      const dz = player.position.z - effect.position.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < MISSILE_HIT_RADIUS) {
        // Shield absorbs hit
        if (player.activeBuff?.type === 'shield') {
          player.activeBuff = undefined;
        } else {
          // Knockback: push car body in missile travel direction
          const car = this.carBodies.get(id);
          if (car && effect.velocity) {
            const impulse = new (require('cannon-es').Vec3)(
              effect.velocity.x * 8,
              3,
              effect.velocity.z * 8,
            );
            car.body.applyImpulse(impulse, car.body.position);
            player.spinUntilTick = this.state.tick + Math.round(BANANA_SLOW_MS / TICK_MS);
          }
        }
        powerUps.removeEffect(effect.id);
      }
    }

    // Banana / oil zone hit
    for (const effect of effects) {
      if (effect.type !== 'banana' && effect.type !== 'oil') continue;
      if (effect.ownerId === id) continue;
      const radius = effect.type === 'banana' ? BANANA_HIT_RADIUS : OIL_EFFECT_RADIUS;
      const dx = player.position.x - effect.position.x;
      const dz = player.position.z - effect.position.z;
      if (Math.sqrt(dx * dx + dz * dz) < radius) {
        if (player.activeBuff?.type === 'shield') {
          player.activeBuff = undefined;
        } else if (!player.spinUntilTick || player.spinUntilTick <= this.state.tick) {
          const slowMs = effect.type === 'banana' ? BANANA_SLOW_MS : OIL_SLOW_MS;
          player.spinUntilTick = this.state.tick + Math.round(slowMs / TICK_MS);
          // Apply angular impulse for spin
          const car = this.carBodies.get(id);
          if (car) {
            const spinDir = Math.random() > 0.5 ? 1 : -1;
            car.body.angularVelocity.y = spinDir * 6;
          }
          // Remove banana on hit (oil persists until expiry)
          if (effect.type === 'banana') powerUps.removeEffect(effect.id);
        }
      }
    }
  }
}
```

Add missing imports at top of GameLoop.ts:
```typescript
import {
  BOOST_DURATION_MS, SHIELD_DURATION_MS, BANANA_SLOW_MS, OIL_SLOW_MS,
  MISSILE_HIT_RADIUS, BANANA_HIT_RADIUS, OIL_EFFECT_RADIUS,
} from '@racing/shared';
import { PowerUpManager } from './PowerUpManager';
```

**Step 2: Update PowerUpManager.useItem() to accept forward direction for missiles**

In PowerUpManager.ts, update signature:
```typescript
useItem(playerId: string, position: Vec3, forward?: Vec3): void {
  const item = this.playerItems.get(playerId);
  if (!item) return;
  this.playerItems.delete(playerId);

  if (item === 'missile') {
    const vel = forward
      ? { x: forward.x * MISSILE_SPEED, y: 0, z: forward.z * MISSILE_SPEED }
      : { x: 0, y: 0, z: -MISSILE_SPEED };
    this.activeEffects.push({
      id: uid(), type: 'missile', position: { ...position },
      velocity: vel, ownerId: playerId, spawnedAt: this.currentTick,
    });
  } else if (item === 'banana' || item === 'oil') {
    const lifetime = item === 'oil' ? OIL_MAX_TICKS : undefined;
    this.activeEffects.push({
      id: uid(), type: item, position: { ...position },
      ownerId: playerId, spawnedAt: this.currentTick,
      expiresAtTick: lifetime ? this.currentTick + lifetime : undefined,
    });
  }
  // boost and shield are applied instantly on collection in GameLoop.tickPowerUps
}
```

Add `OIL_MAX_TICKS, MISSILE_SPEED` to PowerUpManager imports.

**Step 3: Tick missile movement in PowerUpManager.tick()**

Add missile movement and oil expiry to the `tick()` method:
```typescript
tick(deltaMs: number): void {
  this.currentTick++;
  const tickDt = deltaMs / 1000;

  // Move missiles
  this.activeEffects = this.activeEffects.filter(effect => {
    if (effect.type === 'missile' && effect.velocity) {
      effect.position.x += effect.velocity.x * tickDt;
      effect.position.z += effect.velocity.z * tickDt;
      // Expire old missiles
      if (this.currentTick - effect.spawnedAt > MISSILE_MAX_TICKS) return false;
    }
    // Expire oil/banana by tick
    if (effect.expiresAtTick && this.currentTick > effect.expiresAtTick) return false;
    return true;
  });

  // Box respawn timers (existing logic)
  const expired: string[] = [];
  for (const [boxId, remaining] of this.boxRespawnTimers) {
    const next = remaining - deltaMs;
    if (next <= 0) expired.push(boxId);
    else this.boxRespawnTimers.set(boxId, next);
  }
  for (const id of expired) {
    this.boxRespawnTimers.delete(id);
    const box = this.boxes.find(b => b.id === id);
    if (box) box.active = true;
  }
}
```

Add `MISSILE_MAX_TICKS` to imports.

**Step 4: Wire tickPowerUps into server index.ts game loop interval**

In `packages/server/src/index.ts`, update the interval inside `startGameLoop()`:
```typescript
const interval = setInterval(() => {
  loop.tick();
  powerUps.tick(TICK_MS);
  loop.tickPowerUps(powerUps);  // NEW: proximity collection + effect application

  const state = loop.state;
  state.activeEffects = powerUps.getActiveEffects();
  state.itemBoxes = powerUps.getBoxStates();

  if (state.phase === 'countdown') {
    io.to(roomCode).emit(EV_COUNTDOWN, state.countdown);
  }

  io.to(roomCode).emit(EV_GAME_STATE, state);

  if (state.phase === 'finished') {
    clearInterval(interval);
    gameLoops.delete(roomCode);
    io.to(roomCode).emit(EV_RACE_FINISHED, state.raceResults ?? []);
  }
}, TICK_MS);
```

**Step 5: Pass rotation to useItem in EV_USE_ITEM handler**

```typescript
socket.on(EV_USE_ITEM, () => {
  const room = roomManager.getRoomByPlayer(socket.id);
  if (!room) return;
  const entry = gameLoops.get(room.code);
  if (!entry) return;
  const playerState = entry.loop.state.players[socket.id];
  if (!playerState) return;

  // Compute forward direction from player quaternion
  const q = playerState.rotation;
  // Forward vector (0,0,-1) rotated by quaternion
  const fwdX = 2 * (q.x * q.z + q.w * q.y);
  const fwdZ = -(1 - 2 * (q.x * q.x + q.y * q.y));
  const fwdLen = Math.sqrt(fwdX * fwdX + fwdZ * fwdZ) || 1;
  const forward = { x: fwdX / fwdLen, y: 0, z: fwdZ / fwdLen };

  entry.powerUps.useItem(socket.id, playerState.position, forward);
});
```

**Step 6: Rebuild and verify**
```bash
npm run build -w packages/shared && npm run build -w packages/server
```

**Step 7: Commit**
```bash
git add packages/server/src/
git commit -m "feat(server): implement powerup collection, missile/banana/oil effects, boost/shield"
```

---

### Task 6: Server tests — LapDetection

**Files:**
- Create: `packages/server/src/LapDetection.test.ts`

**Step 1: Write the tests**

```typescript
// packages/server/src/LapDetection.test.ts
import { describe, it, expect } from 'vitest';
import { GameLoop } from './GameLoop';
import { CHECKPOINT_POSITIONS, TOTAL_LAPS } from '@racing/shared';

function advanceToRacing(loop: GameLoop): void {
  loop.startCountdown();
  for (let i = 0; i < 200; i++) loop.tick();
}

function teleportPlayer(loop: GameLoop, id: string, x: number, z: number): void {
  const car = (loop as any).carBodies.get(id);
  if (car) { car.body.position.x = x; car.body.position.z = z; }
  loop.state.players[id].position = { ...loop.state.players[id].position, x, z };
}

describe('Lap Detection', () => {
  it('starts with checkpointIdx=0 and lap=1', () => {
    const loop = new GameLoop(['p1']);
    expect(loop.state.players['p1'].checkpointIdx).toBe(0);
    expect(loop.state.players['p1'].lap).toBe(1);
  });

  it('does not increment lap before all checkpoints crossed', () => {
    const loop = new GameLoop(['p1']);
    advanceToRacing(loop);
    // Teleport player to CP1 area only
    const cp1 = CHECKPOINT_POSITIONS[1];
    teleportPlayer(loop, 'p1', cp1.x, cp1.z);
    loop.tick();
    expect(loop.state.players['p1'].checkpointIdx).toBe(1);
    expect(loop.state.players['p1'].lap).toBe(1);
  });

  it('increments lap when all checkpoints crossed in order', () => {
    const loop = new GameLoop(['p1']);
    advanceToRacing(loop);

    // Walk through checkpoints 1..7 then 0 to complete a lap
    for (let i = 1; i <= 7; i++) {
      const cp = CHECKPOINT_POSITIONS[i];
      teleportPlayer(loop, 'p1', cp.x, cp.z);
      for (let t = 0; t < 5; t++) loop.tick();
      expect(loop.state.players['p1'].checkpointIdx).toBe(i);
    }
    // Cross CP0 to finish lap
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
  });

  it('tracks bestLapMs and updates on faster lap', () => {
    const loop = new GameLoop(['p1']);
    advanceToRacing(loop);

    // Complete one lap
    for (let i = 1; i <= 7; i++) {
      const cp = CHECKPOINT_POSITIONS[i];
      teleportPlayer(loop, 'p1', cp.x, cp.z);
      for (let t = 0; t < 5; t++) loop.tick();
    }
    teleportPlayer(loop, 'p1', CHECKPOINT_POSITIONS[0].x, CHECKPOINT_POSITIONS[0].z);
    for (let t = 0; t < 5; t++) loop.tick();

    const firstLapTime = loop.state.players['p1'].bestLapMs;
    expect(firstLapTime).not.toBeNull();
    expect(firstLapTime).toBeGreaterThan(0);
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
      const cp0 = CHECKPOINT_POSITIONS[0];
      teleportPlayer(loop, 'p1', cp0.x, cp0.z);
      for (let t = 0; t < 5; t++) loop.tick();
    }

    // After finishing, next tick should trigger phase='finished'
    loop.tick();
    expect(loop.state.phase).toBe('finished');
    expect(loop.state.raceResults).toHaveLength(1);
    expect(loop.state.raceResults![0].position).toBe(1);
  });
});
```

**Step 2: Run tests**
```bash
cd /home/aayushms/work/pet_projects/online_racing_game
npm run test -w packages/server
```
Expected: All new LapDetection tests pass.

**Step 3: Commit**
```bash
git add packages/server/src/LapDetection.test.ts
git commit -m "test(server): add LapDetection tests — checkpoints, lap increment, finish, bestLap"
```

---

### Task 7: Server tests — PowerupCollision

**Files:**
- Create: `packages/server/src/PowerupCollision.test.ts`

**Step 1: Write the tests**

```typescript
// packages/server/src/PowerupCollision.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameLoop } from './GameLoop';
import { PowerUpManager } from './PowerUpManager';
import { ITEM_BOX_WORLD_POSITIONS } from '@racing/shared';

function advanceToRacing(loop: GameLoop): void {
  loop.startCountdown();
  for (let i = 0; i < 200; i++) loop.tick();
}

describe('Powerup Collection', () => {
  it('player collects item box when within 3.5 units', () => {
    const loop = new GameLoop(['p1']);
    const powerUps = new PowerUpManager(ITEM_BOX_WORLD_POSITIONS);
    advanceToRacing(loop);

    // Teleport player to first item box position
    const box = ITEM_BOX_WORLD_POSITIONS[0];
    loop.state.players['p1'].position = { x: box.x, y: box.y, z: box.z };
    loop.state.players['p1'].heldItem = null;

    loop.tickPowerUps(powerUps);

    // Player should have received an item (boost/shield applied instantly, others held)
    const player = loop.state.players['p1'];
    const hasItem = player.heldItem !== null || player.activeBuff !== undefined;
    expect(hasItem).toBe(true);
  });

  it('item box becomes inactive after collection', () => {
    const loop = new GameLoop(['p1']);
    const powerUps = new PowerUpManager(ITEM_BOX_WORLD_POSITIONS);
    advanceToRacing(loop);

    const box = ITEM_BOX_WORLD_POSITIONS[0];
    loop.state.players['p1'].position = { x: box.x, y: box.y, z: box.z };
    loop.tickPowerUps(powerUps);

    expect(powerUps.getBoxStates()[0].active).toBe(false);
  });

  it('player cannot collect second item while already holding one', () => {
    const loop = new GameLoop(['p1']);
    const powerUps = new PowerUpManager(ITEM_BOX_WORLD_POSITIONS);
    advanceToRacing(loop);

    loop.state.players['p1'].heldItem = 'banana';
    const box = ITEM_BOX_WORLD_POSITIONS[0];
    loop.state.players['p1'].position = { x: box.x, y: box.y, z: box.z };
    loop.tickPowerUps(powerUps);

    expect(loop.state.players['p1'].heldItem).toBe('banana');
    expect(powerUps.getBoxStates()[0].active).toBe(true); // box untouched
  });

  it('missile travels forward each tick', () => {
    const powerUps = new PowerUpManager(ITEM_BOX_WORLD_POSITIONS);
    const startPos = { x: 0, y: 1, z: 0 };
    const forward = { x: 0, y: 0, z: -1 };
    powerUps['playerItems'].set('p1', 'missile');
    powerUps.useItem('p1', startPos, forward);

    const effectBefore = { ...powerUps.getActiveEffects()[0].position };
    powerUps.tick(16.67);
    const effectAfter = powerUps.getActiveEffects()[0].position;

    expect(effectAfter.z).toBeLessThan(effectBefore.z);
  });

  it('missile hit applies spinUntilTick to target', () => {
    const loop = new GameLoop(['p1', 'p2']);
    const powerUps = new PowerUpManager(ITEM_BOX_WORLD_POSITIONS);
    advanceToRacing(loop);

    // Place missile at p2 position
    const p2Pos = loop.state.players['p2'].position;
    powerUps['playerItems'].set('p1', 'missile');
    powerUps.useItem('p1', { x: p2Pos.x, y: p2Pos.y, z: p2Pos.z }, { x: 0, y: 0, z: -1 });

    loop.tickPowerUps(powerUps);

    const p2After = loop.state.players['p2'];
    expect(p2After.spinUntilTick).toBeDefined();
    expect(p2After.spinUntilTick).toBeGreaterThan(loop.state.tick);
  });

  it('shield absorbs missile hit', () => {
    const loop = new GameLoop(['p1', 'p2']);
    const powerUps = new PowerUpManager(ITEM_BOX_WORLD_POSITIONS);
    advanceToRacing(loop);

    const p2 = loop.state.players['p2'];
    p2.activeBuff = { type: 'shield', expiresAtTick: loop.state.tick + 300 };

    const p2Pos = p2.position;
    powerUps['playerItems'].set('p1', 'missile');
    powerUps.useItem('p1', { x: p2Pos.x, y: p2Pos.y, z: p2Pos.z }, { x: 0, y: 0, z: -1 });

    loop.tickPowerUps(powerUps);

    expect(loop.state.players['p2'].spinUntilTick).toBeUndefined();
    expect(loop.state.players['p2'].activeBuff).toBeUndefined(); // shield consumed
  });

  it('banana slows player on contact', () => {
    const loop = new GameLoop(['p1', 'p2']);
    const powerUps = new PowerUpManager(ITEM_BOX_WORLD_POSITIONS);
    advanceToRacing(loop);

    const p2Pos = loop.state.players['p2'].position;
    powerUps['playerItems'].set('p1', 'banana');
    powerUps.useItem('p1', { x: p2Pos.x, y: p2Pos.y, z: p2Pos.z });

    loop.tickPowerUps(powerUps);

    expect(loop.state.players['p2'].spinUntilTick).toBeDefined();
  });
});
```

**Step 2: Run tests**
```bash
npm run test -w packages/server
```
Expected: All PowerupCollision tests pass.

**Step 3: Commit**
```bash
git add packages/server/src/PowerupCollision.test.ts
git commit -m "test(server): add PowerupCollision tests — collection, missile, banana, shield"
```

---

### Task 8: Server tests — Race flow integration

**Files:**
- Create: `packages/server/src/race-flow.test.ts`

**Step 1: Write the integration test**

```typescript
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

describe('Race Flow', () => {
  it('full race: create → countdown → racing → 3 laps → finished', () => {
    const loop = new GameLoop(['p1', 'p2'], { p1: 'Alice', p2: 'Bob' });
    const powerUps = new PowerUpManager(ITEM_BOX_WORLD_POSITIONS);

    expect(loop.state.phase).toBe('waiting');
    advanceToRacing(loop);
    expect(loop.state.phase).toBe('racing');

    // p1 completes all 3 laps
    for (let lap = 0; lap < TOTAL_LAPS; lap++) {
      completeLap(loop, 'p1');
    }

    expect(loop.state.players['p1'].finished).toBe(true);
    expect(loop.state.players['p1'].finishTime).toBeGreaterThan(0);

    // p2 completes all 3 laps (slightly after)
    for (let lap = 0; lap < TOTAL_LAPS; lap++) {
      completeLap(loop, 'p2');
    }

    loop.tick(); // trigger finish check
    expect(loop.state.phase).toBe('finished');
  });

  it('standings: first finisher is position 1', () => {
    const loop = new GameLoop(['p1', 'p2'], { p1: 'Alice', p2: 'Bob' });
    advanceToRacing(loop);

    for (let lap = 0; lap < TOTAL_LAPS; lap++) completeLap(loop, 'p1');
    for (let lap = 0; lap < TOTAL_LAPS; lap++) completeLap(loop, 'p2');
    loop.tick();

    const results = loop.state.raceResults!;
    expect(results[0].nickname).toBe('Alice');
    expect(results[0].position).toBe(1);
    expect(results[1].position).toBe(2);
  });

  it('game emits raceResults when finished', () => {
    const loop = new GameLoop(['p1'], { p1: 'Solo' });
    advanceToRacing(loop);

    for (let lap = 0; lap < TOTAL_LAPS; lap++) completeLap(loop, 'p1');
    loop.tick();

    expect(loop.state.raceResults).toBeDefined();
    expect(loop.state.raceResults!.length).toBe(1);
    expect(loop.state.raceResults![0].bestLapMs).toBeGreaterThan(0);
  });
});
```

**Step 2: Run all server tests**
```bash
npm run test -w packages/server
```
Expected: All tests pass (existing + new).

**Step 3: Commit**
```bash
git add packages/server/src/race-flow.test.ts
git commit -m "test(server): add race-flow integration test — full race lifecycle"
```

---

### Task 9: Spring-damper camera and screen shake in SceneManager

**Files:**
- Modify: `packages/client/src/game/SceneManager.ts`

**Step 1: Replace SceneManager.ts entirely**

```typescript
// packages/client/src/game/SceneManager.ts
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;

  private animFrameId: number | null = null;
  private resizeObserver!: ResizeObserver;

  // Spring-damper state
  private camVelocity = new THREE.Vector3();
  private lookAtCurrent = new THREE.Vector3(0, 0, 0);
  private lookAtVelocity = new THREE.Vector3();

  // Screen shake state
  private shakeAmplitude = 0;
  private shakeDamping = 8; // decay rate

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 80, 200);

    this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
    this.camera.position.set(0, 8, 20);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // CSS2D renderer for name tags
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    canvas.parentElement?.appendChild(this.labelRenderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
    sun.position.set(50, 80, 50);
    sun.castShadow = true;
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun);

    this.resizeObserver = new ResizeObserver(() => this.onResize(canvas));
    this.resizeObserver.observe(canvas);
  }

  private onResize(canvas: HTMLCanvasElement): void {
    this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.labelRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
  }

  triggerShake(amplitude = 0.4): void {
    this.shakeAmplitude = Math.max(this.shakeAmplitude, amplitude);
  }

  startRenderLoop(onFrame: (dt: number) => void): void {
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      onFrame(dt);
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
      this.animFrameId = requestAnimationFrame(frame);
    };
    this.animFrameId = requestAnimationFrame(frame);
  }

  stopRenderLoop(): void {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
  }

  dispose(): void {
    this.stopRenderLoop();
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.labelRenderer.domElement.remove();
  }

  followTarget(targetPos: THREE.Vector3, targetRot: THREE.Quaternion, dt: number): void {
    const k = 15, d = 8; // spring constant, damping

    // Desired camera position: behind + above kart
    const offset = new THREE.Vector3(0, 5, 12);
    offset.applyQuaternion(targetRot);
    const desired = targetPos.clone().add(offset);

    // Spring-damper integration
    const displacement = new THREE.Vector3().subVectors(desired, this.camera.position);
    const spring = displacement.multiplyScalar(k);
    const damp = this.camVelocity.clone().multiplyScalar(d);
    this.camVelocity.addScaledVector(spring.sub(damp), dt);
    this.camera.position.addScaledVector(this.camVelocity, dt);

    // Screen shake offset
    if (this.shakeAmplitude > 0.01) {
      this.shakeAmplitude *= Math.exp(-this.shakeDamping * dt);
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmplitude;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmplitude;
    } else {
      this.shakeAmplitude = 0;
    }

    // LookAt spring: look 6 units ahead of kart
    const forward = new THREE.Vector3(0, 0, -6).applyQuaternion(targetRot);
    const lookTarget = targetPos.clone().add(forward).add(new THREE.Vector3(0, 1, 0));
    const lookDisp = new THREE.Vector3().subVectors(lookTarget, this.lookAtCurrent);
    const lookSpring = lookDisp.multiplyScalar(12);
    const lookDamp = this.lookAtVelocity.clone().multiplyScalar(7);
    this.lookAtVelocity.addScaledVector(lookSpring.sub(lookDamp), dt);
    this.lookAtCurrent.addScaledVector(this.lookAtVelocity, dt);

    this.camera.lookAt(this.lookAtCurrent);
  }
}
```

**Step 2: Update GameScreen.tsx** to pass `dt` to `followTarget`:

```typescript
scene.startRenderLoop((dt) => {
  // ...
  if (myState) {
    const pos = new THREE.Vector3(myState.position.x, myState.position.y, myState.position.z);
    const quat = new THREE.Quaternion(myState.rotation.x, myState.rotation.y, myState.rotation.z, myState.rotation.w);
    scene.followTarget(pos, quat, dt);  // <-- add dt
  }
```

**Step 3: Rebuild client**
```bash
npm run build -w packages/client
```
Expected: exits 0.

**Step 4: Commit**
```bash
git add packages/client/src/game/SceneManager.ts packages/client/src/screens/GameScreen.tsx
git commit -m "feat(client): spring-damper camera, screen shake, CSS2DRenderer setup"
```

---

### Task 10: Kart interpolation and name tags in KartPool

**Files:**
- Modify: `packages/client/src/game/KartPool.ts`

**Step 1: Rewrite KartPool.ts**

```typescript
// packages/client/src/game/KartPool.ts
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { PlayerState } from '@racing/shared';
import { createKartMesh } from './KartMesh';

interface KartEntry {
  mesh: THREE.Group;
  label: CSS2DObject;
  prevPos: THREE.Vector3;
  currPos: THREE.Vector3;
  prevQuat: THREE.Quaternion;
  currQuat: THREE.Quaternion;
  lastUpdateTime: number;
}

export class KartPool {
  private karts: Map<string, KartEntry> = new Map();
  private scene: THREE.Scene;
  private myId = '';
  private tickMs = 1000 / 60;

  constructor(scene: THREE.Scene, myId = '') {
    this.scene = scene;
    this.myId = myId;
  }

  /** Call every server state tick (16.67ms) */
  updateServerState(players: Record<string, PlayerState>): void {
    const currentIds = new Set(Object.keys(players));

    // Add new karts
    for (const [id, player] of Object.entries(players)) {
      if (!this.karts.has(id)) {
        const mesh = createKartMesh(player.carIndex);
        this.scene.add(mesh);

        // Name tag label
        const div = document.createElement('div');
        div.className = 'kart-label';
        div.style.cssText = `
          background: rgba(0,0,0,0.65);
          color: #fff;
          font-family: monospace;
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 8px;
          pointer-events: none;
          white-space: nowrap;
        `;
        const label = new CSS2DObject(div);
        label.position.set(0, 2.5, 0);
        mesh.add(label);

        const pos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
        const quat = new THREE.Quaternion(player.rotation.x, player.rotation.y, player.rotation.z, player.rotation.w);
        this.karts.set(id, {
          mesh, label,
          prevPos: pos.clone(), currPos: pos.clone(),
          prevQuat: quat.clone(), currQuat: quat.clone(),
          lastUpdateTime: performance.now(),
        });
      }

      const entry = this.karts.get(id)!;
      // Shift current → prev, store new server state as current
      entry.prevPos.copy(entry.currPos);
      entry.prevQuat.copy(entry.currQuat);
      entry.currPos.set(player.position.x, player.position.y, player.position.z);
      entry.currQuat.set(player.rotation.x, player.rotation.y, player.rotation.z, player.rotation.w);
      entry.lastUpdateTime = performance.now();

      // Update name tag text
      const isMe = id === this.myId;
      const div = entry.label.element as HTMLDivElement;
      div.textContent = isMe ? `▶ ${player.nickname}` : player.nickname;
      div.style.color = isMe ? '#ffee44' : '#fff';
    }

    // Remove departed karts
    for (const [id, entry] of this.karts) {
      if (!currentIds.has(id)) {
        this.scene.remove(entry.mesh);
        this.karts.delete(id);
      }
    }
  }

  /** Call every render frame with interpolation alpha [0,1] */
  interpolate(alpha: number): void {
    for (const [, entry] of this.karts) {
      entry.mesh.position.lerpVectors(entry.prevPos, entry.currPos, alpha);
      entry.mesh.quaternion.slerpQuaternions(entry.prevQuat, entry.currQuat, alpha);
    }
  }

  getKart(playerId: string): THREE.Group | undefined {
    return this.karts.get(playerId)?.mesh;
  }

  dispose(): void {
    for (const entry of this.karts.values()) this.scene.remove(entry.mesh);
    this.karts.clear();
  }
}
```

**Step 2: Update GameScreen.tsx to use new KartPool API**

In the render loop in GameScreen.tsx, replace:
```typescript
kartPool.syncPlayers(state.players);
```
with:
```typescript
// Track time between server updates for interpolation
```

And in the `EV_GAME_STATE` handler:
```typescript
useSocketEvent<GameState>(EV_GAME_STATE, (state) => {
  setGameState(state);
  stateRef.current = state;
  kartPoolRef.current?.updateServerState(state.players);  // interpolation target
});
```

Add `kartPoolRef` to track the pool:
```typescript
const kartPoolRef = useRef<KartPool | null>(null);
```

In the useEffect:
```typescript
const kartPool = new KartPool(scene.scene, socket.id ?? '');
kartPoolRef.current = kartPool;
```

In the render loop callback:
```typescript
scene.startRenderLoop((dt) => {
  elapsed += dt;
  const state = stateRef.current;
  if (!state) return;

  // Interpolation: alpha = time since last server tick / tick duration
  const timeSinceUpdate = performance.now() - (lastServerUpdateRef.current ?? 0);
  const alpha = Math.min(timeSinceUpdate / TICK_MS, 1);
  kartPool.interpolate(alpha);
  // ... rest of render loop
```

Add `lastServerUpdateRef`:
```typescript
const lastServerUpdateRef = useRef<number>(0);
// In EV_GAME_STATE handler:
lastServerUpdateRef.current = performance.now();
```

**Step 3: Rebuild and check**
```bash
npm run build -w packages/client
```

**Step 4: Commit**
```bash
git add packages/client/src/game/KartPool.ts packages/client/src/screens/GameScreen.tsx
git commit -m "feat(client): kart interpolation between server ticks, CSS2D name tags above karts"
```

---

### Task 11: Skid marks system

**Files:**
- Create: `packages/client/src/game/SkidMarks.ts`

**Step 1: Create SkidMarks.ts**

```typescript
// packages/client/src/game/SkidMarks.ts
import * as THREE from 'three';

const MAX_MARKS = 200;

export class SkidMarks {
  private marks: THREE.Mesh[] = [];
  private scene: THREE.Scene;
  private mat: THREE.MeshBasicMaterial;
  private head = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.mat = new THREE.MeshBasicMaterial({
      color: 0x222222,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
  }

  /** Call each render frame for each kart */
  update(
    kartPos: THREE.Vector3,
    kartQuat: THREE.Quaternion,
    speed: number,
    steer: number,
  ): void {
    if (Math.abs(steer) < 0.55 || speed < 12) return;

    const geo = new THREE.PlaneGeometry(1.6, 1.0);
    const mark = new THREE.Mesh(geo, this.mat);
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(kartPos.x, 0.02, kartPos.z);
    // Align with kart direction
    const angle = Math.atan2(
      2 * (kartQuat.w * kartQuat.y + kartQuat.x * kartQuat.z),
      1 - 2 * (kartQuat.y * kartQuat.y + kartQuat.z * kartQuat.z),
    );
    mark.rotation.z = -angle;
    this.scene.add(mark);

    // Ring buffer: remove oldest mark
    if (this.marks.length >= MAX_MARKS) {
      const old = this.marks[this.head];
      this.scene.remove(old);
      old.geometry.dispose();
      this.marks[this.head] = mark;
    } else {
      this.marks.push(mark);
    }
    this.head = (this.head + 1) % MAX_MARKS;
  }

  dispose(): void {
    for (const m of this.marks) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    this.marks = [];
    this.mat.dispose();
  }
}
```

**Step 2: Wire SkidMarks into GameScreen.tsx**

Import and create in the useEffect:
```typescript
import { SkidMarks } from '../game/SkidMarks';
// inside useEffect:
const skidMarks = new SkidMarks(scene.scene);
```

In render loop, after interpolate():
```typescript
const myState = state.players[socket.id ?? ''];
if (myState) {
  const pos = new THREE.Vector3(myState.position.x, myState.position.y, myState.position.z);
  const quat = new THREE.Quaternion(myState.rotation.x, myState.rotation.y, myState.rotation.z, myState.rotation.w);
  scene.followTarget(pos, quat, dt);
  // Skid marks for own kart
  skidMarks.update(pos, quat, myState.speed, inputHandler.getLastSteer());
}
```

Add `getLastSteer()` to InputHandler:
```typescript
getLastSteer(): number { return this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? -1
  : this.keys.has('ArrowRight') || this.keys.has('KeyD') ? 1 : 0; }
```

In cleanup:
```typescript
skidMarks.dispose();
```

**Step 3: Commit**
```bash
git add packages/client/src/game/SkidMarks.ts packages/client/src/game/InputHandler.ts packages/client/src/screens/GameScreen.tsx
git commit -m "feat(client): skid marks ring buffer, stamped when steering hard at speed"
```

---

### Task 12: AudioManager with synthesised sounds

**Files:**
- Create: `packages/client/src/game/AudioManager.ts`

**Step 1: Create AudioManager.ts**

```typescript
// packages/client/src/game/AudioManager.ts

export class AudioManager {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private boostOsc: OscillatorNode | null = null;
  private boostTimeout: ReturnType<typeof setTimeout> | null = null;
  private muted = false;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  startEngine(): void {
    const ctx = this.getCtx();
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.08;
    this.engineGain.connect(ctx.destination);

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 80;
    this.engineOsc.connect(this.engineGain);
    this.engineOsc.start();
  }

  setEngineRpm(ratio: number): void {
    if (!this.engineOsc || !this.engineGain) return;
    // Map speed 0-1 → frequency 80-320 Hz
    this.engineOsc.frequency.setTargetAtTime(80 + ratio * 240, this.ctx!.currentTime, 0.1);
    this.engineGain.gain.setTargetAtTime(0.05 + ratio * 0.08, this.ctx!.currentTime, 0.1);
  }

  stopEngine(): void {
    this.engineOsc?.stop();
    this.engineOsc = null;
    this.engineGain?.disconnect();
    this.engineGain = null;
  }

  playCountdownBeep(final = false): void {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = final ? 880 : 440;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  playCollect(): void {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  playHit(): void {
    const ctx = this.getCtx();
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.4;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  playSpin(): void {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }

  playBoost(): void {
    const ctx = this.getCtx();
    if (this.boostOsc) { this.boostOsc.stop(); this.boostOsc = null; }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2.5);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.0);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 3.0);
    this.boostOsc = osc;
  }

  playItemUse(): void {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 300;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  dispose(): void {
    this.stopEngine();
    this.ctx?.close();
    this.ctx = null;
  }
}
```

**Step 2: Wire AudioManager into GameScreen.tsx**

```typescript
import { AudioManager } from '../game/AudioManager';

// Inside useEffect, after scene setup:
const audio = new AudioManager();

// After countdown → racing detected (watch for phase change in gameState):
// Add a phaseRef to track previous phase
const phaseRef = useRef<string>('');

// In EV_GAME_STATE handler:
useSocketEvent<GameState>(EV_GAME_STATE, (state) => {
  const prevPhase = phaseRef.current;
  phaseRef.current = state.phase;
  if (prevPhase === 'countdown' && state.phase === 'racing') {
    audioRef.current?.playCountdownBeep(true); // GO beep
    audioRef.current?.startEngine();
  }
  if (state.phase === 'countdown' && state.countdown !== prevCountdownRef.current) {
    if (state.countdown > 0) audioRef.current?.playCountdownBeep(false);
    prevCountdownRef.current = state.countdown;
  }
  // Detect item collection (held item appeared)
  const myPrev = stateRef.current?.players[socket.id ?? ''];
  const myCurr = state.players[socket.id ?? ''];
  if (!myPrev?.heldItem && myCurr?.heldItem) audioRef.current?.playCollect();
  if (myPrev?.heldItem && !myCurr?.heldItem && prevPhase === 'racing') audioRef.current?.playItemUse();

  setGameState(state);
  stateRef.current = state;
  kartPoolRef.current?.updateServerState(state.players);
  lastServerUpdateRef.current = performance.now();
});

// In render loop, update engine pitch:
const myState = state.players[socket.id ?? ''];
if (myState) {
  audioRef.current?.setEngineRpm(myState.speed / 30);
  // ...
}

// In cleanup:
audio.stopEngine();
audio.dispose();
```

Add refs:
```typescript
const audioRef = useRef<AudioManager | null>(null);
const prevCountdownRef = useRef<number>(3);
```

Inside useEffect: `audioRef.current = audio;`

**Step 3: Detect hit on own kart from activeEffects diff and trigger shake + sound**

In `EV_GAME_STATE` handler, after comparing myPrev/myCurr:
```typescript
// Detect if we just got spun (spinUntilTick appeared)
if (!myPrev?.spinUntilTick && myCurr?.spinUntilTick) {
  audioRef.current?.playHit();
  sceneRef.current?.triggerShake(0.5);
}
// Detect boost pickup
if (!myPrev?.activeBuff && myCurr?.activeBuff?.type === 'boost') {
  audioRef.current?.playBoost();
}
```

Add `sceneRef`:
```typescript
const sceneRef = useRef<SceneManager | null>(null);
// In useEffect: sceneRef.current = scene;
```

**Step 4: Rebuild**
```bash
npm run build -w packages/client
```

**Step 5: Commit**
```bash
git add packages/client/src/game/AudioManager.ts packages/client/src/screens/GameScreen.tsx
git commit -m "feat(client): AudioManager with synthesised Web Audio sounds, wired to game events"
```

---

### Task 13: Rebuilt HUD with lap timers, position badge, speed ring, item slot

**Files:**
- Modify: `packages/client/src/components/HUD.tsx`

**Step 1: Replace HUD.tsx**

```tsx
// packages/client/src/components/HUD.tsx
import React, { useEffect, useRef, useState } from 'react';
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
```

**Step 2: Update GameScreen.tsx to track lap times and pass them to HUD**

```typescript
// Inside GameScreen component, add lap time tracking:
const lapTimesRef = useRef<number[]>([]);
const [lapTimes, setLapTimes] = useState<number[]>([]);

// In EV_GAME_STATE handler, detect lap completion:
const myPrev = stateRef.current?.players[socket.id ?? ''];
const myCurr = state.players[socket.id ?? ''];
if (myPrev && myCurr && myCurr.lap > myPrev.lap) {
  // A lap was just completed — record the time
  // bestLapMs is updated server-side; we track lap times client-side from state
  if (myCurr.bestLapMs !== null) {
    lapTimesRef.current = [...lapTimesRef.current, myCurr.bestLapMs];
    setLapTimes([...lapTimesRef.current]);
  }
}
```

Update HUD render in return:
```tsx
{gameState && <HUD state={gameState} myId={socket.id ?? ''} lapTimes={lapTimes} />}
```

**Step 3: Rebuild**
```bash
npm run build -w packages/client
```

**Step 4: Commit**
```bash
git add packages/client/src/components/HUD.tsx packages/client/src/screens/GameScreen.tsx
git commit -m "feat(client): rebuilt HUD — speed ring SVG, lap timers, item slot, position badge"
```

---

### Task 14: Mini-map component

**Files:**
- Create: `packages/client/src/components/MiniMap.tsx`

**Step 1: Create MiniMap.tsx**

```tsx
// packages/client/src/components/MiniMap.tsx
import React, { useRef, useEffect } from 'react';
import { GameState } from '@racing/shared';
import { CURVE_SAMPLES } from '@racing/shared';

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
      const [cx, cy] = toCanvas(s.x, s.z);
      ctx.lineTo(cx, cy);
    }
    ctx.closePath();
    ctx.stroke();

    // Player dots
    const players = Object.values(state.players);
    for (const p of players) {
      const [cx, cy] = toCanvas(p.position.x, p.position.z);
      const isMe = p.id === myId;
      const color = isMe ? '#ffffff' : KART_COLORS[p.carIndex % KART_COLORS.length];
      const radius = isMe ? 5 : 3.5;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (isMe) {
        // Direction arrow
        const angle = 2 * Math.atan2(p.rotation.y, p.rotation.w);
        const ax = Math.sin(angle) * 8, az = -Math.cos(angle) * 8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + ax * ((SIZE - PAD * 2) / (maxX - minX)),
                   cy + az * ((SIZE - PAD * 2) / (maxZ - minZ)));
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
```

**Step 2: Add MiniMap to GameScreen.tsx return**

```tsx
import { MiniMap } from '../components/MiniMap';

// In the return JSX:
return (
  <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
    <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    {gameState && <HUD state={gameState} myId={socket.id ?? ''} lapTimes={lapTimes} />}
    {gameState && <MiniMap state={gameState} myId={socket.id ?? ''} />}
  </div>
);
```

**Step 3: Rebuild**
```bash
npm run build -w packages/client
```

**Step 4: Commit**
```bash
git add packages/client/src/components/MiniMap.tsx packages/client/src/screens/GameScreen.tsx
git commit -m "feat(client): mini-map canvas overlay with track line and player dots"
```

---

### Task 15: Podium screen overhaul

**Files:**
- Modify: `packages/client/src/screens/PodiumScreen.tsx`
- Modify: `packages/client/src/screens/GameScreen.tsx`
- Modify: `packages/client/src/App.tsx`

**Step 1: Add raceResults to AppState in App.tsx**

```typescript
import { RaceResult } from '@racing/shared';

export interface AppState {
  screen: Screen;
  nickname: string;
  roomCode: string;
  initialRoomState?: any;
  raceResults?: RaceResult[];
}
```

**Step 2: Pass raceResults to podium in GameScreen.tsx**

```typescript
import { RaceResult } from '@racing/shared';

// Update the EV_RACE_FINISHED handler:
useSocketEvent<RaceResult[]>(EV_RACE_FINISHED, (results) => {
  navigate('podium', { ...appState, raceResults: results });
});
```

**Step 3: Rewrite PodiumScreen.tsx**

```tsx
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

  // Find best lap overall
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
          const rank = r.position - 1; // 0-indexed
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

      {/* Rest of finishers */}
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
```

**Step 4: Rebuild**
```bash
npm run build -w packages/client
```

**Step 5: Commit**
```bash
git add packages/client/src/screens/PodiumScreen.tsx packages/client/src/screens/GameScreen.tsx packages/client/src/App.tsx
git commit -m "feat(client): podium screen with medal blocks, finish times, best lap records"
```

---

### Task 16: Client item box positions — sync with shared

**Files:**
- Modify: `packages/client/src/game/ItemBoxes.ts`

**Step 1: Update ItemBoxes.ts to use shared positions**

```typescript
// packages/client/src/game/ItemBoxes.ts
import * as THREE from 'three';
import { ItemBoxState, ITEM_BOX_WORLD_POSITIONS } from '@racing/shared';

export function createItemBoxes(scene: THREE.Scene): THREE.Mesh[] {
  const boxes: THREE.Mesh[] = [];
  ITEM_BOX_WORLD_POSITIONS.forEach(pos => {
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshToonMaterial({ color: 0xffd700, emissive: 0x886600, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.castShadow = true;
    scene.add(mesh);
    boxes.push(mesh);
  });
  return boxes;
}

export function syncItemBoxes(boxes: THREE.Mesh[], states: ItemBoxState[]): void {
  states.forEach((state, i) => {
    if (boxes[i]) boxes[i].visible = state.active;
  });
}

export function animateItemBoxes(boxes: THREE.Mesh[], elapsed: number): void {
  boxes.forEach((box, i) => {
    if (!box.visible) return;
    box.rotation.y = elapsed + (i * Math.PI) / 3;
    box.position.y = 0.8 + Math.sin(elapsed * 2 + i) * 0.15;
  });
}
```

**Step 2: Commit**
```bash
git add packages/client/src/game/ItemBoxes.ts
git commit -m "fix(client): item box positions now use shared ITEM_BOX_WORLD_POSITIONS"
```

---

### Task 17: Client test setup

**Files:**
- Create: `packages/client/vitest.config.ts`
- Modify: `packages/client/package.json`

**Step 1: Create vitest.config.ts for client**

```typescript
// packages/client/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
  },
});
```

**Step 2: Add test script and happy-dom to client package.json**

In `packages/client/package.json`, add to devDependencies:
```json
"vitest": "^1.0.0",
"happy-dom": "^12.0.0"
```

Add to scripts:
```json
"test": "vitest run"
```

**Step 3: Install**
```bash
npm install -w packages/client
```

**Step 4: Commit**
```bash
git add packages/client/vitest.config.ts packages/client/package.json package-lock.json
git commit -m "chore(client): add vitest + happy-dom for client unit tests"
```

---

### Task 18: Client tests — SceneManager and KartPool

**Files:**
- Create: `packages/client/src/game/SceneManager.test.ts`
- Create: `packages/client/src/game/KartPool.test.ts`

**Step 1: Create SceneManager.test.ts**

```typescript
// packages/client/src/game/SceneManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';

// Mock CSS2DRenderer since it needs DOM
vi.mock('three/examples/jsm/renderers/CSS2DRenderer.js', () => ({
  CSS2DRenderer: class {
    domElement = document.createElement('div');
    setSize = vi.fn();
    render = vi.fn();
  },
  CSS2DObject: class {
    element: HTMLElement;
    position = { set: vi.fn() };
    constructor(el: HTMLElement) { this.element = el; }
  },
}));

// Mock WebGLRenderer
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three');
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement('canvas');
      setSize = vi.fn();
      setPixelRatio = vi.fn();
      shadowMap = { enabled: false, type: 0 };
      render = vi.fn();
      dispose = vi.fn();
    },
  };
});

import { SceneManager } from './SceneManager';

describe('SceneManager camera', () => {
  let canvas: HTMLCanvasElement;
  let scene: SceneManager;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 800 });
    Object.defineProperty(canvas, 'clientHeight', { value: 600 });
    document.body.appendChild(canvas);
    scene = new SceneManager(canvas);
  });

  it('spring-damper converges camera toward target position over time', () => {
    const targetPos = new THREE.Vector3(50, 0, 50);
    const targetRot = new THREE.Quaternion();
    const dt = 1 / 60;

    const startDist = scene.camera.position.distanceTo(targetPos);

    // Simulate 120 frames (~2 seconds)
    for (let i = 0; i < 120; i++) {
      scene.followTarget(targetPos, targetRot, dt);
    }

    const endDist = scene.camera.position.distanceTo(targetPos);
    expect(endDist).toBeLessThan(startDist);
  });

  it('triggerShake sets positive shakeAmplitude', () => {
    scene.triggerShake(0.5);
    expect((scene as any).shakeAmplitude).toBeCloseTo(0.5);
  });

  it('shake amplitude decays to near zero after enough frames', () => {
    scene.triggerShake(0.5);
    const targetPos = new THREE.Vector3(0, 0, 0);
    const targetRot = new THREE.Quaternion();
    for (let i = 0; i < 120; i++) scene.followTarget(targetPos, targetRot, 1 / 60);
    expect((scene as any).shakeAmplitude).toBeLessThan(0.01);
  });
});
```

**Step 2: Create KartPool.test.ts**

```typescript
// packages/client/src/game/KartPool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { PlayerState } from '@racing/shared';

vi.mock('three/examples/jsm/renderers/CSS2DRenderer.js', () => ({
  CSS2DObject: class {
    element = document.createElement('div');
    position = { set: vi.fn() };
  },
}));

vi.mock('./KartMesh', () => ({
  createKartMesh: () => {
    const group = new THREE.Group();
    group.add = vi.fn();
    return group;
  },
}));

import { KartPool } from './KartPool';

function makePlayer(id: string, x: number, z: number): PlayerState {
  return {
    id, nickname: 'Test', carIndex: 0,
    position: { x, y: 1, z }, rotation: { x: 0, y: 0, z: 0, w: 1 },
    speed: 0, heldItem: null, lap: 1, lapProgress: 0,
    finished: false, finishTime: null, bestLapMs: null, checkpointIdx: 0,
  };
}

describe('KartPool interpolation', () => {
  let scene: THREE.Scene;
  let pool: KartPool;

  beforeEach(() => {
    scene = new THREE.Scene();
    scene.add = vi.fn();
    scene.remove = vi.fn();
    pool = new KartPool(scene, 'p1');
  });

  it('interpolate(0) positions kart at previous server state', () => {
    pool.updateServerState({ p1: makePlayer('p1', 0, 0) });
    pool.updateServerState({ p1: makePlayer('p1', 10, 0) });

    pool.interpolate(0);
    const kart = pool.getKart('p1')!;
    expect(kart.position.x).toBeCloseTo(0, 1);
  });

  it('interpolate(1) positions kart at current server state', () => {
    pool.updateServerState({ p1: makePlayer('p1', 0, 0) });
    pool.updateServerState({ p1: makePlayer('p1', 10, 0) });

    pool.interpolate(1);
    const kart = pool.getKart('p1')!;
    expect(kart.position.x).toBeCloseTo(10, 1);
  });

  it('interpolate(0.5) positions kart halfway between states', () => {
    pool.updateServerState({ p1: makePlayer('p1', 0, 0) });
    pool.updateServerState({ p1: makePlayer('p1', 10, 0) });

    pool.interpolate(0.5);
    const kart = pool.getKart('p1')!;
    expect(kart.position.x).toBeCloseTo(5, 1);
  });

  it('removes kart from scene when player leaves', () => {
    pool.updateServerState({ p1: makePlayer('p1', 0, 0) });
    pool.updateServerState({});  // p1 disconnected
    expect(pool.getKart('p1')).toBeUndefined();
  });
});
```

**Step 3: Run client tests**
```bash
npm run test -w packages/client
```
Expected: All new tests pass.

**Step 4: Commit**
```bash
git add packages/client/src/game/SceneManager.test.ts packages/client/src/game/KartPool.test.ts
git commit -m "test(client): SceneManager spring-damper tests, KartPool interpolation tests"
```

---

### Task 19: Client tests — AudioManager

**Files:**
- Create: `packages/client/src/game/AudioManager.test.ts`

**Step 1: Write the test**

```typescript
// packages/client/src/game/AudioManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AudioContext
const mockOsc = {
  type: 'sine' as OscillatorType,
  frequency: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
};
const mockGain = {
  gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
  connect: vi.fn(),
  disconnect: vi.fn(),
};
const mockBuffer = { getChannelData: () => new Float32Array(100) };
const mockSource = { buffer: null, connect: vi.fn(), start: vi.fn() };
const mockCtx = {
  state: 'running',
  currentTime: 0,
  sampleRate: 44100,
  createOscillator: vi.fn(() => ({ ...mockOsc })),
  createGain: vi.fn(() => ({ ...mockGain })),
  createBuffer: vi.fn(() => mockBuffer),
  createBufferSource: vi.fn(() => ({ ...mockSource })),
  destination: {},
  resume: vi.fn(),
  close: vi.fn(),
};

vi.stubGlobal('AudioContext', vi.fn(() => mockCtx));

import { AudioManager } from './AudioManager';

describe('AudioManager', () => {
  let audio: AudioManager;

  beforeEach(() => {
    vi.clearAllMocks();
    audio = new AudioManager();
  });

  it('startEngine creates oscillator and gain', () => {
    audio.startEngine();
    expect(mockCtx.createOscillator).toHaveBeenCalledOnce();
    expect(mockCtx.createGain).toHaveBeenCalledOnce();
  });

  it('setEngineRpm updates oscillator frequency', () => {
    audio.startEngine();
    const oscInstance = mockCtx.createOscillator.mock.results[0].value;
    audio.setEngineRpm(0.5);
    expect(oscInstance.frequency.setTargetAtTime).toHaveBeenCalled();
  });

  it('playCountdownBeep creates a short oscillator', () => {
    audio.playCountdownBeep(false);
    expect(mockCtx.createOscillator).toHaveBeenCalled();
  });

  it('playCountdownBeep(true) uses higher frequency (880)', () => {
    audio.playCountdownBeep(true);
    const osc = mockCtx.createOscillator.mock.results[0].value;
    expect(osc.frequency.value).toBe(880);
  });

  it('playHit uses noise buffer', () => {
    audio.playHit();
    expect(mockCtx.createBuffer).toHaveBeenCalled();
    expect(mockCtx.createBufferSource).toHaveBeenCalled();
  });

  it('dispose closes audio context', () => {
    audio.startEngine();
    audio.dispose();
    expect(mockCtx.close).toHaveBeenCalled();
  });
});
```

**Step 2: Run client tests**
```bash
npm run test -w packages/client
```
Expected: All 6 AudioManager tests pass.

**Step 3: Run all tests**
```bash
npm test
```
Expected: All server and client tests pass.

**Step 4: Commit**
```bash
git add packages/client/src/game/AudioManager.test.ts
git commit -m "test(client): AudioManager tests with mocked AudioContext"
```

---

### Task 20: Deploy to Railway and Vercel

**Step 1: Rebuild all packages**
```bash
npm run build
```
Expected: Shared + server build succeeds.

**Step 2: Run all tests before deploying**
```bash
npm test
```
Expected: All tests pass.

**Step 3: Push to GitHub**
```bash
git push origin master
```

**Step 4: Deploy server to Railway**
```bash
railway up --detach
```
Wait for Railway to finish building and deploying. Monitor with:
```bash
railway logs
```

**Step 5: Deploy client to Vercel**
```bash
cd packages/client && npx vercel --prod --yes
```

**Step 6: Smoke-test the deployed game**

Use agent-browser to:
1. Open the Vercel URL
2. Create a room
3. Join with a second tab
4. Start race and verify: countdown plays beeps, cars start at track, lap counter visible
5. Drive and verify: smooth camera, skid marks appear, mini-map shows position
6. Collect item box and verify audio + HUD item slot
7. Complete 3 laps and verify podium screen with times

**Step 7: Final commit**
```bash
git add .
git commit -m "feat: game improvements v2 — laps, powerups, camera, audio, HUD, minimap, podium"
```
