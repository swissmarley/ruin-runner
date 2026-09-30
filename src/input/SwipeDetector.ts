import type { Dir } from '../sim/InputBuffer';

/**
 * Turns a single touch's movement into at most one swipe direction.
 * Fires during `move` as soon as the finger passes `minDistance` (responsive),
 * using the dominant axis. Screen Y grows downward, so a negative dy is UP.
 */
export class SwipeDetector {
  private id = -1;
  private startX = 0;
  private startY = 0;
  private fired = false;

  constructor(readonly minDistance = 30) {}

  get tracking(): boolean {
    return this.id !== -1;
  }

  start(id: number, x: number, y: number): void {
    this.id = id;
    this.startX = x;
    this.startY = y;
    this.fired = false;
  }

  move(id: number, x: number, y: number): Dir | null {
    if (id !== this.id || this.fired) return null;
    const dir = this.classify(x - this.startX, y - this.startY);
    if (dir !== null) this.fired = true;
    return dir;
  }

  /** Ends tracking; returns a swipe if the finger crossed the threshold only at release. */
  end(id: number, x: number, y: number): Dir | null {
    if (id !== this.id) return null;
    const dir = this.fired ? null : this.classify(x - this.startX, y - this.startY);
    this.id = -1;
    return dir;
  }

  cancel(): void {
    this.id = -1;
  }

  private classify(dx: number, dy: number): Dir | null {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < this.minDistance) return null;
    if (ax > ay) return dx > 0 ? 'RIGHT' : 'LEFT';
    return dy > 0 ? 'DOWN' : 'UP';
  }
}
