import { TURN_BLEND_TIME } from '../config';
import { headingYaw } from '../world/Heading';

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
}

/**
 * Smooths the instantaneous simulation turn into a ~200 ms visual rotation, plus a
 * decaying positional offset that hides the snap to the new run's center lane.
 * Shared by the player view and camera so they stay in sync.
 */
export class TurnBlend {
  yaw = 0;
  offsetX = 0;
  offsetZ = 0;
  private fromYaw = 0;
  private toYaw = 0;
  private fromOffX = 0;
  private fromOffZ = 0;
  private t = 1;

  reset(heading: number): void {
    this.yaw = this.fromYaw = this.toYaw = headingYaw(heading);
    this.offsetX = this.offsetZ = this.fromOffX = this.fromOffZ = 0;
    this.t = 1;
  }

  /** Starts blending toward `heading`; (offX, offZ) = old visual position − new position. */
  start(heading: number, offX: number, offZ: number): void {
    let target = headingYaw(heading);
    // Take the shortest arc from the current yaw.
    while (target - this.yaw > Math.PI) target -= Math.PI * 2;
    while (target - this.yaw < -Math.PI) target += Math.PI * 2;
    this.fromYaw = this.yaw;
    this.toYaw = target;
    this.fromOffX = this.offsetX + offX;
    this.fromOffZ = this.offsetZ + offZ;
    this.t = 0;
  }

  update(dt: number): void {
    if (this.t >= 1) return;
    this.t = Math.min(1, this.t + dt / TURN_BLEND_TIME);
    const e = easeInOut(this.t);
    this.yaw = this.fromYaw + (this.toYaw - this.fromYaw) * e;
    this.offsetX = this.fromOffX * (1 - e);
    this.offsetZ = this.fromOffZ * (1 - e);
  }
}
