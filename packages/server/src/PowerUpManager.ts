// packages/server/src/PowerUpManager.ts
import {
  ItemType, ItemBoxState, ActiveEffect, Vec3, ITEM_BOX_RESPAWN_MS,
  OIL_MAX_TICKS, MISSILE_MAX_TICKS, MISSILE_SPEED,
} from '@racing/shared';

const ITEM_POOL: ItemType[] = ['missile', 'banana', 'boost', 'shield', 'oil'];

function randomItem(): ItemType {
  return ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
}


export class PowerUpManager {
  private boxes: ItemBoxState[];
  private boxRespawnTimers: Map<string, number> = new Map();
  private playerItems: Map<string, ItemType> = new Map();
  private activeEffects: ActiveEffect[] = [];
  private nextEffectId = 0;
  private uid(): string { return `eff_${this.nextEffectId++}`; }
  private currentTick = 0;

  constructor(positions: Vec3[]) {
    this.boxes = positions.map((position, i) => ({
      id: `box_${i}`,
      position,
      active: true,
    }));
  }

  collectBox(playerId: string, boxIndex: number): { item: ItemType } | null {
    if (boxIndex < 0 || boxIndex >= this.boxes.length || !Number.isInteger(boxIndex)) return null;
    const box = this.boxes[boxIndex];
    if (!box || !box.active) return null;
    if (this.playerItems.has(playerId)) return null;

    const item = randomItem();
    this.playerItems.set(playerId, item);
    box.active = false;
    this.boxRespawnTimers.set(box.id, ITEM_BOX_RESPAWN_MS);
    return { item };
  }

  useItem(playerId: string, position: Vec3, forward?: { x: number; y: number; z: number }): void {
    const item = this.playerItems.get(playerId);
    if (!item) return;
    this.playerItems.delete(playerId);

    if (item === 'missile') {
      const vel = forward
        ? { x: forward.x * MISSILE_SPEED, y: 0, z: forward.z * MISSILE_SPEED }
        : { x: 0, y: 0, z: -MISSILE_SPEED };
      this.activeEffects.push({
        id: this.uid(), type: 'missile', position: { ...position },
        velocity: vel, ownerId: playerId, spawnedAt: this.currentTick,
      });
    } else if (item === 'banana') {
      this.activeEffects.push({
        id: this.uid(), type: 'banana', position: { ...position },
        ownerId: playerId, spawnedAt: this.currentTick,
      });
    } else if (item === 'oil') {
      this.activeEffects.push({
        id: this.uid(), type: 'oil', position: { ...position },
        ownerId: playerId, spawnedAt: this.currentTick,
        expiresAtTick: this.currentTick + OIL_MAX_TICKS,
      });
    }
    // boost and shield are handled in GameLoop.tickPowerUps at collection time
  }

  tick(deltaMs: number): void {
    this.currentTick++;
    const tickDt = deltaMs / 1000;

    // Move missiles + expire old effects
    this.activeEffects = this.activeEffects.filter(effect => {
      if (effect.type === 'missile' && effect.velocity) {
        effect.position.x += effect.velocity.x * tickDt;
        effect.position.z += effect.velocity.z * tickDt;
        if (this.currentTick - effect.spawnedAt > MISSILE_MAX_TICKS) return false;
      }
      if (effect.expiresAtTick !== undefined && this.currentTick > effect.expiresAtTick) return false;
      return true;
    });

    // Box respawn timers
    const expired: string[] = [];
    for (const [boxId, remaining] of this.boxRespawnTimers) {
      const next = remaining - deltaMs;
      if (next <= 0) expired.push(boxId);
      else this.boxRespawnTimers.set(boxId, next);
    }
    for (const id of expired) {
      this.boxRespawnTimers.delete(id);
      const box = this.boxes.find(b => b.id === id);
      if (box) box.active = true;
    }
  }

  getBoxStates(): ItemBoxState[] { return this.boxes; }
  getActiveEffects(): ActiveEffect[] { return this.activeEffects; }
  getPlayerItem(playerId: string): ItemType | null { return this.playerItems.get(playerId) ?? null; }
  removeEffect(effectId: string): void { this.activeEffects = this.activeEffects.filter(e => e.id !== effectId); }
}
