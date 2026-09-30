/**
 * Fixed-timestep accumulator. Feed it real frame time; it runs the simulation in
 * fixed steps and returns the interpolation factor for rendering.
 */
export class FixedStepLoop {
  private accumulator = 0;
  /** Number of steps executed during the last `advance` call. */
  lastSteps = 0;

  constructor(
    readonly step: number,
    private readonly maxSteps: number,
  ) {}

  reset(): void {
    this.accumulator = 0;
    this.lastSteps = 0;
  }

  /**
   * Advances by `frameSeconds`, calling `update(step)` zero or more times.
   * Excess time beyond `maxSteps` is dropped (spiral-of-death protection).
   * @returns interpolation alpha in [0, 1).
   */
  advance(frameSeconds: number, update: (dt: number) => void): number {
    this.accumulator += Math.max(0, frameSeconds);
    let steps = 0;
    while (this.accumulator >= this.step && steps < this.maxSteps) {
      update(this.step);
      this.accumulator -= this.step;
      steps++;
    }
    if (steps === this.maxSteps && this.accumulator >= this.step) this.accumulator = 0;
    this.lastSteps = steps;
    return this.accumulator / this.step;
  }
}

/** Drives a callback from requestAnimationFrame with frame-time in seconds. */
export class RafDriver {
  private handle = 0;
  private last = -1;
  private running = false;

  constructor(private readonly onFrame: (frameSeconds: number, now: number) => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = -1;
    this.handle = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.handle);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const dt = this.last < 0 ? 0 : Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.onFrame(dt, now);
    this.handle = requestAnimationFrame(this.frame);
  };
}
