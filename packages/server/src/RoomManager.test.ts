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
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
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

  it('transfers host when host leaves a non-empty room', () => {
    const room = mgr.createRoom('host', 'Room', false);
    mgr.joinRoom('player2', room.code);
    mgr.leaveRoom('host');
    const remaining = mgr.getRoom(room.code);
    const newHost = [...remaining!.players.values()].find(p => p.isHost);
    expect(newHost).toBeDefined();
    expect(newHost!.socketId).toBe('player2');
  });
});
