import { PURSUER_FAR_GAP, PURSUER_NEAR_GAP, PURSUER_START_GAP, STUMBLE_WINDOW } from '../config';

/** Speed (m/s, relative) at which the Warden lunges in after a stumble. */
const LUNGE_SPEED = 30;
/** How quickly the start-of-run gap opens up (m/s). */
const START_RETREAT_SPEED = 3;

/**
 * The Stone Warden, modelled as a distance behind the runner. It starts close, falls back to
 * a far gap, lunges in on a stumble and slowly drops back over the stumble window.
 */
export class Pursuer {
  /** Current distance behind the runner (meters). */
  gap = PURSUER_START_GAP;
  prevGap = PURSUER_START_GAP;
  /** Lateral offset, lagging behind the runner's. */
  x = 0;
  prevX = 0;
  private target = PURSUER_FAR_GAP;
  private recover = 0;
  private lunging = false;
  caught = false;

  reset(): void {
    this.gap = this.prevGap = PURSUER_START_GAP;
    this.x = this.prevX = 0;
    this.target = PURSUER_FAR_GAP;
    this.recover = 0;
    this.lunging = false;
    this.caught = false;
  }

  /** 0 = far away (out of frame), 1 = right on the runner's heels. */
  get closeness(): number {
    const t = (PURSUER_FAR_GAP - this.gap) / (PURSUER_FAR_GAP - PURSUER_NEAR_GAP);
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }

  onStumble(): void {
    this.target = PURSUER_NEAR_GAP;
    this.lunging = true;
    this.recover = STUMBLE_WINDOW;
  }

  onCaught(): void {
    this.caught = true;
    this.lunging = true;
    this.target = 0.6;
  }

  update(dt: number, runnerX: number): void {
    this.prevGap = this.gap;
    this.prevX = this.x;
    this.recover = Math.max(0, this.recover - dt);
    if (this.lunging) {
      this.gap = Math.max(this.target, this.gap - LUNGE_SPEED * dt);
      if (this.gap <= this.target && !this.caught) {
        this.lunging = false;
        this.target = PURSUER_FAR_GAP;
      }
    } else if (this.gap < this.target) {
      // Drop back slowly during the stumble window so the threat lingers on screen.
      const rate = this.recover > 0 ? 0.35 : START_RETREAT_SPEED;
      this.gap = Math.min(this.target, this.gap + rate * dt);
    }
    this.x += (runnerX - this.x) * Math.min(1, dt * 4);
  }
}
