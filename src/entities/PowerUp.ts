import { POWERUP_DURATION } from '../config';

export type PowerUpKind = 'magnet' | 'shield' | 'surge';
export const POWERUP_KINDS: readonly PowerUpKind[] = ['magnet', 'shield', 'surge'];

/** A collectible power-up orb placed in track space. */
export class PowerUpPickup {
  kind: PowerUpKind = 'magnet';
  s = 0;
  x = 0;
  y = 0;
  collected = false;

  set(kind: PowerUpKind, s: number, x: number, y: number): void {
    this.kind = kind;
    this.s = s;
    this.x = x;
    this.y = y;
    this.collected = false;
  }
}

/** Remaining time for each active power-up (0 = inactive). */
export class PowerUpTimers {
  magnet = 0;
  shield = 0;
  surge = 0;

  reset(): void {
    this.magnet = this.shield = this.surge = 0;
  }

  activate(kind: PowerUpKind): void {
    this[kind] = POWERUP_DURATION;
  }

  isActive(kind: PowerUpKind): boolean {
    return this[kind] > 0;
  }

  tick(dt: number): void {
    this.magnet = Math.max(0, this.magnet - dt);
    this.shield = Math.max(0, this.shield - dt);
    this.surge = Math.max(0, this.surge - dt);
  }
}
