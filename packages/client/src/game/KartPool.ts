// packages/client/src/game/KartPool.ts
import * as THREE from 'three';
import { PlayerState } from '@racing/shared';
import { createKartMesh } from './KartMesh';

export class KartPool {
  private karts: Map<string, THREE.Group> = new Map();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  syncPlayers(players: Record<string, PlayerState>): void {
    const currentIds = new Set(Object.keys(players));

    for (const [id, player] of Object.entries(players)) {
      if (!this.karts.has(id)) {
        const kart = createKartMesh(player.carIndex);
        this.scene.add(kart);
        this.karts.set(id, kart);
      }
    }

    for (const [id, kart] of this.karts) {
      if (!currentIds.has(id)) {
        this.scene.remove(kart);
        this.karts.delete(id);
      }
    }

    for (const [id, player] of Object.entries(players)) {
      const kart = this.karts.get(id);
      if (!kart) continue;
      kart.position.set(player.position.x, player.position.y, player.position.z);
      kart.quaternion.set(player.rotation.x, player.rotation.y, player.rotation.z, player.rotation.w);
    }
  }

  getKart(playerId: string): THREE.Group | undefined {
    return this.karts.get(playerId);
  }

  dispose(): void {
    for (const kart of this.karts.values()) this.scene.remove(kart);
    this.karts.clear();
  }
}
