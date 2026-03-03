// packages/server/src/index.ts
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { RoomManager } from './RoomManager';
import { GameLoop } from './GameLoop';
import { PowerUpManager } from './PowerUpManager';
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

// item box positions for the track (matches Track.ts in client)
const ITEM_BOX_POSITIONS = [
  { x: 0, y: 0.5, z: 0 },
  { x: 20, y: 0.5, z: 10 },
  { x: -20, y: 0.5, z: 10 },
  { x: 30, y: 0.5, z: -30 },
  { x: -30, y: 0.5, z: -30 },
  { x: 0, y: 0.5, z: -60 },
];

const gameLoops = new Map<string, { loop: GameLoop; powerUps: PowerUpManager; interval: NodeJS.Timeout }>();

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
  const powerUps = new PowerUpManager(ITEM_BOX_POSITIONS);
  loop.startCountdown();

  // Seed item boxes into state
  loop.state.itemBoxes = powerUps.getBoxStates();

  const interval = setInterval(() => {
    loop.tick();
    powerUps.tick(TICK_MS);

    const state = loop.state;
    // Sync power-up state into game state
    state.activeEffects = powerUps.getActiveEffects();
    state.itemBoxes = powerUps.getBoxStates();

    io.to(roomCode).emit(EV_GAME_STATE, state);

    if (state.phase === 'finished') {
      clearInterval(interval);
      gameLoops.delete(roomCode);
      const results = Object.values(state.players)
        .sort((a, b) => (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity))
        .map(p => ({ playerId: p.id, nickname: p.nickname, finishTime: p.finishTime }));
      io.to(roomCode).emit(EV_RACE_FINISHED, results);
    }
  }, TICK_MS);

  gameLoops.set(roomCode, { loop, powerUps, interval });
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
    if (!room) { socket.emit(EV_ERROR, 'Room not found or full.'); return; }
    socket.join(room.code);
    io.to(room.code).emit(EV_PLAYER_JOINED, { id: socket.id, nickname });
    broadcastRoomState(room.code);
  });

  socket.on(EV_MATCHMAKE, ({ nickname }: { nickname: string }) => {
    const room = roomManager.matchmake(socket.id, nickname);
    if (!room) { socket.emit(EV_ERROR, 'Matchmaking failed.'); return; }
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
    if (!player?.isHost) { socket.emit(EV_ERROR, 'Only the host can start.'); return; }
    if (room.playerCount < MIN_PLAYERS_TO_START) { socket.emit(EV_ERROR, 'Need at least 2 players.'); return; }
    room.phase = 'countdown';
    startGameLoop(room.code);
  });

  socket.on(EV_PLAYER_INPUT, (input: PlayerInput) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) return;
    const entry = gameLoops.get(room.code);
    if (entry) entry.loop.applyInput(socket.id, input);
  });

  socket.on(EV_USE_ITEM, ({ position }: { position: { x: number; y: number; z: number } }) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) return;
    const entry = gameLoops.get(room.code);
    if (entry) entry.powerUps.useItem(socket.id, position);
  });

  socket.on(EV_LEAVE_ROOM, () => handleLeave(socket));
  socket.on('disconnect', () => handleLeave(socket));

  function handleLeave(sock: Socket): void {
    console.log(`[-] ${sock.id} disconnected`);
    const room = roomManager.getRoomByPlayer(sock.id);
    if (room) io.to(room.code).emit(EV_PLAYER_LEFT, sock.id);
    roomManager.leaveRoom(sock.id);
    if (room) {
      const remaining = roomManager.getRoom(room.code);
      if (remaining) broadcastRoomState(room.code);
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
