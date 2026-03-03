// packages/client/src/game/ParticleSystem.ts
import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  burst(position: THREE.Vector3, color: number, count = 12): void {
    const geo = new THREE.SphereGeometry(0.2, 4, 4);
    const mat = new THREE.MeshToonMaterial({ color });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo.clone(), mat.clone());
      mesh.position.copy(position);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          Math.random() * 8 + 2,
          (Math.random() - 0.5) * 10,
        ),
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
      });
    }
  }

  tick(dt: number): void {
    this.particles = this.particles.filter(p => {
      p.life += dt;
      p.velocity.y -= 15 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      const t = p.life / p.maxLife;
      p.mesh.scale.setScalar(1 - t);
      if (p.life >= p.maxLife) { this.scene.remove(p.mesh); return false; }
      return true;
    });
  }
}
