// packages/client/src/game/KartMesh.ts
import * as THREE from 'three';

const CAR_COLORS = [0xff4444, 0x4444ff, 0x44ff44, 0xffaa00, 0xcc44cc];
const WHEEL_COLOR = 0x222222;

export function createKartMesh(carIndex: number): THREE.Group {
  const group = new THREE.Group();
  const bodyColor = CAR_COLORS[carIndex % CAR_COLORS.length];

  const bodyGeo = new THREE.BoxGeometry(1.8, 0.7, 3.2);
  const bodyMat = new THREE.MeshToonMaterial({ color: bodyColor });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6;
  body.castShadow = true;
  group.add(body);

  const cockpitGeo = new THREE.BoxGeometry(1.2, 0.5, 1.4);
  const cockpitMat = new THREE.MeshToonMaterial({ color: bodyColor });
  const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
  cockpit.position.set(0, 1.15, 0.3);
  group.add(cockpit);

  const windshieldGeo = new THREE.BoxGeometry(1.1, 0.4, 0.1);
  const windshieldMat = new THREE.MeshToonMaterial({ color: 0x88ccff, transparent: true, opacity: 0.7 });
  const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
  windshield.position.set(0, 1.2, -0.3);
  windshield.rotation.x = -0.3;
  group.add(windshield);

  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 8);
  const wheelMat = new THREE.MeshToonMaterial({ color: WHEEL_COLOR });
  const wheelPositions: [number, number, number][] = [
    [1.1, 0.42, 1.1], [-1.1, 0.42, 1.1],
    [1.1, 0.42, -1.1], [-1.1, 0.42, -1.1],
  ];
  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    group.add(wheel);
  });

  const spoilerGeo = new THREE.BoxGeometry(1.6, 0.15, 0.5);
  const spoilerMat = new THREE.MeshToonMaterial({ color: 0x222222 });
  const spoiler = new THREE.Mesh(spoilerGeo, spoilerMat);
  spoiler.position.set(0, 1.2, 1.5);
  group.add(spoiler);

  return group;
}
