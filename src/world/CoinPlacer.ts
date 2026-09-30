import {
  BEAM_BOTTOM,
  CRUMBLE_GAP_LENGTH,
  JUMP_DURATION,
  LANE_COUNT,
  LOW_BARRIER_HEIGHT,
} from '../config';
import type { Rng } from '../core/Rng';
import { jumpHeightAt, laneToX } from '../entities/Player';
import type { PowerUpKind } from '../entities/PowerUp';
import type { Pattern } from './ObstaclePatterns';
import { actionFor } from './PatternValidator';
import type { Segment } from './Segment';

export const COIN_Y = 0.9;
const COIN_SPACING = 2.4;
const ARC_COINS = 5;
/** Coins ride a little above the runner's feet so a centered jump sweeps through them. */
const ARC_LIFT = 0.8;

/** True if a coin at (s, lane, y) would sit inside or on top of an obstacle. */
function blocked(seg: Segment, s: number, lane: number, y: number): boolean {
  for (let i = 0; i < seg.obstacleCount; i++) {
    const o = seg.obstacles[i]!;
    if (o.kind === 'gap') {
      if (y < 1.2 && s > o.s0 - 0.3 && s < o.s1 + 0.3) return true;
      continue;
    }
    if (!o.blocksLane(lane) || s < o.s0 - 0.8 || s > o.s1 + 0.8) continue;
    if (o.kind === 'pillar') return true;
    if (o.kind === 'low' && y < LOW_BARRIER_HEIGHT + 0.35) return true;
    if (o.kind === 'beam' && y > BEAM_BOTTOM - 0.35) return true;
  }
  return false;
}

function add(seg: Segment, s: number, lane: number, y: number): void {
  if (s <= seg.startS + 0.5 || s >= seg.endS - 0.5) return;
  if (blocked(seg, s, lane, y)) return;
  seg.addCoin(s, laneToX(lane), y);
}

function line(seg: Segment, s0: number, s1: number, lane: number, y = COIN_Y): void {
  for (let s = s0; s <= s1; s += COIN_SPACING) add(seg, s, lane, y);
}

/** Coins following the arc of a jump centered on `center`. */
function arc(seg: Segment, center: number, lane: number, speed: number): void {
  const span = speed * JUMP_DURATION * 0.8;
  for (let i = 0; i < ARC_COINS; i++) {
    const u = i / (ARC_COINS - 1) - 0.5;
    const t = JUMP_DURATION / 2 + u * JUMP_DURATION * 0.8;
    add(seg, center + u * span, lane, jumpHeightAt(t) + ARC_LIFT);
  }
}

/** Coins for a straight carrying `pattern` (first row centered at `firstCenter`). */
export function placePatternCoins(
  seg: Segment,
  rng: Rng,
  pattern: Pattern,
  firstCenter: number,
  slot: number,
  speed: number,
): void {
  // A lead-in line guiding the eye toward the first obstacle.
  const leadLane = rng.int(0, LANE_COUNT - 1);
  line(seg, seg.startS + 3, firstCenter - slot * 0.5, leadLane, COIN_Y);
  for (const row of pattern.rows) {
    if (!rng.chance(0.7)) continue;
    const center = firstCenter + row.at * slot;
    const start = rng.int(0, LANE_COUNT - 1);
    for (let n = 0; n < LANE_COUNT; n++) {
      const lane = (start + n) % LANE_COUNT;
      const act = actionFor(row.cells[lane]!);
      if (act === null) continue;
      if (act === 'jump') arc(seg, center, lane, speed);
      else if (act === 'slide') line(seg, center - 1.2, center + 1.2, lane, 0.45);
      else line(seg, center - 2.4, center + 2.4, lane);
      break;
    }
  }
}

/** Coins for an obstacle-free straight: a lane-hopping trail or a playful arc. */
export function placeBreatherCoins(seg: Segment, rng: Rng, speed: number): void {
  let lane = rng.int(0, LANE_COUNT - 1);
  let s = seg.startS + 4;
  const end = seg.endS - 4;
  while (s < end) {
    if (rng.chance(0.2) && s + speed * JUMP_DURATION < end) {
      arc(seg, s + (speed * JUMP_DURATION) / 2, lane, speed);
      s += speed * JUMP_DURATION + COIN_SPACING;
    } else {
      const run = Math.min(end, s + COIN_SPACING * rng.int(4, 7));
      line(seg, s, run, lane);
      s = run + COIN_SPACING;
    }
    lane = Math.max(0, Math.min(LANE_COUNT - 1, lane + rng.int(-1, 1)));
  }
}

/** A coin trail leading onto the bridge and an arc over its crumbling section. */
export function placeBridgeCoins(seg: Segment, rng: Rng, speed: number): void {
  const lane = rng.int(0, LANE_COUNT - 1);
  line(seg, seg.startS + 3, seg.crumbleS - speed * JUMP_DURATION * 0.5, lane);
  arc(seg, seg.crumbleS + CRUMBLE_GAP_LENGTH / 2, lane, speed);
}

const POWERUP_WEIGHTS = [0.4, 0.35, 0.25];
const POWERUP_ORDER: readonly PowerUpKind[] = ['magnet', 'shield', 'surge'];

/** Places a power-up orb at `s` in a random clear lane. */
export function placePowerUp(seg: Segment, rng: Rng, s: number): boolean {
  const kind = POWERUP_ORDER[rng.weightedIndex(POWERUP_WEIGHTS)]!;
  const start = rng.int(0, LANE_COUNT - 1);
  for (let n = 0; n < LANE_COUNT; n++) {
    const lane = (start + n) % LANE_COUNT;
    if (blocked(seg, s, lane, 1.0)) continue;
    seg.addPickup(kind, s, laneToX(lane), 1.0);
    return true;
  }
  return false;
}
