// packages/server/src/PowerUpManager.ts
import { ItemType, ItemBoxState, ActiveEffect, Vec3, ITEM_BOX_RESPAWN_MS } from '@racing/shared';

const ITEM_POOL: ItemType[] = ['missile', 'banana', 'boost', 'shield', 'oil'];

function randomItem(): ItemType {
  return ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export class PowerUpManager {
  private boxes: ItemBoxState[];
  private boxRespawnTimers: Map<string, number> = new Map();
  private playerItems: Map<string, ItemType> = new Map();
  private activeEffects: ActiveEffect[] = [];
  private currentTick = 0;

  constructor(positions: Vec3[]) {
    this.boxes = positions.map((position, i) => ({
      id: `box_${i}`,
      position,
      active: true,
    }));
  }

  collectBox(playerId: string, boxIndex: number): { item: ItemType } | null {
    const box = this.boxes[boxIndex];
    if (!box || !box.active) return null;
    if (this.playerItems.has(playerId)) return null;

    const item = randomItem();
    this.playerItems.set(playerId, item);
    box.active = false;
    this.boxRespawnTimers.set(box.id, ITEM_BOX_RESPAWN_MS);
    return { item };
  }

  useItem(playerId: string, item: ItemType, position: Vec3): void {
    if (!this.playerItems.has(playerId)) return;
    this.playerItems.delete(playerId);

    if (item === 'missile' || item === 'banana' || item === 'oil') {
      this.activeEffects.push({
        id: uid(),
        type: item,
        position,
        ownerId: playerId,
        spawnedAt: this.currentTick,
      });
    }
    // boost and shield applied directly to PlayerState in GameLoop
  }

  tick(deltaMs: number): void {
    this.currentTick++;
    for (const [boxId, remaining] of this.boxRespawnTimers) {
      const next = remaining - deltaMs;
      if (next <= 0) {
        this.boxRespawnTimers.delete(boxId);
        const box = this.boxes.find(b => b.id === boxId);
        if (box) box.active = true;
      } else {
        this.boxRespawnTimers.set(boxId, next);
      }
    }
  }

  getBoxStates(): ItemBoxState[] { return this.boxes; }
  getActiveEffects(): ActiveEffect[] { return this.activeEffects; }
  getPlayerItem(playerId: string): ItemType | null { return this.playerItems.get(playerId) ?? null; }
  removeEffect(effectId: string): void { this.activeEffects = this.activeEffects.filter(e => e.id !== effectId); }
}
