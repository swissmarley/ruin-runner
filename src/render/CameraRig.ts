import type * as THREE from 'three';

const BASE_DISTANCE = 6.2;
const BASE_HEIGHT = 3.3;
const LOOK_AHEAD = 7;
const LOOK_HEIGHT = 1.1;
const LATERAL_FOLLOW = 0.72;
const Y_FOLLOW = 0.45;

/**
 * Third-person chase camera. Follows the player's visual position with exponential
 * smoothing, rotates with the shared turn blend, and pulls back when the pursuer is close.
 */
export class CameraRig {
  private x = 0;
  private y = BASE_HEIGHT;
  private z = BASE_DISTANCE;
  private shake = 0;
  private shakeTime = 0;
  private initialized = false;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  reset(): void {
    this.initialized = false;
    this.shake = 0;
  }

  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  /**
   * @param px,py,pz  player visual position
   * @param yaw       visual heading yaw (radians)
   * @param lateral   player's lateral offset from the track center (meters)
   * @param closeness 0 = pursuer far, 1 = pursuer right behind
   */
  update(
    dt: number,
    px: number,
    py: number,
    pz: number,
    yaw: number,
    lateral: number,
    closeness: number,
  ): void {
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = -fz;
    const rz = fx;
    const dist = BASE_DISTANCE + closeness * 1.4;
    const height = BASE_HEIGHT + closeness * 0.6;
    // Anchor partway between the track center and the player so lane changes read clearly.
    const ax = px - rx * lateral * (1 - LATERAL_FOLLOW);
    const az = pz - rz * lateral * (1 - LATERAL_FOLLOW);
    const tx = ax - fx * dist;
    const ty = height + py * Y_FOLLOW;
    const tz = az - fz * dist;

    if (!this.initialized) {
      this.x = tx;
      this.y = ty;
      this.z = tz;
      this.initialized = true;
    }
    const k = 1 - Math.exp(-dt * 14);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * (1 - Math.exp(-dt * 8));
    this.z += (tz - this.z) * k;

    let sx = 0;
    let sy = 0;
    if (this.shake > 0.001) {
      this.shakeTime += dt;
      sx = Math.sin(this.shakeTime * 71) * this.shake;
      sy = Math.cos(this.shakeTime * 53) * this.shake;
      this.shake *= Math.exp(-dt * 7);
    }

    this.camera.position.set(this.x + sx, this.y + sy, this.z);
    this.camera.lookAt(ax + fx * LOOK_AHEAD, LOOK_HEIGHT + py * 0.3, az + fz * LOOK_AHEAD);
  }
}
