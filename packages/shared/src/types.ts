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
  /** 1-indexed lap counter. Starts at 1, race complete when lap > TOTAL_LAPS */
  lap: number;
  lapProgress: number; // 0.0 – 1.0 within current lap
  finished: boolean;
  finishTime: number | null;
  activeBuff?: { type: 'shield' | 'boost'; expiresAtTick: number };
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
  rotation?: Quat;     // orientation for directional effects (bananas, oil slicks)
  velocity?: Vec3;     // movement for missiles
  ownerId: string;
  spawnedAt: number;   // tick when spawned (for lifetime/despawn logic)
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

// Socket.io event payload types

export interface PlayerInputPayload {
  seq: number;        // sequence number for client prediction reconciliation
  throttle: number;   // 0 to 1.0
  brake: number;      // 0 to 1.0
  steer: number;      // -1.0 to 1.0
  timestamp: number;
}

export interface JoinRoomPayload {
  code: string;
  nickname: string;
}

export interface CreateRoomPayload {
  nickname: string;
  name: string;       // room name
  isPrivate: boolean;
}

export interface MatchmakePayload {
  nickname: string;
}

// Typed Socket.io event maps for full end-to-end type safety
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
  race_finished: (results: Array<{ playerId: string; nickname: string; finishTime: number | null }>) => void;
  error: (message: string) => void;
  player_joined: (player: { id: string; nickname: string; carIndex: number }) => void;
  player_left: (playerId: string) => void;
  countdown: (seconds: number) => void;
}
