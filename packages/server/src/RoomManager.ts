// packages/server/src/RoomManager.ts
import { Room } from './Room';

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
    for (const [code, room] of this.rooms.entries()) {
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
