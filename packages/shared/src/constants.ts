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

export const GRAVITY = -20; // m/s² — arcade-style doubled gravity for snappier ground contact

export const CAR_MAX_SPEED = 30; // m/s
export const CAR_ACCELERATION = 15;
export const CAR_BRAKE_DECEL = 25;
export const CAR_TURN_SPEED = 2.2; // rad/s at full speed
export const WALL_BOUNCE = 0.3;

// Checkpoint positions along the track (normalized 0–1 progress per lap)
// These are verified against the track geometry in Task 9
export const CHECKPOINT_COUNT = 8;
