// packages/client/src/game/Track.ts
import * as THREE from 'three';

const TRACK_POINTS = [
  new THREE.Vector3(0, 0, 60),
  new THREE.Vector3(40, 0, 50),
  new THREE.Vector3(70, 0, 20),
  new THREE.Vector3(70, 0, -30),
  new THREE.Vector3(40, 0, -60),
  new THREE.Vector3(0, 0, -75),
  new THREE.Vector3(-40, 0, -60),
  new THREE.Vector3(-70, 0, -30),
  new THREE.Vector3(-70, 0, 20),
  new THREE.Vector3(-40, 0, 50),
  new THREE.Vector3(0, 0, 60),
];

const ROAD_WIDTH = 14;
const ROAD_COLOR = 0x333344;
const MARKING_COLOR = 0xffee00;

export function createTrack(scene: THREE.Scene): THREE.CatmullRomCurve3 {
  const curve = new THREE.CatmullRomCurve3(TRACK_POINTS, true);

  const roadGeo = new THREE.TubeGeometry(curve, 200, ROAD_WIDTH / 2, 4, true);
  const roadMat = new THREE.MeshToonMaterial({ color: ROAD_COLOR });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = Math.PI / 2;
  road.receiveShadow = true;
  scene.add(road);

  const dashCount = 40;
  for (let i = 0; i < dashCount; i++) {
    const t = i / dashCount;
    const pt = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const dashGeo = new THREE.BoxGeometry(0.4, 0.05, 3);
    const dashMat = new THREE.MeshToonMaterial({ color: MARKING_COLOR });
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.position.set(pt.x, 0.05, pt.z);
    dash.lookAt(pt.x + tangent.x, 0.05, pt.z + tangent.z);
    scene.add(dash);
  }

  const groundGeo = new THREE.PlaneGeometry(300, 300);
  const groundMat = new THREE.MeshToonMaterial({ color: 0x4caf50 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  addBuildings(scene);
  addTrees(scene);

  return curve;
}

function addBuildings(scene: THREE.Scene): void {
  const BUILDING_COLORS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0x6c5ce7];
  const positions: [number, number][] = [
    [100, 0], [-100, 0], [100, -80], [-100, -80],
    [30, 90], [-30, 90], [90, -100], [-90, -100],
  ];
  positions.forEach(([x, z], i) => {
    const w = 10 + (i * 7) % 15;
    const h = 15 + (i * 11) % 30;
    const d = 10 + (i * 5) % 15;
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshToonMaterial({ color: BUILDING_COLORS[i % BUILDING_COLORS.length] });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    scene.add(mesh);
  });
}

function addTrees(scene: THREE.Scene): void {
  const trunkMat = new THREE.MeshToonMaterial({ color: 0x8b6914 });
  const leafMat = new THREE.MeshToonMaterial({ color: 0x27ae60 });
  const positions: [number, number][] = [[85, 5], [-85, 5], [85, -50], [-85, -50], [20, 75], [-20, 75]];
  positions.forEach(([x, z]) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 4), trunkMat);
    trunk.position.set(x, 2, z);
    scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(3, 6, 6), leafMat);
    leaves.position.set(x, 7, z);
    scene.add(leaves);
  });
}
