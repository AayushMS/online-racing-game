// packages/client/src/game/SceneManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';

// Mock CSS2DRenderer since it needs DOM
vi.mock('three/examples/jsm/renderers/CSS2DRenderer.js', () => ({
  CSS2DRenderer: class {
    domElement = document.createElement('div');
    setSize = vi.fn();
    render = vi.fn();
  },
  CSS2DObject: class {
    element: HTMLElement;
    position = { set: vi.fn() };
    constructor(el: HTMLElement) { this.element = el; }
  },
}));

// Mock WebGLRenderer
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three');
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement('canvas');
      setSize = vi.fn();
      setPixelRatio = vi.fn();
      shadowMap = { enabled: false, type: 0 };
      render = vi.fn();
      dispose = vi.fn();
    },
  };
});

// Stub browser globals not available in happy-dom
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  disconnect() {}
});

import { SceneManager } from './SceneManager';

describe('SceneManager camera', () => {
  let canvas: HTMLCanvasElement;
  let scene: SceneManager;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 800 });
    Object.defineProperty(canvas, 'clientHeight', { value: 600 });
    document.body.appendChild(canvas);
    scene = new SceneManager(canvas);
  });

  it('spring-damper converges camera toward target position over time', () => {
    const targetPos = new THREE.Vector3(50, 0, 50);
    const targetRot = new THREE.Quaternion();
    const dt = 1 / 60;

    const startDist = scene.camera.position.distanceTo(targetPos);

    // Simulate 120 frames (~2 seconds)
    for (let i = 0; i < 120; i++) {
      scene.followTarget(targetPos, targetRot, dt);
    }

    const endDist = scene.camera.position.distanceTo(targetPos);
    expect(endDist).toBeLessThan(startDist);
  });

  it('triggerShake sets positive shakeAmplitude', () => {
    scene.triggerShake(0.5);
    expect((scene as any).shakeAmplitude).toBeCloseTo(0.5);
  });

  it('shake amplitude decays to near zero after enough frames', () => {
    scene.triggerShake(0.5);
    const targetPos = new THREE.Vector3(0, 0, 0);
    const targetRot = new THREE.Quaternion();
    for (let i = 0; i < 120; i++) scene.followTarget(targetPos, targetRot, 1 / 60);
    expect((scene as any).shakeAmplitude).toBeLessThan(0.01);
  });
});
