// packages/server/src/PowerupCollision.test.ts
import { describe, it, expect } from 'vitest';
import { GameLoop } from './GameLoop';
import { PowerUpManager } from './PowerUpManager';
import { ITEM_BOX_WORLD_POSITIONS } from '@racing/shared';

function advanceToRacing(loop: GameLoop): void {
  loop.startCountdown();
  for (let i = 0; i < 200; i++) loop.tick();
}

describe('Powerup Collection', () => {
  it('player collects item when within 3.5 units of active box', () => {
    const loop = new GameLoop(['p1']);
    const powerUps = new PowerUpManager(ITEM_BOX_WORLD_POSITIONS);
    advanceToRacing(loop);

    // Place player at first item box
    const box = ITEM_BOX_WORLD_POSITIONS[0];
    loop.state.players['p1'].position = { x: box.x, y: box.y, z: box.z };
    loop.state.players['p1'].heldItem = null;
    loop.state.players['p1'].activeBuff = undefined;

    loop.tickPowerUps(powerUps);

    const player = loop.state.players['p1'];
    const hasEffect = player.heldItem !== null || player.activeBuff !== undefined;
    expect(hasEffect).toBe(true);
  });

  it('item box deactivates after collection', () => {
    const loop = new GameLoop(['p1']);
    const powerUps = new PowerUpManager(ITEM_BOX_WORLD_POSITIONS);
    advanceToRacing(loop);

    const box = ITEM_BOX_WORLD_POSITIONS[0];
    loop.state.players['p1'].position = { x: box.x, y: box.y, z: box.z };
    loop.tickPowerUps(powerUps);

    expect(powerUps.getBoxStates()[0].active).toBe(false);
  });

  it('player cannot collect while already holding an item', () => {
    const loop = new GameLoop(['p1']);
    const powerUps = new PowerUpManager(ITEM_BOX_WORLD_POSITIONS);
    advanceToRacing(loop);

    loop.state.players['p1'].heldItem = 'banana';
    const box = ITEM_BOX_WORLD_POSITIONS[0];
    loop.state.players['p1'].position = { x: box.x, y: box.y, z: box.z };
    loop.tickPowerUps(powerUps);

    expect(loop.state.players['p1'].heldItem).toBe('banana');
    expect(powerUps.getBoxStates()[0].active).toBe(true);
  });

  it('missile travels forward each tick in PowerUpManager', () => {
    const powerUps = new PowerUpManager(ITEM_BOX_WORLD_POSITIONS);
    (powerUps as any).playerItems.set('p1', 'missile');
    const startPos = { x: 0, y: 1, z: 10 };
    powerUps.useItem('p1', startPos, { x: 0, y: 0, z: -1 });

    const before = { ...powerUps.getActiveEffects()[0].position };
    powerUps.tick(16.67);
    const after = powerUps.getActiveEffects()[0].position;

    expect(after.z).toBeLessThan(before.z); // moved forward (negative Z)
  });

  it('missile hit applies spinUntilTick to target', () => {
    const loop = new GameLoop(['p1', 'p2']);
    const powerUps = new PowerUpManager(ITEM_BOX_WORLD_POSITIONS);
    advanceToRacing(loop);

    // Place missile directly at p2 position
    const p2Pos = loop.state.players['p2'].position;
    (powerUps as any).playerItems.set('p1', 'missile');
    powerUps.useItem('p1', { x: p2Pos.x, y: p2Pos.y, z: p2Pos.z }, { x: 0, y: 0, z: -1 });

    loop.tickPowerUps(powerUps);

    expect(loop.state.players['p2'].spinUntilTick).toBeDefined();
    expect(loop.state.players['p2'].spinUntilTick!).toBeGreaterThan(loop.state.tick);
  });

  it('shield absorbs missile hit without applying spin', () => {
    const loop = new GameLoop(['p1', 'p2']);
    const powerUps = new PowerUpManager(ITEM_BOX_WORLD_POSITIONS);
    advanceToRacing(loop);

    loop.state.players['p2'].activeBuff = { type: 'shield', expiresAtTick: loop.state.tick + 300 };
    const p2Pos = loop.state.players['p2'].position;
    (powerUps as any).playerItems.set('p1', 'missile');
    powerUps.useItem('p1', { x: p2Pos.x, y: p2Pos.y, z: p2Pos.z }, { x: 0, y: 0, z: -1 });

    loop.tickPowerUps(powerUps);

    expect(loop.state.players['p2'].spinUntilTick).toBeUndefined();
    expect(loop.state.players['p2'].activeBuff).toBeUndefined(); // shield consumed
  });

  it('banana slows player on contact', () => {
    const loop = new GameLoop(['p1', 'p2']);
    const powerUps = new PowerUpManager(ITEM_BOX_WORLD_POSITIONS);
    advanceToRacing(loop);

    const p2Pos = loop.state.players['p2'].position;
    (powerUps as any).playerItems.set('p1', 'banana');
    powerUps.useItem('p1', { x: p2Pos.x, y: p2Pos.y, z: p2Pos.z });

    loop.tickPowerUps(powerUps);

    expect(loop.state.players['p2'].spinUntilTick).toBeDefined();
    expect(loop.state.players['p2'].spinUntilTick!).toBeGreaterThan(loop.state.tick);
  });
});
