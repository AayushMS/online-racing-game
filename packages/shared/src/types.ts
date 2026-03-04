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
  finishTime: number | null;    // ms from race start
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
