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

/** Empty "breathing room" between patterns, in slots. Shrinks as difficulty rises. */
export function restSlotsAt(difficulty: number): number {
  return 1.6 - 0.9 * clamp01(difficulty);
}

/** Probability that a run of straights ends in a corner after each pattern. */
export function cornerChanceAt(difficulty: number): number {
  return 0.22 + 0.18 * clamp01(difficulty);
}
