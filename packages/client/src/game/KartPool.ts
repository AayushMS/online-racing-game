// packages/client/src/game/KartPool.ts
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { PlayerState } from '@racing/shared';
import { createKartMesh } from './KartMesh';

interface KartEntry {
  mesh: THREE.Group;
  label: CSS2DObject;
  prevPos: THREE.Vector3;
  currPos: THREE.Vector3;
  prevQuat: THREE.Quaternion;
  currQuat: THREE.Quaternion;
}

export class KartPool {
  private karts: Map<string, KartEntry> = new Map();
  private scene: THREE.Scene;
  private myId: string;

  constructor(scene: THREE.Scene, myId = '') {
    this.scene = scene;
    this.myId = myId;
  }

  /** Call on every server state update — shifts current to prev, stores new state */
  updateServerState(players: Record<string, PlayerState>): void {
    const currentIds = new Set(Object.keys(players));

    for (const [id, player] of Object.entries(players)) {
      if (!this.karts.has(id)) {
        const mesh = createKartMesh(player.carIndex);
        this.scene.add(mesh);

        const div = document.createElement('div');
        div.style.cssText = [
          'background:rgba(0,0,0,0.65)',
          'color:#fff',
          'font-family:monospace',
          'font-size:12px',
          'padding:2px 8px',
          'border-radius:8px',
          'pointer-events:none',
          'white-space:nowrap',
        ].join(';');
        const label = new CSS2DObject(div);
        label.position.set(0, 2.5, 0);
        mesh.add(label);

        const pos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
        const quat = new THREE.Quaternion(player.rotation.x, player.rotation.y, player.rotation.z, player.rotation.w);
        this.karts.set(id, {
          mesh, label,
          prevPos: pos.clone(), currPos: pos.clone(),
          prevQuat: quat.clone(), currQuat: quat.clone(),
        });
      }

      const entry = this.karts.get(id)!;
      entry.prevPos.copy(entry.currPos);
      entry.prevQuat.copy(entry.currQuat);
      entry.currPos.set(player.position.x, player.position.y, player.position.z);
      entry.currQuat.set(player.rotation.x, player.rotation.y, player.rotation.z, player.rotation.w);

      const isMe = id === this.myId;
      const div = entry.label.element as HTMLDivElement;
      div.textContent = isMe ? `\u25b6 ${player.nickname}` : player.nickname;
      div.style.color = isMe ? '#ffee44' : '#fff';
    }

    for (const [id, entry] of this.karts) {
      if (!currentIds.has(id)) {
        this.scene.remove(entry.mesh);
        this.karts.delete(id);
      }
    }
  }

  /** Call every render frame with interpolation alpha [0,1] */
  interpolate(alpha: number): void {
    for (const [, entry] of this.karts) {
      entry.mesh.position.lerpVectors(entry.prevPos, entry.currPos, alpha);
      entry.mesh.quaternion.slerpQuaternions(entry.prevQuat, entry.currQuat, alpha);
    }
  }

  getKart(playerId: string): THREE.Group | undefined {
    return this.karts.get(playerId)?.mesh;
  }

  dispose(): void {
    for (const entry of this.karts.values()) this.scene.remove(entry.mesh);
    this.karts.clear();
  }
}
