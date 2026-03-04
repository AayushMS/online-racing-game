// packages/client/src/game/KartPool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { PlayerState } from '@racing/shared';

vi.mock('three/examples/jsm/renderers/CSS2DRenderer.js', () => ({
  CSS2DObject: class {
    element = document.createElement('div');
    position = { set: vi.fn() };
  },
}));

vi.mock('./KartMesh', () => ({
  createKartMesh: () => {
    const group = new THREE.Group();
    group.add = vi.fn();
    return group;
  },
}));

import { KartPool } from './KartPool';

function makePlayer(id: string, x: number, z: number): PlayerState {
  return {
    id, nickname: 'Test', carIndex: 0,
    position: { x, y: 1, z }, rotation: { x: 0, y: 0, z: 0, w: 1 },
    speed: 0, heldItem: null, lap: 1, lapProgress: 0,
    finished: false, finishTime: null, bestLapMs: null, checkpointIdx: 0,
  };
}

describe('KartPool interpolation', () => {
  let scene: THREE.Scene;
  let pool: KartPool;

  beforeEach(() => {
    scene = new THREE.Scene();
    scene.add = vi.fn();
    scene.remove = vi.fn();
    pool = new KartPool(scene, 'p1');
  });

  it('interpolate(0) positions kart at previous server state', () => {
    pool.updateServerState({ p1: makePlayer('p1', 0, 0) });
    pool.updateServerState({ p1: makePlayer('p1', 10, 0) });

    pool.interpolate(0);
    const kart = pool.getKart('p1')!;
    expect(kart.position.x).toBeCloseTo(0, 1);
  });

  it('interpolate(1) positions kart at current server state', () => {
    pool.updateServerState({ p1: makePlayer('p1', 0, 0) });
    pool.updateServerState({ p1: makePlayer('p1', 10, 0) });

    pool.interpolate(1);
    const kart = pool.getKart('p1')!;
    expect(kart.position.x).toBeCloseTo(10, 1);
  });

  it('interpolate(0.5) positions kart halfway between states', () => {
    pool.updateServerState({ p1: makePlayer('p1', 0, 0) });
    pool.updateServerState({ p1: makePlayer('p1', 10, 0) });

    pool.interpolate(0.5);
    const kart = pool.getKart('p1')!;
    expect(kart.position.x).toBeCloseTo(5, 1);
  });

  it('removes kart from scene when player leaves', () => {
    pool.updateServerState({ p1: makePlayer('p1', 0, 0) });
    pool.updateServerState({});  // p1 disconnected
    expect(pool.getKart('p1')).toBeUndefined();
  });
});
