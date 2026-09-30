import {
  CENTER_LANE,
  FAST_FALL_SPEED,
  JUMP_DURATION,
  JUMP_HEIGHT,
  LANE_CHANGE_TIME,
  LANE_COUNT,
  LANE_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_SLIDE_HEIGHT,
  SLIDE_DURATION,
  TILT_MAX_SPEED,
  TILT_RANGE,
} from '../config';

export type Vertical = 'run' | 'jump' | 'slide';

/** Lateral offset (track space) of a lane's center. */
export function laneToX(lane: number): number {
  return (lane - CENTER_LANE) * LANE_WIDTH;
}

function easeOutQuad(t: number): number {
  return t * (2 - t);
}

/** Jump height at `t` seconds into a jump (parabola, zero at both ends). */
export function jumpHeightAt(t: number): number {
  if (t <= 0 || t >= JUMP_DURATION) return 0;
  const u = t / JUMP_DURATION;
  return 4 * JUMP_HEIGHT * u * (1 - u);
}

/**
 * Player motion state in track space: lane switching, jump, slide, fast-fall.
 * Forward motion (path distance) is owned by the simulation.
 */
export class Player {
  /** Target lane index (0 = left). */
  lane = CENTER_LANE;
  /** Current lateral offset in meters. */
  x = 0;
  /** Current feet height above the floor. */
  y = 0;
  vertical: Vertical = 'run';
  /** Seconds since the current jump/slide started. */
  actionTime = 0;
  prevX = 0;
  prevY = 0;
  private fromX = 0;
  private laneT = 1;
  /** Lane before the most recent lane change (for bounce-back on side hits). */
  previousLane = CENTER_LANE;
  /** Lane-free (tilt) steering: x chases `tiltTarget` instead of snapping between lanes. */
  freeLateral = false;
  private tiltTarget = 0;

  reset(): void {
    this.lane = CENTER_LANE;
    this.previousLane = CENTER_LANE;
    this.x = this.prevX = this.fromX = 0;
    this.y = this.prevY = 0;
    this.laneT = 1;
    this.vertical = 'run';
    this.actionTime = 0;
    this.freeLateral = false;
    this.tiltTarget = 0;
  }

  /** Lateral target for tilt steering (clamped to the track). */
  setTiltTarget(x: number): void {
    this.tiltTarget = x < -TILT_RANGE ? -TILT_RANGE : x > TILT_RANGE ? TILT_RANGE : x;
  }

  get isChangingLane(): boolean {
    return this.laneT < 1;
  }

  get grounded(): boolean {
    return this.vertical !== 'jump' && this.y <= 0;
  }

  get isSliding(): boolean {
    return this.vertical === 'slide';
  }

  get colliderHeight(): number {
    return this.vertical === 'slide' ? PLAYER_SLIDE_HEIGHT : PLAYER_HEIGHT;
  }

  /** Starts an eased move one lane over. Returns false at the track edge. */
  changeLane(dir: -1 | 1): boolean {
    if (this.freeLateral) return false;
    const target = this.lane + dir;
    if (target < 0 || target >= LANE_COUNT) return false;
    this.previousLane = this.lane;
    this.fromX = this.x;
    this.lane = target;
    this.laneT = 0;
    return true;
  }

  /** Moves to a lane with the standard easing (or instantly), e.g. bounce-back or turn reset. */
  setLane(lane: number, instant: boolean): void {
    this.previousLane = lane;
    this.lane = lane;
    if (instant) {
      this.x = this.prevX = this.fromX = laneToX(lane);
      this.laneT = 1;
    } else {
      this.fromX = this.x;
      this.laneT = 0;
    }
  }

  /** Jumps from the ground or out of a slide. Returns false while airborne. */
  jump(): boolean {
    if (this.vertical === 'jump' || this.y > 0) return false;
    this.vertical = 'jump';
    this.actionTime = 0;
    return true;
  }

  /** Slides; from mid-air this cancels the jump into a fast-fall. Always succeeds. */
  slide(): boolean {
    this.vertical = 'slide';
    this.actionTime = 0;
    return true;
  }

  update(dt: number): void {
    this.prevX = this.x;
    this.prevY = this.y;

    if (this.freeLateral && this.laneT >= 1) {
      const step = TILT_MAX_SPEED * dt;
      const d = this.tiltTarget - this.x;
      this.x += d < -step ? -step : d > step ? step : d;
      const lane = Math.max(
        0,
        Math.min(LANE_COUNT - 1, Math.round(this.x / LANE_WIDTH) + CENTER_LANE),
      );
      if (lane !== this.lane) {
        this.previousLane = this.lane;
        this.lane = lane;
      }
    } else if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / LANE_CHANGE_TIME);
      const target = laneToX(this.lane);
      this.x = this.fromX + (target - this.fromX) * easeOutQuad(this.laneT);
    } else {
      this.x = laneToX(this.lane);
    }

    this.actionTime += dt;
    if (this.vertical === 'jump') {
      if (this.actionTime >= JUMP_DURATION) {
        this.vertical = 'run';
        this.y = 0;
      } else {
        this.y = jumpHeightAt(this.actionTime);
      }
    } else {
      if (this.y > 0) this.y = Math.max(0, this.y - FAST_FALL_SPEED * dt);
      if (this.vertical === 'slide' && this.actionTime >= SLIDE_DURATION) this.vertical = 'run';
    }
  }
}
