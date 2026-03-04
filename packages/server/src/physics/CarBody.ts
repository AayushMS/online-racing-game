// packages/server/src/physics/CarBody.ts
import * as CANNON from 'cannon-es';
import { CAR_MAX_SPEED, CAR_ACCELERATION, CAR_BRAKE_DECEL, CAR_TURN_SPEED, PlayerInputPayload } from '@racing/shared';

export type PlayerInput = PlayerInputPayload;

const CAR_HALF_EXTENTS = new CANNON.Vec3(0.9, 0.4, 1.8);

export class CarBody {
  body: CANNON.Body;
  private currentSpeed = 0;

  constructor(world: CANNON.World, startPos: CANNON.Vec3, startQuat?: CANNON.Quaternion) {
    const shape = new CANNON.Box(CAR_HALF_EXTENTS);
    this.body = new CANNON.Body({ mass: 150, linearDamping: 0.4, angularDamping: 0.99 });
    this.body.addShape(shape);
    this.body.position.copy(startPos);
    if (startQuat) this.body.quaternion.copy(startQuat);
    this.body.angularFactor.set(0, 1, 0); // lock pitch and roll — only yaw allowed
    world.addBody(this.body);
  }

  applyInput(input: PlayerInput, dt: number, speedMultiplier = 1.0): void {
    const { throttle, brake, steer } = input;
    const maxSpeed = CAR_MAX_SPEED * speedMultiplier;

    // Acceleration / braking
    if (throttle > 0) {
      this.currentSpeed = Math.min(this.currentSpeed + CAR_ACCELERATION * dt * throttle, maxSpeed);
    } else if (brake > 0) {
      this.currentSpeed = Math.max(this.currentSpeed - CAR_BRAKE_DECEL * dt * brake, 0);
    } else {
      // Natural friction
      this.currentSpeed = Math.max(this.currentSpeed - CAR_BRAKE_DECEL * 0.2 * dt, 0);
    }

    // Forward direction from body quaternion
    const forward = new CANNON.Vec3(0, 0, -1);
    this.body.quaternion.vmult(forward, forward);

    // Apply velocity
    this.body.velocity.set(
      forward.x * this.currentSpeed,
      this.body.velocity.y, // preserve gravity
      forward.z * this.currentSpeed
    );

    // Steering — only when moving
    if (this.currentSpeed > 0.5) {
      const turnAmount = -steer * CAR_TURN_SPEED * (this.currentSpeed / maxSpeed) * dt;
      const rot = new CANNON.Quaternion();
      rot.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), turnAmount);
      this.body.quaternion = rot.mult(this.body.quaternion);
    }
  }

  getSpeed(): number {
    return this.currentSpeed;
  }
}
