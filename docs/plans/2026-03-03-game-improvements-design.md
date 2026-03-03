# Game Improvements Design — Kart Chaos v2

**Date:** 2026-03-03
**Status:** Approved
**Scope:** Fix + Polish (Approach B)

---

## Problem Statement

The game is structurally complete but several critical systems are stubs or broken:

1. Lap detection never increments — races never end, podium unreachable
2. Powerups collected but never applied — no boost, shield, missile, banana, oil effects
3. No item box proximity collection — karts can't actually collect boxes
4. Camera wobbles due to position-only lerp and snapping lookAt
5. KartPool snaps kart positions (no interpolation between server states)
6. No audio despite Howler.js being installed
7. HUD lacks polish (no lap timers, no split times, no mini-map, no position animation)
8. Podium screen is a placeholder

---

## Section 1 — Core Gameplay (Server-Side)

### Lap Detection

- Track curve is a closed CatmullRomCurve3 with 8 equidistant checkpoints
- Each tick, server projects each car's 3D position onto the curve to get `t` (0–1)
- Checkpoint crossings tracked in order (anti-cheat: can't skip checkpoints)
- Crossing checkpoint 7 after checkpoints 0–6 → increment lap
- After lap 3, player marked `finished`, `finishTime` recorded
- `lapProgress` updated every tick for HUD and position ranking

### Powerup Proximity Collection

- Each tick, server checks distance between every car and every active item box
- Distance < 3 units → player collects box, gets random item, box deactivates for 8s
- Replaces current stub (no collection detection)

### Powerup Effects

| Item | Effect |
|------|--------|
| **Boost** | Multiplies `CAR_MAX_SPEED × BOOST_MULTIPLIER (1.4)` for `BOOST_DURATION_MS (3000ms)` via buff on PlayerState |
| **Shield** | Absorbs next incoming hit; stored on PlayerState, removed on first impact |
| **Missile** | Spawns ActiveEffect at player position, travels forward at 60 m/s per tick; hits first car within 2.5 units → applies knockback impulse to Cannon-es body |
| **Banana** | Drops at car's current position; any car within 2 units gets random angular impulse (spin-out) and speed reduced to 30% for 1s |
| **Oil Slick** | 3m-radius zone; cars in zone capped at 40% max speed for 1.5s |

### Race Finish

- When all players finish OR 30s after first finisher, phase → `'finished'`
- Server emits `EV_RACE_FINISHED` with standings (sorted by finishTime, unfinished by lap+progress)
- Players still racing at timeout get positions assigned by current lap+progress

---

## Section 2 — Camera & Rendering

### Spring-Damper Camera

- Replace position lerp (0.12) with spring-damper: `k=15`, `d=8`
- Camera target: 12 units behind kart, 5 units above
- lookAt target: lerp factor 0.15 toward a point 8 units ahead of kart in forward direction
- Result: snappy but smooth follow, no wobble on sharp turns, camera leads into corners

### Kart Interpolation

- `KartPool.syncPlayers()` stores previous + current server state per kart
- Render loop lerps position and quaternion using sub-tick progress (renderDt / TICK_MS)
- Eliminates visible snapping at 60Hz updates

### Name Tags

- `CSS2DRenderer` (Three.js addon) renders player nicknames as DOM labels
- 2.5 units above each kart
- Shows nickname + current position number (e.g. "PlayerX — P3")
- Own kart gets a "YOU" indicator

### Skid Marks

- When steering magnitude > 0.6 AND speed > 12 m/s, stamp thin dark planes slightly above road
- Ring buffer: max 200 marks, oldest removed when full
- Color: dark gray, opacity 0.6, slight random rotation variation

### Crash / Hit Effects

- On missile hit or hard collision (velocity delta > 8 m/s): `ParticleSystem.burst()` fires
- Screen shake: camera offset lerps through damped sine wave for 0.4s
- Triggered server-side by detecting new `ActiveEffect` targeting local player in state diff

---

## Section 3 — Audio

### AudioManager Class

Wraps Howler.js: `play(sound, options?)`, `setEngineRpm(ratio)`, `stopAll()`

### Sound Files (CC0 from freesound.org)

| File | Usage |
|------|-------|
| `engine_loop.mp3` | Looping engine, pitch 0.6x–1.4x based on speed |
| `item_collect.mp3` | Short chime on item box collection |
| `item_use.mp3` | Whoosh on any item activation |
| `missile_hit.mp3` | Explosion thud on missile impact |
| `banana_spin.mp3` | Comic spin sound on banana/oil hit |
| `countdown_beep.mp3` | Tick × 3 during countdown |
| `go.mp3` | Higher-pitched beep on race start |
| `boost.mp3` | Jet whoosh loop during boost (3s) |

### Integration Points

- Engine pitch tracks `myState.speed / CAR_MAX_SPEED` every frame
- Item collect detected from `EV_GAME_STATE` diff (heldItem changed to non-null)
- Countdown beeps from `EV_COUNTDOWN` event
- Hit sounds detected from `activeEffects` diff (new effect targeting local player)

---

## Section 4 — UI / HUD Polish

### Lap Counter & Split Timers

- Animated lap number: bounces/scales up on lap completion (CSS keyframe)
- Last lap time and best lap time tracked client-side
- Format: "1:24.3" (minutes:seconds.tenths)

### Position Display

- Large "P1"/"P2" style badge
- Green flash animation when position improves, red flash when it drops

### Speed Ring

- SVG arc gauge, sweeps 0–270° proportional to speed
- Speed number inside arc
- Outer arc tints red during boost

### Item Slot

- Glowing border box for held item
- Pulses when item is ready
- Scale-down + fade animation on use

### Mini-Map

- 120×120px canvas top-right corner
- Track curve pre-baked as white line
- Each player as a colored dot (matches kart color)
- Own kart: larger white dot with direction arrow
- Updates every render frame

### Podium Screen

- 1st/2nd/3rd on stepped blocks with player nicknames and finish times
- Best lap time per player
- "New Record" badge if local player set the room's fastest lap

---

## Section 5 — Testing Strategy

### Server Tests (Vitest) — new files

| File | Coverage |
|------|----------|
| `LapDetection.test.ts` | Checkpoint crossing in order, anti-cheat skip prevention, lap 3 → finished, full race finish |
| `PowerupCollision.test.ts` | Proximity collection, missile travel + hit, banana/oil zone, boost multiplier, shield absorption |
| `GameLoop.test.ts` additions | Boost/shield timers expire, multiple finishers in sequence, standings ordering |
| `PowerUpManager.test.ts` additions | Effect tick movement, effect expiry cleanup |

### Client Tests (Vitest + happy-dom) — new setup

| File | Coverage |
|------|----------|
| `SceneManager.test.ts` | Spring-damper convergence, lookAt lerp |
| `KartPool.test.ts` | Interpolation between two server states |
| `MiniMap.test.ts` | Player dot positions match normalized track coords |
| `AudioManager.test.ts` | Mock Howler, correct sounds on correct events |

### Integration Tests

| File | Coverage |
|------|----------|
| `race-flow.test.ts` | Full race: room → ready → start → 3 laps → finish → standings (in-process, no real server) |

**Target: ~35–45 new tests across 9 files**

---

## Implementation Order

1. **Shared types** — add checkpoint types, buff fields, update GameState
2. **Server: Lap detection** — checkpoint math, crossing detection, lap increment
3. **Server: Powerup proximity** — item box collection check in GameLoop tick
4. **Server: Powerup effects** — apply boost/shield buffs, missile tick, banana/oil zones
5. **Server: Race finish** — phase transition, standings, timeout
6. **Server tests** — LapDetection, PowerupCollision, race-flow
7. **Client: Camera** — spring-damper replace in SceneManager
8. **Client: Kart interpolation** — KartPool sub-tick lerp
9. **Client: Name tags** — CSS2DRenderer integration
10. **Client: Skid marks** — stamp system
11. **Client: Crash effects** — screen shake + particle triggers
12. **Client: AudioManager** — Howler wrapper + sound files
13. **Client: Audio integration** — wire to game events
14. **Client: HUD polish** — lap timers, position badge, speed ring, item slot
15. **Client: Mini-map** — canvas overlay
16. **Client: Podium screen** — proper standings UI
17. **Client tests** — SceneManager, KartPool, MiniMap, AudioManager
18. **Deploy** — push, redeploy Railway + Vercel
