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
