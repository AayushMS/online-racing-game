// packages/server/src/PowerUpManager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PowerUpManager } from './PowerUpManager';

const ITEM_BOX_POSITIONS = [
  { x: 0, y: 0.5, z: 0 },
  { x: 20, y: 0.5, z: 10 },
  { x: -20, y: 0.5, z: 10 },
  { x: 30, y: 0.5, z: -30 },
  { x: -30, y: 0.5, z: -30 },
  { x: 0, y: 0.5, z: -60 },
];

describe('PowerUpManager', () => {
  let mgr: PowerUpManager;

  beforeEach(() => {
    mgr = new PowerUpManager(ITEM_BOX_POSITIONS);
  });

  it('initializes all boxes as active', () => {
    expect(mgr.getBoxStates().every(b => b.active)).toBe(true);
  });

  it('awards a random item when player collects a box', () => {
    const result = mgr.collectBox('p1', 0);
    expect(result).not.toBeNull();
    expect(['missile', 'banana', 'boost', 'shield', 'oil']).toContain(result!.item);
  });

  it('deactivates box after collection', () => {
    mgr.collectBox('p1', 0);
    expect(mgr.getBoxStates()[0].active).toBe(false);
  });

  it('reactivates box after ITEM_BOX_RESPAWN_MS', () => {
    mgr.collectBox('p1', 0);
    mgr.tick(8001);
    expect(mgr.getBoxStates()[0].active).toBe(true);
  });

  it('launches missile effect when player fires', () => {
    mgr.collectBox('p1', 0);
    mgr.useItem('p1', 'missile', { x: 0, y: 0, z: 0 });
    expect(mgr.getActiveEffects().length).toBe(1);
    expect(mgr.getActiveEffects()[0].type).toBe('missile');
  });

  it('clears player item after use', () => {
    mgr.collectBox('p1', 0);
    const item = mgr.getPlayerItem('p1');
    mgr.useItem('p1', item!, { x: 0, y: 0, z: 0 });
    expect(mgr.getPlayerItem('p1')).toBeNull();
  });
});
