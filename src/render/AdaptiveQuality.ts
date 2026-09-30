import type { QualityLevel } from './Quality';
import { QUALITY_LEVELS } from './Quality';

/** Frame-time budget for 60 FPS plus a little slack for vsync jitter (seconds). */
export const FRAME_BUDGET = 1 / 60 + 0.0015;
/** Average frame time must exceed the budget for this long before stepping down. */
const DOWN_AFTER = 2;
/**
 * …and hold a full frame rate for this long before trying a step back up. Frame intervals are
 * vsync-quantised (never below 16.7 ms on a 60 Hz screen), so "full rate" is the only
 * headroom signal available. Doubles after every step down that follows a step up, so a
 * borderline device settles instead of oscillating.
 */
const UP_AFTER = 10;
const UP_AFTER_MAX = 160;
const FULL_RATE = 1 / 60 + 0.0006;
/** Frames longer than this are hitches (tab switch, GC) and are ignored. */
const OUTLIER = 0.25;
/** After any change, measurements restart after this settling time. */
const SETTLE = 1;
/** Beyond "low", the pixel ratio can still drop in these steps. */
export const LOW_PIXEL_SCALES = [1, 0.85, 0.7];

export interface QualityState {
  level: QualityLevel;
  /** Extra pixel-ratio multiplier applied on top of the "low" preset (1 = none). */
  pixelScale: number;
}

/**
 * Watches frame times and steps quality down when the budget is blown for a sustained
 * period (high → medium → low → lower resolution), or back up when there is headroom,
 * never above `ceiling` (the level the device started at). Pure logic: unit-testable.
 */
export class AdaptiveQuality {
  readonly state: QualityState;
  private avg = FRAME_BUDGET * 0.8;
  private over = 0;
  private under = 0;
  private settle = SETTLE;
  private lowStep = 0;
  private upAfter = UP_AFTER;
  private steppedUp = false;

  constructor(
    initial: QualityLevel,
    private readonly ceiling: QualityLevel = initial,
  ) {
    this.state = { level: initial, pixelScale: 1 };
  }

  reset(level: QualityLevel): void {
    this.state.level = level;
    this.state.pixelScale = 1;
    this.lowStep = 0;
    this.upAfter = UP_AFTER;
    this.steppedUp = false;
    this.restart();
  }

  /** Feeds one frame's duration. Returns true when the quality state changed. */
  sample(dt: number): boolean {
    if (dt <= 0 || dt > OUTLIER) return false;
    if (this.settle > 0) {
      this.settle -= dt;
      return false;
    }
    this.avg += (dt - this.avg) * 0.05;
    if (this.avg > FRAME_BUDGET) {
      this.over += dt;
      this.under = 0;
    } else if (this.avg < FULL_RATE) {
      this.under += dt;
      this.over = 0;
    } else {
      this.over = Math.max(0, this.over - dt);
      this.under = Math.max(0, this.under - dt);
    }
    if (this.over >= DOWN_AFTER) return this.stepDown();
    if (this.under >= this.upAfter) return this.stepUp();
    return false;
  }

  get averageFrameTime(): number {
    return this.avg;
  }

  private stepDown(): boolean {
    if (this.steppedUp) {
      this.upAfter = Math.min(UP_AFTER_MAX, this.upAfter * 2);
      this.steppedUp = false;
    }
    const i = QUALITY_LEVELS.indexOf(this.state.level);
    if (i > 0) {
      this.state.level = QUALITY_LEVELS[i - 1]!;
    } else if (this.lowStep < LOW_PIXEL_SCALES.length - 1) {
      this.state.pixelScale = LOW_PIXEL_SCALES[++this.lowStep]!;
    } else {
      this.restart();
      return false;
    }
    this.restart();
    return true;
  }

  private stepUp(): boolean {
    if (this.lowStep > 0) {
      this.state.pixelScale = LOW_PIXEL_SCALES[--this.lowStep]!;
      this.steppedUp = true;
      this.restart();
      return true;
    }
    const i = QUALITY_LEVELS.indexOf(this.state.level);
    if (i < QUALITY_LEVELS.indexOf(this.ceiling)) {
      this.state.level = QUALITY_LEVELS[i + 1]!;
      this.steppedUp = true;
      this.restart();
      return true;
    }
    this.restart();
    return false;
  }

  private restart(): void {
    this.over = 0;
    this.under = 0;
    this.settle = SETTLE;
    this.avg = FRAME_BUDGET * 0.8;
  }
}
