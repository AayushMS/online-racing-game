// packages/server/src/physics/PhysicsWorld.ts
import * as CANNON from 'cannon-es';

export function createPhysicsWorld(): CANNON.World {
  const world = new CANNON.World();
  world.gravity.set(0, -20, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;

  // Ground plane
  const groundShape = new CANNON.Plane();
  const ground = new CANNON.Body({ mass: 0 });
  ground.addShape(groundShape);
  ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(ground);

  return world;
}
