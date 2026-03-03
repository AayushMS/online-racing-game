# Online 3D Racing Game — Design Document

**Date:** 2026-03-03
**Status:** Approved

---

## Overview

A browser-based 3D multiplayer arcade racing game inspired by Mario Kart. Players race in sessions of 5–8 people using public matchmaking or private room codes. No installs required — runs entirely in the browser. Vibrant cartoon low-poly visual style with weapons, power-ups, and satisfying arcade physics.

---

## Goals

- Fun to play with friends with minimal friction (no login, no install)
- Low latency multiplayer (client-side prediction + server authority)
- Visually distinctive and beautiful (cartoon cel-shaded 3D)
- Ship a polished MVP with 1 track, then iterate

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                     FRONTEND (Vercel)                │
│  React + Vite  ·  Three.js (3D render)               │
│  Cannon-es (client physics prediction)               │
│  Socket.io-client (real-time sync)                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Lobby   │  │  Race    │  │  HUD / Power-ups  │  │
│  │  Screen  │  │  Engine  │  │  / Minimap        │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
└────────────────────────┬────────────────────────────┘
                         │ WebSocket
┌────────────────────────▼────────────────────────────┐
│                    BACKEND (Railway)                  │
│  Node.js + Socket.io server                          │
│  Cannon-es (server-authoritative physics)            │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Room Mgr │  │ Game Loop│  │ Power-up Manager │   │
│  │ Matchmkr │  │ 60 tick  │  │ Collision Arbiter│   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Networking Strategy (Low Latency)

- **Client-side prediction:** Car moves immediately on client input; server state reconciles each tick
- **60Hz server game loop:** Broadcasts delta state (only changed positions/rotations)
- **Lag compensation:** Server rolls back state to validate power-up hits fairly
- **WebSockets (Socket.io):** Persistent connection (~1–5ms overhead vs ~50–100ms HTTP polling)

---

## Project Structure

```
online-racing-game/
├── packages/
│   ├── client/         # React + Vite + Three.js frontend
│   ├── server/         # Node.js + Socket.io game server
│   └── shared/         # Shared types, constants, game config
└── docs/plans/         # Design & implementation docs
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React + Vite |
| 3D rendering | Three.js |
| Physics (client) | Cannon-es (client prediction) |
| Physics (server) | Cannon-es (authoritative) |
| Networking | Socket.io |
| Backend runtime | Node.js |
| Audio | Howler.js |
| Frontend deploy | Vercel |
| Backend deploy | Railway |
| Source control | GitHub (via gh CLI) |

---

## Game Mechanics

### Race Flow

1. Player lands on homepage → enters nickname
2. Creates/joins a private room (via 6-char code) or enters public matchmaking
3. Lobby screen: shows joined players with ready-up buttons; host starts when ≥2 ready
4. 3–2–1 countdown → race starts
5. 3 laps around the circuit; real-time position tracking (1st, 2nd, …)
6. Race ends when all players finish → podium screen with lap times
7. Option to race again (same room) or leave

### Power-ups

| Item | Effect |
|---|---|
| Missile | Fires forward, knocks target car sideways |
| Banana Peel | Drops behind; spins any car that drives through it |
| Speed Boost | +40% speed for 3 seconds |
| Shield | Blocks one incoming attack |
| Oil Slick | Area-of-effect slip zone left on track |

- Item boxes glow on track, respawn every 8 seconds at fixed positions
- Players carry max 1 item at a time
- Server is authoritative on all item hits (lag-compensated)

### Physics (Arcade Style)

- High-grip instant-response steering (no sim-style weight transfer)
- Wall collisions: slight bounce, no permanent damage
- Drifting: hold brake + steer → enter drift state (no boost meter for MVP)
- Cars reset upright if they flip over (3-second timer)

---

## Visual Design

**Style:** Vibrant cartoon / low-poly cel-shaded

- **Rendering:** Three.js `MeshToonMaterial` for cel-shading
- **Lighting:** Single directional light + ambient; cartoon outline via post-processing
- **Cars:** 5 unique low-poly cartoon kart models in distinct colors
- **Track:** Flat-shaded geometric buildings, rounded curves, bright primary colors
- **Effects:** Particle bursts (boosts), cartoon smoke puffs (spins), star sparkles (hits)
- **HUD:** Minimal overlay — position (1st/2nd/…), lap counter, held item, 2D canvas minimap
- **Audio:** Howler.js — engine sounds per car, SFX for each item, race music

---

## The Track (MVP)

- A looping circuit set in a vibrant cartoon city
- Oversized cartoon buildings, palm trees, bright road markings
- 3 laps per race
- ~60 seconds per lap at average speed
- Item boxes at 6–8 fixed locations on track
- Hand-crafted geometry (no procedural generation)

---

## Data Flow

### Client → Server (every frame)

```json
{ "seq": 1042, "steer": -0.5, "throttle": 1.0, "brake": 0, "timestamp": 1709461234567 }
```

### Server → All Clients (60Hz broadcast)

```json
{
  "seq": 1042,
  "players": [
    { "id": "abc", "x": 12.3, "y": 0, "z": -5.1, "rotY": 1.57, "speed": 28, "item": "missile", "lap": 2 }
  ]
}
```

### Client Reconciliation

1. Buffer own inputs by seq number
2. On server update: if position diff > threshold → lerp to server position
3. Re-apply buffered inputs from received seq forward

---

## Room Lifecycle

```
connect            → assigned socket ID
createRoom(name)   → roomCode issued (6 chars)
joinRoom(code) | matchmake() → placed in lobby
ready()            → host sees all players ready
start()            → game loop begins, race state broadcast
raceEnd            → podium shown, room resets or disbands
```

---

## Deployment Pipeline

```
GitHub repo
├── push to main → Vercel auto-deploys client (packages/client)
└── push to main → Railway auto-deploys server (packages/server)
```

**No persistent accounts for MVP** — players enter a nickname on join. No login, no database. Sessions are fully ephemeral.

---

## MVP Scope

**In scope:**
- 1 cartoon city track
- 5 car models (color variants)
- 5 power-up types
- Public matchmaking + private rooms (5–8 players)
- 3-lap races with podium
- Full deployment to Vercel + Railway

**Explicitly out of scope for MVP:**
- User accounts / leaderboards
- Multiple tracks
- Mobile touch controls
- Chat system
- Custom car skins
