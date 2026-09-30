import { TILT_RANGE } from '../config';

/** Degrees of tilt that map to the full lateral range, and a small dead zone. */
const FULL_TILT = 22;
const DEAD_ZONE = 2.5;

interface PermissionCapable {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

/**
 * Optional tilt steering: maps the phone's left/right tilt (relative to how it was held when
 * the run started) to a lateral target position for the lane-free mode.
 */
export class TiltInput {
  private tilt = 0;
  private neutral = 0;
  private listening = false;
  private received = false;

  static get supported(): boolean {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
  }

  /** Must run inside a user gesture (iOS asks for permission). Returns true when active. */
  async enable(): Promise<boolean> {
    if (!TiltInput.supported) return false;
    const ctor = window.DeviceOrientationEvent as unknown as PermissionCapable;
    if (typeof ctor.requestPermission === 'function') {
      try {
        if ((await ctor.requestPermission()) !== 'granted') return false;
      } catch {
        return false;
      }
    }
    if (!this.listening) {
      window.addEventListener('deviceorientation', this.onOrientation);
      this.listening = true;
    }
    return true;
  }

  disable(): void {
    if (this.listening) window.removeEventListener('deviceorientation', this.onOrientation);
    this.listening = false;
    this.received = false;
  }

  /** True once real orientation data has arrived (desktops never send any). */
  get active(): boolean {
    return this.listening && this.received;
  }

  /** Treats the current hold angle as "straight ahead". */
  calibrate(): void {
    this.neutral = this.tilt;
  }

  /** Lateral target in meters for the runner. */
  target(): number {
    let d = this.tilt - this.neutral;
    if (Math.abs(d) < DEAD_ZONE) return 0;
    d -= Math.sign(d) * DEAD_ZONE;
    const t = d / (FULL_TILT - DEAD_ZONE);
    return (t < -1 ? -1 : t > 1 ? 1 : t) * TILT_RANGE;
  }

  private readonly onOrientation = (e: DeviceOrientationEvent): void => {
    if (e.gamma === null || e.beta === null) return;
    this.received = true;
    // Left/right tilt depends on how the screen is rotated.
    const angle = screen.orientation?.angle ?? 0;
    if (angle === 90) this.tilt = e.beta;
    else if (angle === 270 || angle === -90) this.tilt = -e.beta;
    else if (angle === 180) this.tilt = -e.gamma;
    else this.tilt = e.gamma;
  };
}
