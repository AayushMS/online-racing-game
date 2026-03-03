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
