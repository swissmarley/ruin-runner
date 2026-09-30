/** Thin wrapper around `navigator.vibrate` that respects the haptics setting. */
export class Haptics {
  enabled = true;
  private readonly supported =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  pulse(ms: number | number[]): void {
    if (!this.enabled || !this.supported) return;
    try {
      navigator.vibrate(ms);
    } catch {
      // Some browsers throw when vibration is blocked (e.g. no user activation yet).
    }
  }
}
