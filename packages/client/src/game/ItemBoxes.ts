// packages/client/src/game/ItemBoxes.ts
import * as THREE from 'three';
import { ItemBoxState } from '@racing/shared';

const ITEM_POSITIONS: { x: number; y: number; z: number }[] = [
  { x: 0, y: 0.8, z: 40 }, { x: 50, y: 0.8, z: 10 }, { x: -50, y: 0.8, z: 10 },
  { x: 40, y: 0.8, z: -50 }, { x: -40, y: 0.8, z: -50 }, { x: 0, y: 0.8, z: -65 },
];

export function createItemBoxes(scene: THREE.Scene): THREE.Mesh[] {
  const boxes: THREE.Mesh[] = [];
  ITEM_POSITIONS.forEach(pos => {
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
