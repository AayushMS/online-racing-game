// packages/client/src/game/SkidMarks.ts
import * as THREE from 'three';

const MAX_MARKS = 200;

export class SkidMarks {
  private marks: THREE.Mesh[] = [];
  private scene: THREE.Scene;
  private mat: THREE.MeshBasicMaterial;
  private head = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.mat = new THREE.MeshBasicMaterial({
      color: 0x222222,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
  }

  /** Call each render frame for each kart */
  update(
    kartPos: THREE.Vector3,
    kartQuat: THREE.Quaternion,
    speed: number,
    steer: number,
  ): void {
    if (Math.abs(steer) < 0.55 || speed < 12) return;

    const geo = new THREE.PlaneGeometry(1.6, 1.0);
    const mark = new THREE.Mesh(geo, this.mat);
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(kartPos.x, 0.02, kartPos.z);
    // Align with kart direction
    const angle = Math.atan2(
      2 * (kartQuat.w * kartQuat.y + kartQuat.x * kartQuat.z),
      1 - 2 * (kartQuat.y * kartQuat.y + kartQuat.z * kartQuat.z),
    );
    mark.rotation.z = -angle;
    this.scene.add(mark);

    // Ring buffer: remove oldest mark
    if (this.marks.length >= MAX_MARKS) {
      const old = this.marks[this.head];
      this.scene.remove(old);
      old.geometry.dispose();
      this.marks[this.head] = mark;
    } else {
      this.marks.push(mark);
    }
    this.head = (this.head + 1) % MAX_MARKS;
  }

  dispose(): void {
    for (const m of this.marks) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    this.marks = [];
    this.mat.dispose();
  }
}
