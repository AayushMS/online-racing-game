// packages/client/src/game/SceneManager.ts
import * as THREE from 'three';

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private animFrameId: number | null = null;
  private resizeObserver!: ResizeObserver;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 80, 200);

    this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
    this.camera.position.set(0, 8, 20);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
    sun.position.set(50, 80, 50);
    sun.castShadow = true;
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun);

    this.resizeObserver = new ResizeObserver(() => this.onResize(canvas));
    this.resizeObserver.observe(canvas);
  }

  private onResize(canvas: HTMLCanvasElement): void {
    this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  }

  startRenderLoop(onFrame: (dt: number) => void): void {
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      onFrame(dt);
      this.renderer.render(this.scene, this.camera);
      this.animFrameId = requestAnimationFrame(frame);
    };
    this.animFrameId = requestAnimationFrame(frame);
  }

  stopRenderLoop(): void {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
  }

  dispose(): void {
    this.stopRenderLoop();
    this.resizeObserver.disconnect();
    this.renderer.dispose();
  }

  followTarget(targetPos: THREE.Vector3, targetRot: THREE.Quaternion): void {
    const offset = new THREE.Vector3(0, 5, 12);
    offset.applyQuaternion(targetRot);
    const desiredPos = targetPos.clone().add(offset);
    this.camera.position.lerp(desiredPos, 0.12);
    const lookTarget = targetPos.clone().add(new THREE.Vector3(0, 1, 0));
    this.camera.lookAt(lookTarget);
  }
}
