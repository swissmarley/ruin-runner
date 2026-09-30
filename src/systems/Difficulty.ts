import { SPEED_MAX, SPEED_MIN, SPEED_RAMP_TIME } from '../config';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Base run speed at `elapsed` seconds: a blend of linear and smoothstep so it starts
 * ramping gently, keeps climbing through the middle, and eases into the cap at ~3 min.
 */
export function speedAt(elapsed: number): number {
  const u = clamp01(elapsed / SPEED_RAMP_TIME);
  const smooth = u * u * (3 - 2 * u);
  return SPEED_MIN + (SPEED_MAX - SPEED_MIN) * (0.5 * u + 0.5 * smooth);
}

/** Overall difficulty in [0, 1], used to unlock harder patterns and denser spacing. */
export function difficultyAt(elapsed: number): number {
  return clamp01(elapsed / SPEED_RAMP_TIME);
}

/** Pattern tier unlocked at a difficulty level (0 = intro patterns … 3 = hardest). */
export function tierAt(difficulty: number): number {
  if (difficulty < 0.12) return 0;
  if (difficulty < 0.4) return 1;
  if (difficulty < 0.75) return 2;
  return 3;
}

/**
 * Empty "breathing room" before each pattern, in slots. Shrinks as difficulty rises but never
 * below one slot, which guarantees any row-to-row transition across patterns is feasible.
 */
export function restSlotsAt(difficulty: number): number {
  return Math.max(1, 1.9 - 0.9 * clamp01(difficulty));
}

/** Probability that a straight carries an obstacle pattern (vs. a breather with coins only). */
export function patternChanceAt(difficulty: number): number {
  return 0.72 + 0.23 * clamp01(difficulty);
}

/** Probability that a run of straights ends in a corner after each pattern. */
export function cornerChanceAt(difficulty: number): number {
  return 0.22 + 0.18 * clamp01(difficulty);
}

/** Distance covered after `t` seconds at base speed (closed-form integral of `speedAt`). */
export function distanceAtTime(t: number): number {
  const T = SPEED_RAMP_TIME;
  const range = SPEED_MAX - SPEED_MIN;
  if (t <= 0) return 0;
  if (t >= T) return SPEED_MIN * T + range * T * 0.5 + SPEED_MAX * (t - T);
  const u = t / T;
  return SPEED_MIN * t + range * T * (0.25 * u * u + 0.5 * u * u * u - 0.25 * u * u * u * u);
}

/**
 * Inverse of `distanceAtTime`. The generator uses it to derive difficulty from distance alone,
 * so a track is a pure function of its seed. Surges only make the player arrive *earlier*
 * (i.e. slower than estimated), so speed estimates from this are safe upper bounds.
 */
export function timeAtDistance(s: number): number {
  if (s <= 0) return 0;
  let lo = 0;
  let hi = 60;
  while (distanceAtTime(hi) < s) hi *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (distanceAtTime(mid) < s) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
