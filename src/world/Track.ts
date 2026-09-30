import { CORNER_SIZE } from '../config';
import { DIR_X, DIR_Z, rightOf } from './Heading';
import type { Segment } from './Segment';
import type { SegmentPool } from './SegmentPool';

/** Mutable output for `worldAt` (reuse one instance; never allocate per frame). */
export class WorldPoint {
  x = 0;
  z = 0;
  heading = 0;
}

/** The active segment containing path distance `s` (clamped to the pool's range). */
export function segmentAt(pool: SegmentPool, s: number): Segment | null {
  if (pool.count === 0) return null;
  for (let i = 0; i < pool.count; i++) {
    const seg = pool.at(i);
    if (s < seg.endS) return seg;
  }
  return pool.at(pool.count - 1);
}

/**
 * World position of track-space point (s, x). Inside a corner block the point follows the
 * entry direction up to the pivot and the exit direction after it, like the runner does.
 */
export function worldAt(pool: SegmentPool, s: number, x: number, out: WorldPoint): boolean {
  const seg = segmentAt(pool, s);
  if (!seg) return false;
  const local = Math.max(0, s - seg.startS);
  const half = CORNER_SIZE / 2;
  let h = seg.heading;
  let ox = seg.originX;
  let oz = seg.originZ;
  let along = local;
  if (seg.isCorner && local > half) {
    ox += DIR_X[h]! * half;
    oz += DIR_Z[h]! * half;
    h = seg.exitHeading;
    along = local - half;
  }
  const r = rightOf(h);
  out.x = ox + DIR_X[h]! * along + DIR_X[r]! * x;
  out.z = oz + DIR_Z[h]! * along + DIR_Z[r]! * x;
  out.heading = h;
  return true;
}
