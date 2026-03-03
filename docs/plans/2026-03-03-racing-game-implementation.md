# Online 3D Racing Game — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a browser-based multiplayer 3D arcade racing game (5–8 players, Mario Kart-style) playable instantly via URL, deployed to Vercel (frontend) and Railway (backend).

**Architecture:** React + Vite frontend with Three.js 3D rendering and Cannon-es client-side physics prediction; Node.js + Socket.io backend running authoritative 60Hz game loop with Cannon-es. State reconciliation keeps clients in sync with low latency. No database — sessions are ephemeral.

**Tech Stack:** React 18, Vite, Three.js, Cannon-es, Socket.io, Node.js, Howler.js, npm workspaces monorepo, Vitest (server tests), Playwright (e2e), Vercel CLI, Railway CLI, GitHub CLI.

---

## Phase 1 — Monorepo Scaffolding

### Task 1: Initialize the monorepo

**Files:**
- Create: `package.json` (root)
- Create: `packages/client/package.json`
- Create: `packages/server/package.json`
- Create: `packages/shared/package.json`
- Create: `.gitignore`

**Step 1: Create root package.json**

```json
{
  "name": "online-racing-game",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w packages/server\" \"npm run dev -w packages/client\"",
    "build": "npm run build -w packages/shared && npm run build -w packages/server && npm run build -w packages/client",
    "test": "npm run test -w packages/server"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

**Step 2: Create packages/shared/package.json**

```json
{
  "name": "@racing/shared",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

**Step 3: Create packages/server/package.json**

```json
{
  "name": "@racing/server",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@racing/shared": "*",
    "cannon-es": "^0.20.0",
    "socket.io": "^4.7.4"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "vitest": "^1.3.0"
  }
}
```

**Step 4: Create packages/client/package.json**

```json
{
  "name": "@racing/client",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@racing/shared": "*",
    "cannon-es": "^0.20.0",
    "howler": "^2.2.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "socket.io-client": "^4.7.4",
    "three": "^0.162.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/three": "^0.162.0",
    "@types/howler": "^2.2.11",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.0",
    "vite": "^5.1.0"
  }
}
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
```

**Step 6: Create shared tsconfig**

Create `packages/shared/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "declaration": true,
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

Create `packages/server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "paths": { "@racing/shared": ["../shared/src"] }
  },
  "include": ["src"]
}
```

Create `packages/client/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "paths": { "@racing/shared": ["../shared/src"] }
  },
  "include": ["src"]
}
```

**Step 7: Install dependencies**

```bash
cd /path/to/online-racing-game
npm install
```

Expected: `node_modules/` created at root and all workspace packages linked.

**Step 8: Commit**

```bash
git add package.json packages/ .gitignore
git commit -m "chore: initialize monorepo with npm workspaces"
```

---

### Task 2: Create the shared types package

**Files:**
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/events.ts`

**Step 1: Create types.ts**

```typescript
// packages/shared/src/types.ts

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export type ItemType = 'missile' | 'banana' | 'boost' | 'shield' | 'oil';

export interface PlayerState {
  id: string;
  nickname: string;
  carIndex: number; // 0-4, selects car model/color
  position: Vec3;
  rotation: Quat;
  speed: number;
  heldItem: ItemType | null;
  lap: number;
  lapProgress: number; // 0.0 – 1.0 within current lap
  finished: boolean;
  finishTime: number | null;
}

export interface ItemBoxState {
  id: string;
  position: Vec3;
  active: boolean; // false = respawning
}

export interface ActiveEffect {
  id: string;
  type: ItemType;
  position: Vec3;
  ownerId: string;
}

export interface GameState {
  phase: 'waiting' | 'countdown' | 'racing' | 'finished';
  tick: number;
  countdown: number; // 3, 2, 1, 0
  players: Record<string, PlayerState>;
  itemBoxes: ItemBoxState[];
  activeEffects: ActiveEffect[];
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
  time: number; // ms
}
```

**Step 2: Create constants.ts**

```typescript
// packages/shared/src/constants.ts

export const MAX_PLAYERS = 8;
export const MIN_PLAYERS_TO_START = 2;
export const TOTAL_LAPS = 3;
export const TICK_RATE = 60; // Hz
export const TICK_MS = 1000 / TICK_RATE;

export const ITEM_BOX_RESPAWN_MS = 8000;
export const BOOST_DURATION_MS = 3000;
export const BOOST_MULTIPLIER = 1.4;
export const SHIELD_DURATION_MS = 5000;

export const COUNTDOWN_SECONDS = 3;

export const CAR_MAX_SPEED = 30; // m/s
export const CAR_ACCELERATION = 15;
export const CAR_BRAKE_DECEL = 25;
export const CAR_TURN_SPEED = 2.2; // rad/s at full speed
export const WALL_BOUNCE = 0.3;

// Checkpoint positions along the track (normalized 0–1 progress per lap)
// These are verified against the track geometry in Task 9
export const CHECKPOINT_COUNT = 8;
```

**Step 3: Create events.ts**

```typescript
// packages/shared/src/events.ts
// All Socket.io event names in one place to avoid typos

// Client → Server
export const EV_JOIN_ROOM = 'join_room';
export const EV_CREATE_ROOM = 'create_room';
export const EV_MATCHMAKE = 'matchmake';
export const EV_PLAYER_READY = 'player_ready';
export const EV_START_RACE = 'start_race'; // host only
export const EV_PLAYER_INPUT = 'player_input';
export const EV_USE_ITEM = 'use_item';
export const EV_LEAVE_ROOM = 'leave_room';

// Server → Client
export const EV_ROOM_STATE = 'room_state';
export const EV_GAME_STATE = 'game_state';
export const EV_RACE_STARTED = 'race_started';
export const EV_RACE_FINISHED = 'race_finished';
export const EV_ERROR = 'error';
export const EV_PLAYER_JOINED = 'player_joined';
export const EV_PLAYER_LEFT = 'player_left';
export const EV_COUNTDOWN = 'countdown';
```

**Step 4: Create index.ts barrel**

```typescript
// packages/shared/src/index.ts
export * from './types';
export * from './constants';
export * from './events';
```

**Step 5: Build shared package**

```bash
npm run build -w packages/shared
```

Expected: `packages/shared/dist/` created with `.js` and `.d.ts` files.

**Step 6: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types, constants, and socket event names"
```

---

## Phase 2 — Server

### Task 3: Room manager (create, join, matchmaking)

**Files:**
- Create: `packages/server/src/RoomManager.ts`
- Create: `packages/server/src/Room.ts`
- Test: `packages/server/src/RoomManager.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/server/src/RoomManager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from './RoomManager';

describe('RoomManager', () => {
  let mgr: RoomManager;

  beforeEach(() => {
    mgr = new RoomManager();
  });

  it('creates a private room with a 6-char code', () => {
    const room = mgr.createRoom('player1', 'Test Room', true);
    expect(room.code).toHaveLength(6);
    expect(room.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(room.isPrivate).toBe(true);
  });

  it('lets a second player join by code', () => {
    const room = mgr.createRoom('player1', 'Test Room', true);
    const joined = mgr.joinRoom('player2', room.code);
    expect(joined).not.toBeNull();
    expect(joined!.playerCount).toBe(2);
  });

  it('returns null when joining non-existent room', () => {
    const result = mgr.joinRoom('player1', 'ZZZZZZ');
    expect(result).toBeNull();
  });

  it('rejects join when room is full (8 players)', () => {
    const room = mgr.createRoom('p0', 'Full Room', false);
    for (let i = 1; i < 8; i++) mgr.joinRoom(`p${i}`, room.code);
    const result = mgr.joinRoom('p8', room.code);
    expect(result).toBeNull();
  });

  it('matchmakes into an existing public room', () => {
    mgr.createRoom('player1', 'Public Room', false);
    const room = mgr.matchmake('player2');
    expect(room).not.toBeNull();
    expect(room!.playerCount).toBe(2);
  });

  it('creates a new public room when no public rooms available', () => {
    const room = mgr.matchmake('player1');
    expect(room).not.toBeNull();
    expect(room!.playerCount).toBe(1);
  });

  it('removes player from room on leave', () => {
    const room = mgr.createRoom('player1', 'Room', false);
    mgr.joinRoom('player2', room.code);
    mgr.leaveRoom('player2');
    expect(mgr.getRoom(room.code)!.playerCount).toBe(1);
  });

  it('destroys room when last player leaves', () => {
    const room = mgr.createRoom('player1', 'Room', false);
    mgr.leaveRoom('player1');
    expect(mgr.getRoom(room.code)).toBeNull();
  });
});
```

**Step 2: Run to verify failure**

```bash
npm run test -w packages/server
```

Expected: FAIL — "Cannot find module './RoomManager'"

**Step 3: Implement Room.ts**

```typescript
// packages/server/src/Room.ts
import { MAX_PLAYERS } from '@racing/shared';

export interface RoomPlayer {
  socketId: string;
  nickname: string;
  carIndex: number;
  ready: boolean;
  isHost: boolean;
}

export class Room {
  code: string;
  name: string;
  isPrivate: boolean;
  players: Map<string, RoomPlayer> = new Map();
  phase: 'waiting' | 'countdown' | 'racing' | 'finished' = 'waiting';

  constructor(code: string, name: string, isPrivate: boolean) {
    this.code = code;
    this.name = name;
    this.isPrivate = isPrivate;
  }

  get playerCount() {
    return this.players.size;
  }

  get isFull() {
    return this.players.size >= MAX_PLAYERS;
  }

  addPlayer(socketId: string, nickname: string, isHost = false): RoomPlayer {
    const carIndex = this.players.size % 5;
    const player: RoomPlayer = { socketId, nickname, carIndex, ready: false, isHost };
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId: string): boolean {
    return this.players.delete(socketId);
  }

  getHostId(): string | undefined {
    for (const [id, p] of this.players) {
      if (p.isHost) return id;
    }
  }

  transferHost(): void {
    const first = this.players.keys().next().value;
    if (first) this.players.get(first)!.isHost = true;
  }
}
```

**Step 4: Implement RoomManager.ts**

```typescript
// packages/server/src/RoomManager.ts
import { Room, RoomPlayer } from './Room';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerRoomMap: Map<string, string> = new Map(); // socketId → roomCode

  createRoom(socketId: string, name: string, isPrivate: boolean, nickname = 'Player'): Room {
    let code: string;
    do { code = generateCode(); } while (this.rooms.has(code));

    const room = new Room(code, name, isPrivate);
    room.addPlayer(socketId, nickname, true);
    this.rooms.set(code, room);
    this.playerRoomMap.set(socketId, code);
    return room;
  }

  joinRoom(socketId: string, code: string, nickname = 'Player'): Room | null {
    const room = this.rooms.get(code);
    if (!room || room.isFull || room.phase !== 'waiting') return null;
    room.addPlayer(socketId, nickname);
    this.playerRoomMap.set(socketId, code);
    return room;
  }

  matchmake(socketId: string, nickname = 'Player'): Room | null {
    // Find a non-full public waiting room
    for (const room of this.rooms.values()) {
      if (!room.isPrivate && !room.isFull && room.phase === 'waiting') {
        room.addPlayer(socketId, nickname);
        this.playerRoomMap.set(socketId, code);
        return room;
      }
    }
    // No available room — create one
    return this.createRoom(socketId, 'Public Race', false, nickname);
  }

  leaveRoom(socketId: string): void {
    const code = this.playerRoomMap.get(socketId);
    if (!code) return;
    const room = this.rooms.get(code);
    if (!room) return;

    const wasHost = room.players.get(socketId)?.isHost;
    room.removePlayer(socketId);
    this.playerRoomMap.delete(socketId);

    if (room.playerCount === 0) {
      this.rooms.delete(code);
    } else if (wasHost) {
      room.transferHost();
    }
  }

  getRoom(code: string): Room | null {
    return this.rooms.get(code) ?? null;
  }

  getRoomByPlayer(socketId: string): Room | null {
    const code = this.playerRoomMap.get(socketId);
    return code ? this.getRoom(code) : null;
  }
}
```

Fix the matchmake bug (missing `code` variable):
```typescript
// In matchmake, replace the inner return with:
for (const [code, room] of this.rooms.entries()) {
  if (!room.isPrivate && !room.isFull && room.phase === 'waiting') {
    room.addPlayer(socketId, nickname);
    this.playerRoomMap.set(socketId, code);
    return room;
  }
}
```

**Step 5: Run tests to verify pass**

```bash
npm run test -w packages/server
```

Expected: All 8 tests PASS

**Step 6: Commit**

```bash
git add packages/server/src/Room.ts packages/server/src/RoomManager.ts packages/server/src/RoomManager.test.ts
git commit -m "feat(server): add Room and RoomManager with full test coverage"
```

---

### Task 4: Physics-based game loop (server-authoritative)

**Files:**
- Create: `packages/server/src/physics/PhysicsWorld.ts`
- Create: `packages/server/src/physics/CarBody.ts`
- Create: `packages/server/src/GameLoop.ts`
- Test: `packages/server/src/GameLoop.test.ts`

**Step 1: Write failing tests**

```typescript
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
```

**Step 2: Run to verify failure**

```bash
npm run test -w packages/server
```

Expected: FAIL — "Cannot find module './GameLoop'"

**Step 3: Implement PhysicsWorld.ts**

```typescript
// packages/server/src/physics/PhysicsWorld.ts
import * as CANNON from 'cannon-es';

export function createPhysicsWorld(): CANNON.World {
  const world = new CANNON.World();
  world.gravity.set(0, -20, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;

  // Ground plane
  const groundShape = new CANNON.Plane();
  const ground = new CANNON.Body({ mass: 0 });
  ground.addShape(groundShape);
  ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(ground);

  return world;
}
```

**Step 4: Implement CarBody.ts**

```typescript
// packages/server/src/physics/CarBody.ts
import * as CANNON from 'cannon-es';
import { CAR_MAX_SPEED, CAR_ACCELERATION, CAR_BRAKE_DECEL, CAR_TURN_SPEED } from '@racing/shared';

export interface PlayerInput {
  steer: number;   // -1.0 to 1.0
  throttle: number; // 0 to 1.0
  brake: number;    // 0 to 1.0
  seq: number;
  timestamp: number;
}

const CAR_HALF_EXTENTS = new CANNON.Vec3(0.9, 0.4, 1.8);

export class CarBody {
  body: CANNON.Body;
  private currentSpeed = 0;

  constructor(world: CANNON.World, startPos: CANNON.Vec3) {
    const shape = new CANNON.Box(CAR_HALF_EXTENTS);
    this.body = new CANNON.Body({ mass: 150, linearDamping: 0.4, angularDamping: 0.99 });
    this.body.addShape(shape);
    this.body.position.copy(startPos);
    world.addBody(this.body);
  }

  applyInput(input: PlayerInput, dt: number): void {
    const { throttle, brake, steer } = input;

    // Acceleration / braking
    if (throttle > 0) {
      this.currentSpeed = Math.min(this.currentSpeed + CAR_ACCELERATION * dt * throttle, CAR_MAX_SPEED);
    } else if (brake > 0) {
      this.currentSpeed = Math.max(this.currentSpeed - CAR_BRAKE_DECEL * dt * brake, 0);
    } else {
      // Natural friction
      this.currentSpeed = Math.max(this.currentSpeed - CAR_BRAKE_DECEL * 0.2 * dt, 0);
    }

    // Forward direction from body quaternion
    const forward = new CANNON.Vec3(0, 0, -1);
    this.body.quaternion.vmult(forward, forward);

    // Apply velocity
    this.body.velocity.set(
      forward.x * this.currentSpeed,
      this.body.velocity.y, // preserve gravity
      forward.z * this.currentSpeed
    );

    // Steering — only when moving
    if (this.currentSpeed > 0.5) {
      const turnAmount = -steer * CAR_TURN_SPEED * (this.currentSpeed / CAR_MAX_SPEED) * dt;
      const rot = new CANNON.Quaternion();
      rot.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), turnAmount);
      this.body.quaternion = rot.mult(this.body.quaternion);
    }
  }

  getSpeed(): number {
    return this.currentSpeed;
  }
}
```

**Step 5: Implement GameLoop.ts**

```typescript
// packages/server/src/GameLoop.ts
import * as CANNON from 'cannon-es';
import { GameState, PlayerState, TOTAL_LAPS, TICK_MS, COUNTDOWN_SECONDS, Vec3, Quat } from '@racing/shared';
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
```

**Step 6: Run tests to verify pass**

```bash
npm run test -w packages/server
```

Expected: All tests PASS (RoomManager + GameLoop = 13 tests)

**Step 7: Commit**

```bash
git add packages/server/src/physics/ packages/server/src/GameLoop.ts packages/server/src/GameLoop.test.ts
git commit -m "feat(server): add physics-based authoritative game loop with Cannon-es"
```

---

### Task 5: Power-up system (server-side)

**Files:**
- Create: `packages/server/src/PowerUpManager.ts`
- Test: `packages/server/src/PowerUpManager.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/PowerUpManager.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PowerUpManager } from './PowerUpManager';

// 6 item box positions on the track
const ITEM_BOX_POSITIONS = [
  { x: 0, y: 0.5, z: 0 },
  { x: 20, y: 0.5, z: 10 },
  { x: -20, y: 0.5, z: 10 },
  { x: 30, y: 0.5, z: -30 },
  { x: -30, y: 0.5, z: -30 },
  { x: 0, y: 0.5, z: -60 },
];

describe('PowerUpManager', () => {
  let mgr: PowerUpManager;

  beforeEach(() => {
    mgr = new PowerUpManager(ITEM_BOX_POSITIONS);
  });

  it('initializes all boxes as active', () => {
    expect(mgr.getBoxStates().every(b => b.active)).toBe(true);
  });

  it('awards a random item when player collects a box', () => {
    const result = mgr.collectBox('p1', 0);
    expect(result).not.toBeNull();
    expect(['missile', 'banana', 'boost', 'shield', 'oil']).toContain(result!.item);
  });

  it('deactivates box after collection', () => {
    mgr.collectBox('p1', 0);
    expect(mgr.getBoxStates()[0].active).toBe(false);
  });

  it('reactivates box after ITEM_BOX_RESPAWN_MS', () => {
    mgr.collectBox('p1', 0);
    mgr.tick(8001); // advance past respawn time
    expect(mgr.getBoxStates()[0].active).toBe(true);
  });

  it('launches missile effect when player fires', () => {
    mgr.collectBox('p1', 0);
    mgr.useItem('p1', 'missile', { x: 0, y: 0, z: 0 });
    expect(mgr.getActiveEffects().length).toBe(1);
    expect(mgr.getActiveEffects()[0].type).toBe('missile');
  });

  it('clears player item after use', () => {
    mgr.collectBox('p1', 0);
    const item = mgr.getPlayerItem('p1');
    mgr.useItem('p1', item!, { x: 0, y: 0, z: 0 });
    expect(mgr.getPlayerItem('p1')).toBeNull();
  });
});
```

**Step 2: Run to verify failure**

```bash
npm run test -w packages/server
```

Expected: FAIL — "Cannot find module './PowerUpManager'"

**Step 3: Implement PowerUpManager.ts**

```typescript
// packages/server/src/PowerUpManager.ts
import { ItemType, ItemBoxState, ActiveEffect, Vec3, ITEM_BOX_RESPAWN_MS } from '@racing/shared';

const ITEM_POOL: ItemType[] = ['missile', 'banana', 'boost', 'shield', 'oil'];

function randomItem(): ItemType {
  return ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export class PowerUpManager {
  private boxes: ItemBoxState[];
  private boxRespawnTimers: Map<string, number> = new Map(); // boxId → ms until respawn
  private playerItems: Map<string, ItemType> = new Map();
  private activeEffects: ActiveEffect[] = [];

  constructor(positions: Vec3[]) {
    this.boxes = positions.map((position, i) => ({
      id: `box_${i}`,
      position,
      active: true,
    }));
  }

  collectBox(playerId: string, boxIndex: number): { item: ItemType } | null {
    const box = this.boxes[boxIndex];
    if (!box || !box.active) return null;
    if (this.playerItems.has(playerId)) return null; // already holding item

    const item = randomItem();
    this.playerItems.set(playerId, item);
    box.active = false;
    this.boxRespawnTimers.set(box.id, ITEM_BOX_RESPAWN_MS);
    return { item };
  }

  useItem(playerId: string, item: ItemType, position: Vec3): void {
    if (this.playerItems.get(playerId) !== item) return;
    this.playerItems.delete(playerId);

    if (item === 'missile' || item === 'banana' || item === 'oil') {
      this.activeEffects.push({ id: uid(), type: item, position, ownerId: playerId });
    }
    // boost and shield are handled directly on the player state in GameLoop
  }

  tick(deltaMs: number): void {
    // Tick respawn timers
    for (const [boxId, remaining] of this.boxRespawnTimers) {
      const newRemaining = remaining - deltaMs;
      if (newRemaining <= 0) {
        this.boxRespawnTimers.delete(boxId);
        const box = this.boxes.find(b => b.id === boxId);
        if (box) box.active = true;
      } else {
        this.boxRespawnTimers.set(boxId, newRemaining);
      }
    }

    // Tick active effects (remove missiles after 3s travel, etc.)
    this.activeEffects = this.activeEffects.filter(e => {
      // Simplistic: effects auto-expire after 3 seconds
      // In full implementation, track creation time per effect
      return true; // GameLoop handles collision-based removal
    });
  }

  getBoxStates(): ItemBoxState[] {
    return this.boxes;
  }

  getActiveEffects(): ActiveEffect[] {
    return this.activeEffects;
  }

  getPlayerItem(playerId: string): ItemType | null {
    return this.playerItems.get(playerId) ?? null;
  }

  removeEffect(effectId: string): void {
    this.activeEffects = this.activeEffects.filter(e => e.id !== effectId);
  }
}
```

**Step 4: Run tests to verify pass**

```bash
npm run test -w packages/server
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/server/src/PowerUpManager.ts packages/server/src/PowerUpManager.test.ts
git commit -m "feat(server): add power-up system with item boxes and effects"
```

---

### Task 6: Socket.io server entry point

**Files:**
- Create: `packages/server/src/index.ts`

**Step 1: Implement the Socket.io server**

```typescript
// packages/server/src/index.ts
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { RoomManager } from './RoomManager';
import { GameLoop } from './GameLoop';
import {
  EV_CREATE_ROOM, EV_JOIN_ROOM, EV_MATCHMAKE, EV_PLAYER_READY,
  EV_START_RACE, EV_PLAYER_INPUT, EV_USE_ITEM, EV_LEAVE_ROOM,
  EV_ROOM_STATE, EV_GAME_STATE, EV_ERROR, EV_PLAYER_JOINED,
  EV_PLAYER_LEFT, EV_COUNTDOWN, EV_RACE_FINISHED,
  TICK_MS, MIN_PLAYERS_TO_START,
} from '@racing/shared';
import { PlayerInput } from './physics/CarBody';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL ?? 'http://localhost:5173', methods: ['GET', 'POST'] },
});

const roomManager = new RoomManager();
const gameLoops = new Map<string, { loop: GameLoop; interval: NodeJS.Timeout }>();

function broadcastRoomState(roomCode: string): void {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;
  io.to(roomCode).emit(EV_ROOM_STATE, {
    code: room.code,
    name: room.name,
    players: Array.from(room.players.values()),
    phase: room.phase,
  });
}

function startGameLoop(roomCode: string): void {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const playerIds = Array.from(room.players.keys());
  const loop = new GameLoop(playerIds);
  loop.startCountdown();

  // Broadcast countdown ticks
  let countdownBroadcast = TICK_MS * 60; // start countdown broadcast
  const interval = setInterval(() => {
    loop.tick();
    const state = loop.state;
    io.to(roomCode).emit(EV_GAME_STATE, state);

    if (state.phase === 'finished') {
      clearInterval(interval);
      gameLoops.delete(roomCode);
      io.to(roomCode).emit(EV_RACE_FINISHED, {
        results: Object.values(state.players)
          .filter(p => p.finished)
          .sort((a, b) => (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity)),
      });
    }
  }, TICK_MS);

  gameLoops.set(roomCode, { loop, interval });
}

io.on('connection', (socket: Socket) => {
  console.log(`[+] ${socket.id} connected`);

  socket.on(EV_CREATE_ROOM, ({ nickname, roomName, isPrivate }: { nickname: string; roomName: string; isPrivate: boolean }) => {
    const room = roomManager.createRoom(socket.id, roomName ?? 'Race Room', isPrivate ?? false, nickname);
    socket.join(room.code);
    broadcastRoomState(room.code);
  });

  socket.on(EV_JOIN_ROOM, ({ nickname, code }: { nickname: string; code: string }) => {
    const room = roomManager.joinRoom(socket.id, code.toUpperCase(), nickname);
    if (!room) { socket.emit(EV_ERROR, { message: 'Room not found or full.' }); return; }
    socket.join(room.code);
    io.to(room.code).emit(EV_PLAYER_JOINED, { nickname });
    broadcastRoomState(room.code);
  });

  socket.on(EV_MATCHMAKE, ({ nickname }: { nickname: string }) => {
    const room = roomManager.matchmake(socket.id, nickname);
    if (!room) { socket.emit(EV_ERROR, { message: 'Matchmaking failed.' }); return; }
    socket.join(room.code);
    broadcastRoomState(room.code);
  });

  socket.on(EV_PLAYER_READY, () => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player) player.ready = true;
    broadcastRoomState(room.code);
  });

  socket.on(EV_START_RACE, () => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player?.isHost) { socket.emit(EV_ERROR, { message: 'Only the host can start.' }); return; }
    if (room.playerCount < MIN_PLAYERS_TO_START) { socket.emit(EV_ERROR, { message: 'Need at least 2 players.' }); return; }
    room.phase = 'countdown';
    startGameLoop(room.code);
  });

  socket.on(EV_PLAYER_INPUT, (input: PlayerInput) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) return;
    const entry = gameLoops.get(room.code);
    if (entry) entry.loop.applyInput(socket.id, input);
  });

  socket.on(EV_LEAVE_ROOM, () => handleLeave(socket));
  socket.on('disconnect', () => handleLeave(socket));

  function handleLeave(sock: Socket): void {
    console.log(`[-] ${sock.id} disconnected`);
    const room = roomManager.getRoomByPlayer(sock.id);
    if (room) {
      io.to(room.code).emit(EV_PLAYER_LEFT, { id: sock.id });
    }
    roomManager.leaveRoom(sock.id);
    if (room) broadcastRoomState(room.code);
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

**Step 2: Verify it starts**

```bash
npm run dev -w packages/server
```

Expected: "Server listening on port 3001"

**Step 3: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat(server): add Socket.io server with lobby and game loop integration"
```

---

## Phase 3 — Client

### Task 7: React + Vite project setup

**Files:**
- Create: `packages/client/index.html`
- Create: `packages/client/vite.config.ts`
- Create: `packages/client/src/main.tsx`
- Create: `packages/client/src/App.tsx`

**Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kart Chaos — Online Racing</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #1a0a2e; color: #fff; font-family: 'Segoe UI', sans-serif; overflow: hidden; }
      #root { width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@racing/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
```

**Step 3: Create main.tsx**

```tsx
// packages/client/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 4: Create App.tsx (screen router)**

```tsx
// packages/client/src/App.tsx
import React, { useState } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { PodiumScreen } from './screens/PodiumScreen';
import { SocketProvider } from './network/SocketContext';

export type Screen = 'home' | 'lobby' | 'game' | 'podium';

export interface AppState {
  screen: Screen;
  nickname: string;
  roomCode: string;
}

export default function App() {
  const [appState, setAppState] = useState<AppState>({
    screen: 'home',
    nickname: '',
    roomCode: '',
  });

  const navigate = (screen: Screen, patch: Partial<AppState> = {}) => {
    setAppState(s => ({ ...s, screen, ...patch }));
  };

  return (
    <SocketProvider>
      {appState.screen === 'home' && <HomeScreen navigate={navigate} />}
      {appState.screen === 'lobby' && <LobbyScreen appState={appState} navigate={navigate} />}
      {appState.screen === 'game' && <GameScreen appState={appState} navigate={navigate} />}
      {appState.screen === 'podium' && <PodiumScreen appState={appState} navigate={navigate} />}
    </SocketProvider>
  );
}
```

**Step 5: Run client to verify it starts**

```bash
npm run dev -w packages/client
```

Expected: Vite dev server starts on http://localhost:5173 (will show blank page until screens are added)

**Step 6: Commit**

```bash
git add packages/client/
git commit -m "feat(client): scaffold React + Vite client with screen routing"
```

---

### Task 8: Socket.io client context

**Files:**
- Create: `packages/client/src/network/SocketContext.tsx`
- Create: `packages/client/src/network/useSocket.ts`

**Step 1: Create SocketContext.tsx**

```tsx
// packages/client/src/network/SocketContext.tsx
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);

  if (!socketRef.current) {
    socketRef.current = io(SERVER_URL, { autoConnect: true, transports: ['websocket'] });
  }

  useEffect(() => {
    return () => { socketRef.current?.disconnect(); };
  }, []);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext(): Socket {
  const socket = useContext(SocketContext);
  if (!socket) throw new Error('useSocketContext must be used inside SocketProvider');
  return socket;
}
```

**Step 2: Create useSocket.ts hook**

```typescript
// packages/client/src/network/useSocket.ts
import { useEffect } from 'react';
import { useSocketContext } from './SocketContext';

export function useSocketEvent<T>(event: string, handler: (data: T) => void): void {
  const socket = useSocketContext();
  useEffect(() => {
    socket.on(event, handler);
    return () => { socket.off(event, handler); };
  }, [socket, event, handler]);
}
```

**Step 3: Commit**

```bash
git add packages/client/src/network/
git commit -m "feat(client): add Socket.io context and event hook"
```

---

### Task 9: Three.js scene setup

**Files:**
- Create: `packages/client/src/game/SceneManager.ts`
- Create: `packages/client/src/game/useGameCanvas.ts`

**Step 1: Create SceneManager.ts**

```typescript
// packages/client/src/game/SceneManager.ts
import * as THREE from 'three';

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private animFrameId: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // sky blue
    this.scene.fog = new THREE.Fog(0x87ceeb, 80, 200);

    // Camera (third-person, behind and above car)
    this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
    this.camera.position.set(0, 8, 20);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting — cartoon feel
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

    // Resize observer
    new ResizeObserver(() => this.onResize(canvas)).observe(canvas);
  }

  private onResize(canvas: HTMLCanvasElement): void {
    this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  }

  startRenderLoop(onFrame: (dt: number) => void): void {
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); // cap at 50ms
      last = now;
      onFrame(dt);
      this.renderer.render(this.scene, this.camera);
      this.animFrameId = requestAnimationFrame(frame);
    };
    this.animFrameId = requestAnimationFrame(frame);
  }

  stopRenderLoop(): void {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
  }

  followTarget(targetPos: THREE.Vector3, targetRot: THREE.Quaternion): void {
    // Smoothly place camera behind and above the followed car
    const offset = new THREE.Vector3(0, 5, 12);
    offset.applyQuaternion(targetRot);
    const desiredPos = targetPos.clone().add(offset);
    this.camera.position.lerp(desiredPos, 0.12);
    const lookTarget = targetPos.clone().add(new THREE.Vector3(0, 1, 0));
    this.camera.lookAt(lookTarget);
  }
}
```

**Step 2: Create useGameCanvas.ts hook**

```typescript
// packages/client/src/game/useGameCanvas.ts
import { useEffect, useRef } from 'react';
import { SceneManager } from './SceneManager';

export function useGameCanvas(onInit: (mgr: SceneManager) => () => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mgr = new SceneManager(canvas);
    const cleanup = onInit(mgr);
    return () => { cleanup(); mgr.stopRenderLoop(); mgr.renderer.dispose(); };
  }, []);

  return canvasRef;
}
```

**Step 3: Commit**

```bash
git add packages/client/src/game/
git commit -m "feat(client): add Three.js scene manager with lighting and follow-camera"
```

---

### Task 10: Track geometry (cartoon city circuit)

**Files:**
- Create: `packages/client/src/game/Track.ts`

**Step 1: Create Track.ts**

```typescript
// packages/client/src/game/Track.ts
import * as THREE from 'three';

// Road uses a CatmullRomCurve3 path extruded into a TubeGeometry (road surface)
// Track is a roughly oval circuit in a cartoon city theme

const TRACK_POINTS = [
  new THREE.Vector3(0, 0, 60),
  new THREE.Vector3(40, 0, 50),
  new THREE.Vector3(70, 0, 20),
  new THREE.Vector3(70, 0, -30),
  new THREE.Vector3(40, 0, -60),
  new THREE.Vector3(0, 0, -75),
  new THREE.Vector3(-40, 0, -60),
  new THREE.Vector3(-70, 0, -30),
  new THREE.Vector3(-70, 0, 20),
  new THREE.Vector3(-40, 0, 50),
  new THREE.Vector3(0, 0, 60),
];

const ROAD_WIDTH = 14;
const ROAD_COLOR = 0x333344;
const MARKING_COLOR = 0xffee00;
const CURB_COLOR_A = 0xff2222;
const CURB_COLOR_B = 0xffffff;

export function createTrack(scene: THREE.Scene): THREE.CatmullRomCurve3 {
  const curve = new THREE.CatmullRomCurve3(TRACK_POINTS, true);

  // Road surface
  const roadGeo = new THREE.TubeGeometry(curve, 200, ROAD_WIDTH / 2, 4, true);
  const roadMat = new THREE.MeshToonMaterial({ color: ROAD_COLOR });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = Math.PI / 2;
  road.receiveShadow = true;
  scene.add(road);

  // Center dashed lines (simple box markers)
  const dashCount = 40;
  for (let i = 0; i < dashCount; i++) {
    const t = i / dashCount;
    const pt = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const dashGeo = new THREE.BoxGeometry(0.4, 0.05, 3);
    const dashMat = new THREE.MeshToonMaterial({ color: MARKING_COLOR });
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.position.set(pt.x, 0.05, pt.z);
    dash.lookAt(pt.x + tangent.x, 0.05, pt.z + tangent.z);
    scene.add(dash);
  }

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(300, 300);
  const groundMat = new THREE.MeshToonMaterial({ color: 0x4caf50 }); // cartoon green
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  // Cartoon city buildings (simple boxes along the outer edge)
  addBuildings(scene);

  // Palm trees
  addTrees(scene);

  return curve;
}

function addBuildings(scene: THREE.Scene): void {
  const BUILDING_COLORS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0x6c5ce7];
  const positions = [
    [100, 0], [-100, 0], [100, -80], [-100, -80],
    [30, 90], [-30, 90], [90, -100], [-90, -100],
  ];
  positions.forEach(([x, z], i) => {
    const w = 10 + Math.random() * 15;
    const h = 15 + Math.random() * 30;
    const d = 10 + Math.random() * 15;
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshToonMaterial({ color: BUILDING_COLORS[i % BUILDING_COLORS.length] });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    scene.add(mesh);
  });
}

function addTrees(scene: THREE.Scene): void {
  const trunkMat = new THREE.MeshToonMaterial({ color: 0x8b6914 });
  const leafMat = new THREE.MeshToonMaterial({ color: 0x27ae60 });
  const positions = [[85, 5], [-85, 5], [85, -50], [-85, -50], [20, 75], [-20, 75]];
  positions.forEach(([x, z]) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 4), trunkMat);
    trunk.position.set(x, 2, z);
    scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(3, 6, 6), leafMat);
    leaves.position.set(x, 7, z);
    scene.add(leaves);
  });
}
```

**Step 2: Commit**

```bash
git add packages/client/src/game/Track.ts
git commit -m "feat(client): add cartoon city circuit track geometry"
```

---

### Task 11: Car models (5 low-poly karts)

**Files:**
- Create: `packages/client/src/game/KartMesh.ts`
- Create: `packages/client/src/game/KartPool.ts`

**Step 1: Create KartMesh.ts**

```typescript
// packages/client/src/game/KartMesh.ts
import * as THREE from 'three';

const CAR_COLORS = [0xff4444, 0x4444ff, 0x44ff44, 0xffaa00, 0xcc44cc];
const WHEEL_COLOR = 0x222222;

export function createKartMesh(carIndex: number): THREE.Group {
  const group = new THREE.Group();
  const bodyColor = CAR_COLORS[carIndex % CAR_COLORS.length];

  // Body
  const bodyGeo = new THREE.BoxGeometry(1.8, 0.7, 3.2);
  const bodyMat = new THREE.MeshToonMaterial({ color: bodyColor });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6;
  body.castShadow = true;
  group.add(body);

  // Cockpit bump
  const cockpitGeo = new THREE.BoxGeometry(1.2, 0.5, 1.4);
  const cockpitMat = new THREE.MeshToonMaterial({ color: bodyColor });
  const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
  cockpit.position.set(0, 1.15, 0.3);
  group.add(cockpit);

  // Windshield (tinted)
  const windshieldGeo = new THREE.BoxGeometry(1.1, 0.4, 0.1);
  const windshieldMat = new THREE.MeshToonMaterial({ color: 0x88ccff, transparent: true, opacity: 0.7 });
  const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
  windshield.position.set(0, 1.2, -0.3);
  windshield.rotation.x = -0.3;
  group.add(windshield);

  // Wheels (4 corners)
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 8);
  const wheelMat = new THREE.MeshToonMaterial({ color: WHEEL_COLOR });
  const wheelPositions = [
    [1.1, 0.42, 1.1], [-1.1, 0.42, 1.1],
    [1.1, 0.42, -1.1], [-1.1, 0.42, -1.1],
  ];
  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    group.add(wheel);
  });

  // Spoiler
  const spoilerGeo = new THREE.BoxGeometry(1.6, 0.15, 0.5);
  const spoilerMat = new THREE.MeshToonMaterial({ color: 0x222222 });
  const spoiler = new THREE.Mesh(spoilerGeo, spoilerMat);
  spoiler.position.set(0, 1.2, 1.5);
  group.add(spoiler);

  return group;
}
```

**Step 2: Create KartPool.ts**

```typescript
// packages/client/src/game/KartPool.ts
import * as THREE from 'three';
import { PlayerState } from '@racing/shared';
import { createKartMesh } from './KartMesh';

export class KartPool {
  private karts: Map<string, THREE.Group> = new Map();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  syncPlayers(players: Record<string, PlayerState>): void {
    const currentIds = new Set(Object.keys(players));

    // Add new karts
    for (const [id, player] of Object.entries(players)) {
      if (!this.karts.has(id)) {
        const kart = createKartMesh(player.carIndex);
        this.scene.add(kart);
        this.karts.set(id, kart);
      }
    }

    // Remove stale karts
    for (const [id, kart] of this.karts) {
      if (!currentIds.has(id)) {
        this.scene.remove(kart);
        this.karts.delete(id);
      }
    }

    // Update positions/rotations
    for (const [id, player] of Object.entries(players)) {
      const kart = this.karts.get(id);
      if (!kart) continue;
      kart.position.set(player.position.x, player.position.y, player.position.z);
      kart.quaternion.set(player.rotation.x, player.rotation.y, player.rotation.z, player.rotation.w);
    }
  }

  getKart(playerId: string): THREE.Group | undefined {
    return this.karts.get(playerId);
  }

  dispose(): void {
    for (const kart of this.karts.values()) this.scene.remove(kart);
    this.karts.clear();
  }
}
```

**Step 3: Commit**

```bash
git add packages/client/src/game/KartMesh.ts packages/client/src/game/KartPool.ts
git commit -m "feat(client): add low-poly cartoon kart meshes with 5 color variants"
```

---

### Task 12: Client physics prediction

**Files:**
- Create: `packages/client/src/game/ClientPhysics.ts`

**Step 1: Create ClientPhysics.ts**

```typescript
// packages/client/src/game/ClientPhysics.ts
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { CAR_MAX_SPEED, CAR_ACCELERATION, CAR_BRAKE_DECEL, CAR_TURN_SPEED } from '@racing/shared';

export interface InputFrame {
  seq: number;
  steer: number;
  throttle: number;
  brake: number;
  timestamp: number;
}

// Mirrors server CarBody exactly for prediction
export class ClientPhysics {
  private world: CANNON.World;
  private body: CANNON.Body;
  private currentSpeed = 0;
  private inputBuffer: InputFrame[] = [];

  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -20, 0);

    const ground = new CANNON.Body({ mass: 0 });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(ground);

    this.body = new CANNON.Body({ mass: 150, linearDamping: 0.4, angularDamping: 0.99 });
    this.body.addShape(new CANNON.Box(new CANNON.Vec3(0.9, 0.4, 1.8)));
    this.body.position.set(0, 1, 10);
    this.world.addBody(this.body);
  }

  applyInput(frame: InputFrame, dt: number): void {
    const { throttle, brake, steer } = frame;
    if (throttle > 0) {
      this.currentSpeed = Math.min(this.currentSpeed + CAR_ACCELERATION * dt * throttle, CAR_MAX_SPEED);
    } else if (brake > 0) {
      this.currentSpeed = Math.max(this.currentSpeed - CAR_BRAKE_DECEL * dt * brake, 0);
    } else {
      this.currentSpeed = Math.max(this.currentSpeed - CAR_BRAKE_DECEL * 0.2 * dt, 0);
    }

    const forward = new CANNON.Vec3(0, 0, -1);
    this.body.quaternion.vmult(forward, forward);
    this.body.velocity.set(forward.x * this.currentSpeed, this.body.velocity.y, forward.z * this.currentSpeed);

    if (this.currentSpeed > 0.5) {
      const turnAmount = -steer * CAR_TURN_SPEED * (this.currentSpeed / CAR_MAX_SPEED) * dt;
      const rot = new CANNON.Quaternion();
      rot.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), turnAmount);
      this.body.quaternion = rot.mult(this.body.quaternion);
    }
  }

  tick(frame: InputFrame, dt: number): void {
    this.inputBuffer.push(frame);
    if (this.inputBuffer.length > 120) this.inputBuffer.shift(); // keep last 2 seconds
    this.applyInput(frame, dt);
    this.world.step(dt);
  }

  reconcile(serverPos: CANNON.Vec3, serverQuat: CANNON.Quaternion, serverSeq: number, dt: number): void {
    // Snap to server position, then re-apply buffered inputs after serverSeq
    this.body.position.copy(serverPos);
    this.body.quaternion.copy(serverQuat);
    this.currentSpeed = 0; // reset — will rebuild from re-applied inputs

    const pendingInputs = this.inputBuffer.filter(f => f.seq > serverSeq);
    for (const frame of pendingInputs) {
      this.applyInput(frame, dt);
      this.world.step(dt);
    }
  }

  getPosition(): THREE.Vector3 {
    return new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
  }

  getQuaternion(): THREE.Quaternion {
    const q = this.body.quaternion;
    return new THREE.Quaternion(q.x, q.y, q.z, q.w);
  }

  setPosition(x: number, y: number, z: number): void {
    this.body.position.set(x, y, z);
  }
}
```

**Step 2: Commit**

```bash
git add packages/client/src/game/ClientPhysics.ts
git commit -m "feat(client): add client-side physics prediction with server reconciliation"
```

---

### Task 13: Input handler

**Files:**
- Create: `packages/client/src/game/InputHandler.ts`

**Step 1: Create InputHandler.ts**

```typescript
// packages/client/src/game/InputHandler.ts

export interface GameInput {
  steer: number;   // -1 to 1
  throttle: number; // 0 to 1
  brake: number;    // 0 to 1
  useItem: boolean;
}

export class InputHandler {
  private keys: Set<string> = new Set();
  private _useItemPressed = false;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === 'Space') this._useItemPressed = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  getInput(): GameInput {
    const left = this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const right = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    const gas = this.keys.has('ArrowUp') || this.keys.has('KeyW');
    const brake = this.keys.has('ArrowDown') || this.keys.has('KeyS');

    const useItem = this._useItemPressed;
    this._useItemPressed = false; // consume

    return {
      steer: left ? -1 : right ? 1 : 0,
      throttle: gas ? 1 : 0,
      brake: brake ? 1 : 0,
      useItem,
    };
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
```

**Step 2: Commit**

```bash
git add packages/client/src/game/InputHandler.ts
git commit -m "feat(client): add keyboard input handler (WASD + arrows + space)"
```

---

### Task 14: Item box visual effects

**Files:**
- Create: `packages/client/src/game/ItemBoxes.ts`
- Create: `packages/client/src/game/ParticleSystem.ts`

**Step 1: Create ItemBoxes.ts**

```typescript
// packages/client/src/game/ItemBoxes.ts
import * as THREE from 'three';
import { ItemBoxState } from '@racing/shared';

const ITEM_POSITIONS: { x: number; y: number; z: number }[] = [
  { x: 0, y: 0.8, z: 40 }, { x: 50, y: 0.8, z: 10 }, { x: -50, y: 0.8, z: 10 },
  { x: 40, y: 0.8, z: -50 }, { x: -40, y: 0.8, z: -50 }, { x: 0, y: 0.8, z: -65 },
];

export function createItemBoxes(scene: THREE.Scene): THREE.Mesh[] {
  const boxes: THREE.Mesh[] = [];
  ITEM_POSITIONS.forEach(pos => {
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

**Step 2: Create ParticleSystem.ts**

```typescript
// packages/client/src/game/ParticleSystem.ts
import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  burst(position: THREE.Vector3, color: number, count = 12): void {
    const geo = new THREE.SphereGeometry(0.2, 4, 4);
    const mat = new THREE.MeshToonMaterial({ color });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo.clone(), mat.clone());
      mesh.position.copy(position);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          Math.random() * 8 + 2,
          (Math.random() - 0.5) * 10,
        ),
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
      });
    }
  }

  tick(dt: number): void {
    this.particles = this.particles.filter(p => {
      p.life += dt;
      p.velocity.y -= 15 * dt; // gravity
      p.mesh.position.addScaledVector(p.velocity, dt);
      const t = p.life / p.maxLife;
      p.mesh.scale.setScalar(1 - t);
      if (p.life >= p.maxLife) { this.scene.remove(p.mesh); return false; }
      return true;
    });
  }
}
```

**Step 3: Commit**

```bash
git add packages/client/src/game/ItemBoxes.ts packages/client/src/game/ParticleSystem.ts
git commit -m "feat(client): add animated item boxes and particle burst system"
```

---

### Task 15: HUD overlay (position, lap, item, minimap)

**Files:**
- Create: `packages/client/src/components/HUD.tsx`

**Step 1: Create HUD.tsx**

```tsx
// packages/client/src/components/HUD.tsx
import React, { useEffect, useRef } from 'react';
import { GameState, PlayerState, ItemType, TOTAL_LAPS } from '@racing/shared';

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
      {/* Position */}
      <div style={{
        position: 'absolute', top: 20, left: 20,
        background: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: '8px 18px',
        fontSize: 36, fontWeight: 'bold', color: '#fff', letterSpacing: 2,
      }}>
        {pos}<span style={{ fontSize: 18 }}>/{totalPlayers}</span>
      </div>

      {/* Lap counter */}
      <div style={{
        position: 'absolute', top: 20, right: 20,
        background: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: '8px 18px',
        fontSize: 22, fontWeight: 'bold', color: '#fff',
      }}>
        LAP {Math.min(me.lap, TOTAL_LAPS)}/{TOTAL_LAPS}
      </div>

      {/* Held item */}
      <div style={{
        position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.65)', borderRadius: 16, padding: '10px 24px',
        fontSize: 48, minWidth: 80, textAlign: 'center',
      }}>
        {me.heldItem ? ITEM_EMOJI[me.heldItem] : '·'}
      </div>

      {/* Speed */}
      <div style={{
        position: 'absolute', bottom: 40, right: 20,
        background: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: '8px 18px',
        fontSize: 20, color: '#7fffb0',
      }}>
        {Math.round(me.speed * 3.6)} km/h
      </div>

      {/* Countdown overlay */}
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

      {/* Controls hint */}
      <div style={{
        position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.45)', fontSize: 12,
      }}>
        WASD / Arrow keys · SPACE = use item
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/client/src/components/HUD.tsx
git commit -m "feat(client): add race HUD with position, laps, item slot, speed, countdown"
```

---

### Task 16: Home screen

**Files:**
- Create: `packages/client/src/screens/HomeScreen.tsx`

**Step 1: Create HomeScreen.tsx**

```tsx
// packages/client/src/screens/HomeScreen.tsx
import React, { useState } from 'react';
import { useSocketContext } from '../network/SocketContext';
import { useSocketEvent } from '../network/useSocket';
import { EV_CREATE_ROOM, EV_JOIN_ROOM, EV_MATCHMAKE, EV_ROOM_STATE } from '@racing/shared';
import { AppState, Screen } from '../App';

interface Props {
  navigate: (screen: Screen, patch?: Partial<AppState>) => void;
}

export function HomeScreen({ navigate }: Props) {
  const socket = useSocketContext();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');

  useSocketEvent<any>(EV_ROOM_STATE, (data) => {
    navigate('lobby', { nickname, roomCode: data.code });
  });

  useSocketEvent<any>('error', (data) => {
    setError(data.message);
  });

  const validNick = nickname.trim().length >= 2;

  const createRoom = () => {
    if (!validNick) { setError('Enter a nickname (min 2 chars)'); return; }
    socket.emit(EV_CREATE_ROOM, { nickname: nickname.trim(), roomName: `${nickname.trim()}'s Race`, isPrivate: false });
  };

  const joinRoom = () => {
    if (!validNick) { setError('Enter a nickname'); return; }
    if (roomCode.trim().length !== 6) { setError('Enter a 6-character room code'); return; }
    socket.emit(EV_JOIN_ROOM, { nickname: nickname.trim(), code: roomCode.trim().toUpperCase() });
  };

  const matchmake = () => {
    if (!validNick) { setError('Enter a nickname'); return; }
    socket.emit(EV_MATCHMAKE, { nickname: nickname.trim() });
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'linear-gradient(135deg, #1a0a2e 0%, #0d2050 100%)',
      gap: 20,
    }}>
      {/* Title */}
      <h1 style={{
        fontSize: 72, fontWeight: 900, letterSpacing: 4,
        color: '#FFE44D', textShadow: '0 0 40px #ff8800, 6px 6px 0 #aa2200',
        marginBottom: 10,
      }}>
        KART CHAOS
      </h1>
      <p style={{ color: '#aaa', fontSize: 16, marginBottom: 20 }}>Online 3D Racing · 5–8 Players</p>

      {/* Nickname input */}
      <input
        placeholder="Your nickname..."
        value={nickname}
        onChange={e => { setNickname(e.target.value); setError(''); }}
        maxLength={16}
        style={{
          padding: '12px 24px', fontSize: 20, borderRadius: 12, border: '2px solid #444',
          background: '#111', color: '#fff', width: 320, outline: 'none',
        }}
      />

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button color="#ff4444" onClick={createRoom}>🏁 Create Room</Button>
        <Button color="#4444ff" onClick={matchmake}>⚡ Quick Race</Button>
      </div>

      {/* Join with code */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          placeholder="Room code..."
          value={roomCode}
          onChange={e => setRoomCode(e.target.value.toUpperCase())}
          maxLength={6}
          style={{
            padding: '10px 16px', fontSize: 18, borderRadius: 10, border: '2px solid #555',
            background: '#111', color: '#fff', width: 160, letterSpacing: 4, outline: 'none',
          }}
        />
        <Button color="#44aa44" onClick={joinRoom}>Join</Button>
      </div>

      {error && <p style={{ color: '#ff6666', fontSize: 14 }}>{error}</p>}

      <p style={{ color: '#555', fontSize: 12, marginTop: 30 }}>
        Arrow keys / WASD to drive · SPACE to use item
      </p>
    </div>
  );
}

function Button({ children, onClick, color }: { children: React.ReactNode; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 28px', fontSize: 18, fontWeight: 'bold', borderRadius: 12,
        border: 'none', background: color, color: '#fff', cursor: 'pointer',
        boxShadow: `0 4px 0 #0004`, transition: 'transform 0.1s',
      }}
      onMouseDown={e => (e.currentTarget.style.transform = 'translateY(2px)')}
      onMouseUp={e => (e.currentTarget.style.transform = '')}
    >
      {children}
    </button>
  );
}
```

**Step 2: Commit**

```bash
git add packages/client/src/screens/HomeScreen.tsx
git commit -m "feat(client): add home screen with create/join/matchmake"
```

---

### Task 17: Lobby screen

**Files:**
- Create: `packages/client/src/screens/LobbyScreen.tsx`

**Step 1: Create LobbyScreen.tsx**

```tsx
// packages/client/src/screens/LobbyScreen.tsx
import React, { useState } from 'react';
import { useSocketContext } from '../network/SocketContext';
import { useSocketEvent } from '../network/useSocket';
import { EV_PLAYER_READY, EV_START_RACE, EV_ROOM_STATE, EV_RACE_STARTED } from '@racing/shared';
import { AppState, Screen } from '../App';

interface Props {
  appState: AppState;
  navigate: (screen: Screen, patch?: Partial<AppState>) => void;
}

interface RoomStateData {
  code: string;
  name: string;
  players: { socketId: string; nickname: string; ready: boolean; isHost: boolean }[];
  phase: string;
}

export function LobbyScreen({ appState, navigate }: Props) {
  const socket = useSocketContext();
  const [roomState, setRoomState] = useState<RoomStateData | null>(null);
  const [ready, setReady] = useState(false);

  useSocketEvent<RoomStateData>(EV_ROOM_STATE, setRoomState);

  useSocketEvent<any>(EV_RACE_STARTED, () => {
    navigate('game');
  });

  const myPlayer = roomState?.players.find(p => p.socketId === socket.id);
  const isHost = myPlayer?.isHost ?? false;

  const handleReady = () => {
    if (ready) return;
    socket.emit(EV_PLAYER_READY);
    setReady(true);
  };

  const handleStart = () => {
    socket.emit(EV_START_RACE);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'linear-gradient(135deg, #0d2050 0%, #1a0a2e 100%)',
      gap: 20, color: '#fff',
    }}>
      <h2 style={{ fontSize: 36, color: '#FFE44D' }}>Waiting Room</h2>

      {roomState && (
        <div style={{
          background: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 32px',
          fontSize: 18, letterSpacing: 3, color: '#adf',
        }}>
          Room Code: <strong style={{ fontSize: 28, color: '#FFE44D' }}>{roomState.code}</strong>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 320 }}>
        {roomState?.players.map(p => (
          <div key={p.socketId} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 18px',
          }}>
            <span>{p.isHost ? '👑 ' : '  '}{p.nickname}</span>
            <span style={{ color: p.ready ? '#44ff88' : '#ff6644' }}>
              {p.ready ? '✓ Ready' : 'Not ready'}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
        {!ready && (
          <button onClick={handleReady} style={btnStyle('#44aa44')}>
            ✓ Ready Up
          </button>
        )}
        {isHost && (
          <button onClick={handleStart} style={btnStyle('#ff4444')}>
            🏁 Start Race
          </button>
        )}
      </div>

      <p style={{ color: '#555', fontSize: 13 }}>Share the room code with friends!</p>
    </div>
  );
}

const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '12px 28px', fontSize: 18, fontWeight: 'bold', borderRadius: 12,
  border: 'none', background: bg, color: '#fff', cursor: 'pointer',
});
```

**Step 2: Commit**

```bash
git add packages/client/src/screens/LobbyScreen.tsx
git commit -m "feat(client): add lobby screen with ready-up and host start"
```

---

### Task 18: Game screen (main race view)

**Files:**
- Create: `packages/client/src/screens/GameScreen.tsx`

**Step 1: Create GameScreen.tsx**

```tsx
// packages/client/src/screens/GameScreen.tsx
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { useSocketContext } from '../network/SocketContext';
import { useSocketEvent } from '../network/useSocket';
import { SceneManager } from '../game/SceneManager';
import { KartPool } from '../game/KartPool';
import { ClientPhysics } from '../game/ClientPhysics';
import { InputHandler } from '../game/InputHandler';
import { createTrack } from '../game/Track';
import { createItemBoxes, syncItemBoxes, animateItemBoxes } from '../game/ItemBoxes';
import { ParticleSystem } from '../game/ParticleSystem';
import { HUD } from '../components/HUD';
import {
  EV_GAME_STATE, EV_PLAYER_INPUT, EV_USE_ITEM, EV_RACE_FINISHED,
  GameState, TICK_MS,
} from '@racing/shared';
import { AppState, Screen } from '../App';

interface Props {
  appState: AppState;
  navigate: (screen: Screen, patch?: Partial<AppState>) => void;
}

export function GameScreen({ appState, navigate }: Props) {
  const socket = useSocketContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const stateRef = useRef<GameState | null>(null);

  useSocketEvent<GameState>(EV_GAME_STATE, (state) => {
    setGameState(state);
    stateRef.current = state;
  });

  useSocketEvent<any>(EV_RACE_FINISHED, (data) => {
    navigate('podium', { ...appState });
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new SceneManager(canvas);
    const kartPool = new KartPool(scene.scene);
    const clientPhysics = new ClientPhysics();
    const inputHandler = new InputHandler();
    const particles = new ParticleSystem(scene.scene);
    const itemBoxes = createItemBoxes(scene.scene);
    createTrack(scene.scene);

    let seq = 0;
    let lastServerSeq = 0;

    // Send input to server at tick rate
    const inputInterval = setInterval(() => {
      const input = inputHandler.getInput();
      const frame = {
        seq: ++seq,
        steer: input.steer,
        throttle: input.throttle,
        brake: input.brake,
        timestamp: Date.now(),
      };
      socket.emit(EV_PLAYER_INPUT, frame);
      if (input.useItem) socket.emit(EV_USE_ITEM);

      // Apply locally for prediction
      clientPhysics.tick(frame, TICK_MS / 1000);
    }, TICK_MS);

    let elapsed = 0;
    scene.startRenderLoop((dt) => {
      elapsed += dt;
      const state = stateRef.current;
      if (!state) return;

      // Sync other players' karts from server state
      kartPool.syncPlayers(state.players);

      // Update our own kart to predicted position
      const myKart = kartPool.getKart(socket.id);
      if (myKart) {
        const pos = clientPhysics.getPosition();
        const quat = clientPhysics.getQuaternion();
        myKart.position.copy(pos);
        myKart.quaternion.copy(quat);
        scene.followTarget(pos, quat);
      }

      // Animate item boxes
      animateItemBoxes(itemBoxes, elapsed);
      if (state.itemBoxes.length > 0) syncItemBoxes(itemBoxes, state.itemBoxes);

      // Tick particles
      particles.tick(dt);
    });

    return () => {
      clearInterval(inputInterval);
      scene.stopRenderLoop();
      kartPool.dispose();
      inputHandler.dispose();
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {gameState && <HUD state={gameState} myId={socket.id} />}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/client/src/screens/GameScreen.tsx
git commit -m "feat(client): add main game screen with 3D race view and server sync"
```

---

### Task 19: Podium screen

**Files:**
- Create: `packages/client/src/screens/PodiumScreen.tsx`

**Step 1: Create PodiumScreen.tsx**

```tsx
// packages/client/src/screens/PodiumScreen.tsx
import React from 'react';
import { AppState, Screen } from '../App';

interface Props {
  appState: AppState;
  navigate: (screen: Screen, patch?: Partial<AppState>) => void;
}

// Temporary — results will come from race_finished event in full impl
const MEDALS = ['🥇', '🥈', '🥉'];

export function PodiumScreen({ appState, navigate }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'linear-gradient(135deg, #1a0a2e 0%, #0a2010 100%)',
      color: '#fff', gap: 28,
    }}>
      <h1 style={{ fontSize: 64, color: '#FFE44D', textShadow: '0 0 30px #ff8800' }}>
        🏆 Race Finished!
      </h1>

      <div style={{ fontSize: 22, color: '#aaa' }}>
        Great race, {appState.nickname}!
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 20 }}>
        <button
          onClick={() => navigate('lobby', appState)}
          style={{
            padding: '14px 32px', fontSize: 20, fontWeight: 'bold',
            borderRadius: 12, border: 'none', background: '#4444ff',
            color: '#fff', cursor: 'pointer',
          }}
        >
          🔁 Race Again
        </button>
        <button
          onClick={() => navigate('home')}
          style={{
            padding: '14px 32px', fontSize: 20, fontWeight: 'bold',
            borderRadius: 12, border: 'none', background: '#333',
            color: '#fff', cursor: 'pointer',
          }}
        >
          🏠 Home
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/client/src/screens/PodiumScreen.tsx
git commit -m "feat(client): add podium screen with race again / home options"
```

---

## Phase 4 — Deployment

### Task 20: GitHub repository setup

**Files:** None (uses GitHub CLI)

**Step 1: Ensure you're in the project root**

```bash
pwd
# Should output: /path/to/online-racing-game
```

**Step 2: Invoke gh-repo-setup skill**

Follow the `gh-repo-setup` skill from this point. Key parameters:
- Repo name: `online-racing-game`
- Visibility: **Public**
- Description: "Browser-based 3D multiplayer arcade racing game — Mario Kart style"

The skill will handle `git remote add origin`, `git push`, and branch setup.

**Step 3: Verify**

```bash
gh repo view --web
```

Expected: Browser opens to the GitHub repo page showing all committed files.

---

### Task 21: Environment configuration

**Files:**
- Create: `packages/client/.env.example`
- Create: `packages/server/.env.example`

**Step 1: Create client env example**

```bash
# packages/client/.env.example
VITE_SERVER_URL=https://your-railway-server.up.railway.app
```

**Step 2: Create server env example**

```bash
# packages/server/.env.example
PORT=3001
CLIENT_URL=https://your-vercel-app.vercel.app
```

**Step 3: Commit env examples**

```bash
git add packages/client/.env.example packages/server/.env.example
git commit -m "chore: add environment variable examples for deployment"
git push
```

---

### Task 22: Railway server deployment

**Files:** None (Railway CLI + skill)

**Step 1: Install Railway CLI if not present**

```bash
npm install -g @railway/cli
railway login
```

**Step 2: Invoke deploy-railway skill**

Follow the `deploy-railway` skill. Key parameters:
- Service: `packages/server`
- Start command: `node dist/index.js`
- Build command: `npm run build -w packages/shared && npm run build -w packages/server`
- Environment variable: `CLIENT_URL` = your Vercel URL (set after Vercel deploy)

**Step 3: Note the Railway URL**

Railway will assign a URL like: `https://online-racing-game-production.up.railway.app`

Copy this URL — you'll need it for the Vercel environment variable.

---

### Task 23: Vercel frontend deployment

**Files:** None (Vercel CLI + skill)

**Step 1: Invoke deploy-vercel skill**

Follow the `deploy-vercel` skill. Key parameters:
- Service: `packages/client`
- Build command: `npm run build -w packages/shared && npm run build -w packages/client`
- Output directory: `packages/client/dist`
- Environment variable: `VITE_SERVER_URL` = your Railway URL from Task 22

**Step 2: Cross-link the Railway environment variable**

After Vercel assigns a URL (e.g., `https://online-racing-game.vercel.app`), update Railway:
```bash
railway variables set CLIENT_URL=https://online-racing-game.vercel.app
```

**Step 3: Trigger a redeploy on Railway**

```bash
railway up
```

**Step 4: Verify end-to-end**

1. Open the Vercel URL in two browser tabs
2. In Tab 1: enter a nickname → Create Room
3. Note the 6-character room code shown in lobby
4. In Tab 2: enter a different nickname → paste room code → Join
5. Both tabs should show each other in the lobby
6. Tab 1 (host): click Start Race
7. Both tabs should transition to the 3D race scene

Expected: Both players' karts visible, moving independently with low latency.

---

## Summary of Commit History Expected

```
chore: initialize monorepo with npm workspaces
feat: add shared types, constants, and socket event names
feat(server): add Room and RoomManager with full test coverage
feat(server): add physics-based authoritative game loop with Cannon-es
feat(server): add power-up system with item boxes and effects
feat(server): add Socket.io server with lobby and game loop integration
feat(client): scaffold React + Vite client with screen routing
feat(client): add Socket.io context and event hook
feat(client): add Three.js scene manager with lighting and follow-camera
feat(client): add cartoon city circuit track geometry
feat(client): add low-poly cartoon kart meshes with 5 color variants
feat(client): add client-side physics prediction with server reconciliation
feat(client): add keyboard input handler (WASD + arrows + space)
feat(client): add animated item boxes and particle burst system
feat(client): add race HUD with position, laps, item slot, speed, countdown
feat(client): add home screen with create/join/matchmake
feat(client): add lobby screen with ready-up and host start
feat(client): add main game screen with 3D race view and server sync
feat(client): add podium screen with race again / home options
chore: add environment variable examples for deployment
```

---

## Testing Checklist (manual, before deploying)

Run both server and client locally:

```bash
npm run dev
```

- [ ] Home screen loads, no console errors
- [ ] Creating a room issues a 6-char code
- [ ] Second player can join via code
- [ ] Matchmaking places both players in same room
- [ ] Ready-up buttons work; host can start race
- [ ] 3-2-1 countdown appears and transitions to racing
- [ ] All 5 power-up types can be collected and used
- [ ] Camera follows the local player's kart smoothly
- [ ] Other players' karts move smoothly (lerped)
- [ ] Race finishes and podium shows after 3 laps
- [ ] "Race Again" returns to lobby, "Home" returns to home screen
