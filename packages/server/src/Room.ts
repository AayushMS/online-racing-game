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
