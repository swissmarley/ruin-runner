import { LANE_COUNT, LANE_WIDTH, OBSTACLE_LANE_INSET } from '../config';
import { laneToX } from '../entities/Player';

/** Open-interval overlap test on one axis. */
export function overlaps(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

/** Lateral extent of an obstacle over a single lane (slightly inset for leniency). */
export function laneMinX(lane: number): number {
  return laneToX(lane) - LANE_WIDTH / 2 + OBSTACLE_LANE_INSET;
}

export function laneMaxX(lane: number): number {
  return laneToX(lane) + LANE_WIDTH / 2 - OBSTACLE_LANE_INSET;
}

/** True if the lateral span [x0, x1] touches any lane in `mask`. */
export function laneMaskOverlapsX(mask: number, x0: number, x1: number): boolean {
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    if ((mask & (1 << lane)) !== 0 && overlaps(x0, x1, laneMinX(lane), laneMaxX(lane))) return true;
  }
  return false;
}
