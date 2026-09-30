import {
  INPUT_BUFFER_TIME,
  TURN_LATE_MARGIN,
  TURN_WINDOW_LEAD_TIME,
  TURN_WINDOW_MIN_LEAD,
} from '../config';
import type { Segment } from '../world/Segment';
import type { SegmentPool } from '../world/SegmentPool';

/** Path distance where the turn window opens (before the corner block, scaled by speed). */
export function turnWindowStart(corner: Segment, speed: number): number {
  return corner.startS - Math.max(TURN_WINDOW_MIN_LEAD, speed * TURN_WINDOW_LEAD_TIME);
}

/** Last path distance at which a turn is still possible before hitting the far wall. */
export function turnWindowEnd(corner: Segment): number {
  return corner.pivotS + TURN_LATE_MARGIN;
}

/**
 * Distance before the window at which a lateral input is held as a turn intent
 * (so an input up to one buffer-time early still counts as a turn, not a lane change).
 */
export function turnIntentStart(corner: Segment, speed: number): number {
  return turnWindowStart(corner, speed) - speed * INPUT_BUFFER_TIME;
}

/** First corner in the pool with an id greater than `afterId` (i.e. not yet turned). */
export function nextCorner(pool: SegmentPool, afterId: number): Segment | null {
  for (let i = 0; i < pool.count; i++) {
    const seg = pool.at(i);
    if (seg.isCorner && seg.id > afterId) return seg;
  }
  return null;
}
