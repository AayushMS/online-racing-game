// packages/client/src/game/ClientPhysics.ts
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { CAR_MAX_SPEED, CAR_ACCELERATION, CAR_BRAKE_DECEL, CAR_TURN_SPEED, GRAVITY } from '@racing/shared';

export interface InputFrame {
  seq: number;
  steer: number;
  throttle: number;
  brake: number;
  timestamp: number;
}

export class ClientPhysics {
  private world: CANNON.World;
  private body: CANNON.Body;
  private currentSpeed = 0;
  private inputBuffer: InputFrame[] = [];

  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, GRAVITY, 0);

    const ground = new CANNON.Body({ mass: 0 });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(ground);

    this.body = new CANNON.Body({ mass: 150, linearDamping: 0.4, angularDamping: 0.99 });
    this.body.addShape(new CANNON.Box(new CANNON.Vec3(0.9, 0.4, 1.8)));
    this.body.position.set(0, 1, 10);
    this.world.addBody(this.body);
  }

  applyInput(frame: InputFrame, dt: number): void {
    const { throttle, brake, steer } = frame;
    if (throttle > 0) {
      this.currentSpeed = Math.min(this.currentSpeed + CAR_ACCELERATION * dt * throttle, CAR_MAX_SPEED);
    } else if (brake > 0) {
      this.currentSpeed = Math.max(this.currentSpeed - CAR_BRAKE_DECEL * dt * brake, 0);
    } else {
      this.currentSpeed = Math.max(this.currentSpeed - CAR_BRAKE_DECEL * 0.2 * dt, 0);
    }

    const forward = new CANNON.Vec3(0, 0, -1);
    this.body.quaternion.vmult(forward, forward);
    this.body.velocity.set(forward.x * this.currentSpeed, this.body.velocity.y, forward.z * this.currentSpeed);

    if (this.currentSpeed > 0.5) {
      const turnAmount = -steer * CAR_TURN_SPEED * (this.currentSpeed / CAR_MAX_SPEED) * dt;
      const rot = new CANNON.Quaternion();
      rot.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), turnAmount);
      this.body.quaternion = rot.mult(this.body.quaternion);
    }
  }

  tick(frame: InputFrame, dt: number): void {
    this.inputBuffer.push(frame);
    if (this.inputBuffer.length > 120) this.inputBuffer.shift();
    this.applyInput(frame, dt);
    this.world.step(dt);
  }

  reconcile(serverPos: CANNON.Vec3, serverQuat: CANNON.Quaternion, serverSeq: number, dt: number): void {
    this.body.position.copy(serverPos);
    this.body.quaternion.copy(serverQuat);
    this.currentSpeed = 0;
    const pendingInputs = this.inputBuffer.filter(f => f.seq > serverSeq);
    for (const frame of pendingInputs) {
      this.applyInput(frame, dt);
      this.world.step(dt);
    }
  }

  getPosition(): THREE.Vector3 {
    return new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
  }

  getQuaternion(): THREE.Quaternion {
    const q = this.body.quaternion;
    return new THREE.Quaternion(q.x, q.y, q.z, q.w);
  }

  setPosition(x: number, y: number, z: number): void {
    this.body.position.set(x, y, z);
  }
}
