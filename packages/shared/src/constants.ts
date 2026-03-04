// packages/shared/src/constants.ts

export const MAX_PLAYERS = 8;
export const MIN_PLAYERS_TO_START = 2;
export const TOTAL_LAPS = 3;
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

export const ITEM_BOX_RESPAWN_MS = 8000;
export const BOOST_DURATION_MS = 3000;
export const BOOST_MULTIPLIER = 1.4;
export const SHIELD_DURATION_MS = 5000;
export const BANANA_SLOW_MS = 1200;
export const OIL_SLOW_MS = 1800;
export const BANANA_SLOW_FACTOR = 0.3;
export const OIL_SLOW_FACTOR = 0.4;

export const COUNTDOWN_SECONDS = 3;

export const GRAVITY = -20;

export const CAR_MAX_SPEED = 30;
export const CAR_ACCELERATION = 15;
export const CAR_BRAKE_DECEL = 25;
export const CAR_TURN_SPEED = 2.2;
export const WALL_BOUNCE = 0.3;

// Powerup physics
export const MISSILE_SPEED = 55;          // m/s forward travel
export const MISSILE_HIT_RADIUS = 3.5;    // world units
export const MISSILE_MAX_TICKS = 240;     // ~4 s lifetime
export const BANANA_HIT_RADIUS = 3.0;
export const OIL_EFFECT_RADIUS = 4.0;
export const OIL_MAX_TICKS = 300;         // 5 s on track

// Lap/checkpoint
export const CHECKPOINT_COUNT = 8;
export const CHECKPOINT_CROSS_RADIUS = 11; // world units

// Race finish timeout after first player finishes (ms)
export const RACE_FINISH_TIMEOUT_MS = 30000;
