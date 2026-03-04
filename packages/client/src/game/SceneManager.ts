// packages/client/src/game/SceneManager.ts
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;

  private animFrameId: number | null = null;
  private resizeObserver!: ResizeObserver;

  // Spring-damper state
  private camVelocity = new THREE.Vector3();
  private lookAtCurrent = new THREE.Vector3(0, 0, 0);
  private lookAtVelocity = new THREE.Vector3();

  // Screen shake state
  private shakeAmplitude = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 80, 200);

    this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
    this.camera.position.set(0, 8, 20);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // CSS2D renderer for name tags — attach to canvas parent
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    canvas.parentElement?.appendChild(this.labelRenderer.domElement);

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
    this.labelRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
  }

  triggerShake(amplitude = 0.4): void {
    this.shakeAmplitude = Math.max(this.shakeAmplitude, amplitude);
  }

  startRenderLoop(onFrame: (dt: number) => void): void {
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      onFrame(dt);
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
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
    this.labelRenderer.domElement.remove();
  }

  followTarget(targetPos: THREE.Vector3, targetRot: THREE.Quaternion, dt: number): void {
    const k = 15, d = 8;

    // Desired camera position: behind + above kart
    const offset = new THREE.Vector3(0, 5, 12);
    offset.applyQuaternion(targetRot);
    const desired = targetPos.clone().add(offset);

    // Spring-damper: F = k*(desired - pos) - d*vel
    const displacement = new THREE.Vector3().subVectors(desired, this.camera.position);
    const springF = displacement.multiplyScalar(k);
    const dampF = this.camVelocity.clone().multiplyScalar(d);
    this.camVelocity.addScaledVector(springF.sub(dampF), dt);
    this.camera.position.addScaledVector(this.camVelocity, dt);

    // Screen shake
    if (this.shakeAmplitude > 0.01) {
      this.shakeAmplitude *= Math.exp(-8 * dt);
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmplitude;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmplitude;
    } else {
      this.shakeAmplitude = 0;
    }

    // LookAt spring: look ahead of kart
    const forward = new THREE.Vector3(0, 0, -6).applyQuaternion(targetRot);
    const lookTarget = targetPos.clone().add(forward).add(new THREE.Vector3(0, 1, 0));
    const lookDisp = new THREE.Vector3().subVectors(lookTarget, this.lookAtCurrent);
    const lookSpring = lookDisp.multiplyScalar(12);
    const lookDamp = this.lookAtVelocity.clone().multiplyScalar(7);
    this.lookAtVelocity.addScaledVector(lookSpring.sub(lookDamp), dt);
    this.lookAtCurrent.addScaledVector(this.lookAtVelocity, dt);
    this.camera.lookAt(this.lookAtCurrent);
  }
}
