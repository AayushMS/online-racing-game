// packages/client/src/game/ItemBoxes.ts
import * as THREE from 'three';
import { ItemBoxState, ITEM_BOX_WORLD_POSITIONS } from '@racing/shared';

export function createItemBoxes(scene: THREE.Scene): THREE.Mesh[] {
  const boxes: THREE.Mesh[] = [];
  ITEM_BOX_WORLD_POSITIONS.forEach(pos => {
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshToonMaterial({ color: 0xffd700, emissive: 0x886600, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.castShadow = true;
    scene.add(mesh);
    boxes.push(mesh);
  });
  return boxes;
}

export function syncItemBoxes(boxes: THREE.Mesh[], states: ItemBoxState[]): void {
  states.forEach((state, i) => {
    if (boxes[i]) boxes[i].visible = state.active;
  });
}

export function animateItemBoxes(boxes: THREE.Mesh[], elapsed: number): void {
  boxes.forEach((box, i) => {
    if (!box.visible) return;
    box.rotation.y = elapsed + (i * Math.PI) / 3;
    box.position.y = 0.8 + Math.sin(elapsed * 2 + i) * 0.15;
  });
}
