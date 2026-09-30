import {
  BEAM_DEPTH,
  GAP_LENGTH,
  JUMP_DURATION,
  LANE_CHANGE_TIME,
  LANE_COUNT,
  LOW_DEPTH,
  PILLAR_DEPTH,
  PLAYER_HALF_DEPTH,
  SPEED_MIN,
} from '../config';
import type { CellType, Pattern, PatternRow } from './ObstaclePatterns';
import { SLOT_TIME } from './ObstaclePatterns';

export type Action = 'none' | 'jump' | 'slide';

/** Safety margin added to every transition (seconds). */
export const TRANSITION_MARGIN = 0.1;
/** Time for a fast-fall from the jump apex to low enough to slide under a beam. */
const FAST_FALL_TIME = 0.1;

/** How a lane with this cell is passed, or null if it cannot be passed. */
export function actionFor(cell: CellType): Action | null {
  switch (cell) {
    case 'free':
      return 'none';
    case 'low':
    case 'gap':
      return 'jump';
    case 'beam':
      return 'slide';
    case 'pillar':
      return null;
  }
}

export function cellDepth(cell: CellType): number {
  switch (cell) {
    case 'low':
      return LOW_DEPTH;
    case 'beam':
      return BEAM_DEPTH;
    case 'pillar':
      return PILLAR_DEPTH;
    case 'gap':
      return GAP_LENGTH;
    case 'free':
      return 0;
  }
}

/** Seconds (at `speed`) from a row's center until the player is fully clear of it. */
export function rowHalfTime(row: PatternRow, speed: number): number {
  let depth = 0;
  for (const c of row.cells) depth = Math.max(depth, cellDepth(c));
  return (depth / 2 + PLAYER_HALF_DEPTH) / speed;
}

/**
 * Minimum time between two row centers for the transition `from` → `to` with `laneChanges`
 * lane switches, given each row's half-clearance time (`hdA`, `hdB`).
 * Lane changes are allowed mid-air and mid-slide, but only between rows.
 */
export function requiredGap(
  from: Action,
  to: Action,
  laneChanges: number,
  hdA: number,
  hdB: number,
): number {
  const lateral = laneChanges > 0 ? hdA + laneChanges * LANE_CHANGE_TIME + hdB : hdA + hdB;
  let vertical = 0;
  if (from === 'jump' && to === 'jump') vertical = JUMP_DURATION;
  else if (from === 'jump' && to === 'slide') vertical = hdA + FAST_FALL_TIME + hdB;
  else if (from === 'slide' && to === 'jump') vertical = hdA + JUMP_DURATION / 2;
  return Math.max(lateral, vertical) + TRANSITION_MARGIN;
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Proves a pattern is beatable: every row has a passable lane, rows are ordered, and a lane
 * path exists whose every transition fits in the time between rows. Timing uses the slowest
 * speed (longest clearance times); row spacing is in time units, so faster is never harder
 * in terms of transitions.
 */
export function validatePattern(p: Pattern, speed = SPEED_MIN): ValidationResult {
  const rows = p.rows;
  if (rows.length === 0) return { ok: false, reason: 'no rows' };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (!row.cells.some((c) => actionFor(c) !== null)) {
      return { ok: false, reason: `row ${i} has no passable lane` };
    }
    const gaps = row.cells.filter((c) => c === 'gap').length;
    if (gaps !== 0 && gaps !== LANE_COUNT) return { ok: false, reason: `row ${i}: partial gap` };
    if (i > 0 && row.at <= rows[i - 1]!.at) return { ok: false, reason: `row ${i} out of order` };
  }

  // reachable[lane] = true if the player can be in `lane` when crossing the current row.
  let reachable = rows[0]!.cells.map((c) => actionFor(c) !== null);
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]!;
    const b = rows[i]!;
    const dt = (b.at - a.at) * SLOT_TIME;
    const hdA = rowHalfTime(a, speed);
    const hdB = rowHalfTime(b, speed);
    const next = [false, false, false];
    for (let la = 0; la < LANE_COUNT; la++) {
      if (!reachable[la]) continue;
      const actA = actionFor(a.cells[la]!)!;
      for (let lb = 0; lb < LANE_COUNT; lb++) {
        const actB = actionFor(b.cells[lb]!);
        if (actB === null) continue;
        if (dt >= requiredGap(actA, actB, Math.abs(la - lb), hdA, hdB)) next[lb] = true;
      }
    }
    if (!next.some(Boolean)) return { ok: false, reason: `no feasible path into row ${i}` };
    reachable = next;
  }
  return { ok: true };
}
