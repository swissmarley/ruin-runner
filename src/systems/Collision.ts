import {
  BEAM_BOTTOM,
  BEAM_TOP,
  GAP_EDGE_GRACE,
  LOW_BARRIER_HEIGHT,
  PILLAR_HEIGHT,
  PLAYER_HALF_DEPTH,
  PLAYER_HALF_WIDTH,
} from '../config';
import type { Player } from '../entities/Player';
import type { Obstacle, Segment } from '../world/Segment';
import type { SegmentPool } from '../world/SegmentPool';
import { laneMaskOverlapsX, overlaps } from './Physics';

export type HitKind = 'stumble' | 'fatal' | 'sideHit' | 'pit';

/** Receives collision outcomes; implemented by the simulation. */
export interface CollisionHandler {
  onObstacleHit(o: Obstacle, kind: HitKind): void;
}

function obstacleTop(o: Obstacle): number {
  switch (o.kind) {
    case 'low':
      return LOW_BARRIER_HEIGHT;
    case 'pillar':
      return PILLAR_HEIGHT;
    case 'beam':
      return BEAM_TOP;
    case 'gap':
      return 0;
  }
}

function obstacleBottom(o: Obstacle): number {
  return o.kind === 'beam' ? BEAM_BOTTOM : 0;
}

/**
 * Tests the player against nearby obstacles in track space and reports hits.
 * `prevS` distinguishes a pillar hit head-on (fatal) from sliding into its side (stumble).
 */
export function checkCollisions(
  pool: SegmentPool,
  player: Player,
  s: number,
  prevS: number,
  handler: CollisionHandler,
): void {
  const ps0 = s - PLAYER_HALF_DEPTH;
  const ps1 = s + PLAYER_HALF_DEPTH;
  const px0 = player.x - PLAYER_HALF_WIDTH;
  const px1 = player.x + PLAYER_HALF_WIDTH;
  const py0 = player.y;
  const py1 = player.y + player.colliderHeight;

  for (let i = 0; i < pool.count; i++) {
    const seg: Segment = pool.at(i);
    if (seg.endS < ps0 || seg.startS > ps1 + 4) continue;
    for (let k = 0; k < seg.obstacleCount; k++) {
      const o = seg.obstacles[k]!;
      if (o.hit) continue;
      if (o.kind === 'gap') {
        // Falling needs the player's center over the hole while on the ground.
        if (player.grounded && s > o.s0 + GAP_EDGE_GRACE && s < o.s1 - GAP_EDGE_GRACE) {
          handler.onObstacleHit(o, 'pit');
        }
        continue;
      }
      if (!overlaps(ps0, ps1, o.s0, o.s1)) continue;
      if (!laneMaskOverlapsX(o.laneMask, px0, px1)) continue;
      if (!overlaps(py0, py1, obstacleBottom(o), obstacleTop(o))) continue;

      if (o.kind === 'low') handler.onObstacleHit(o, 'stumble');
      else if (o.kind === 'beam') handler.onObstacleHit(o, 'fatal');
      else {
        // Pillar: if we already overlapped it along the path last tick, we came in from the side.
        const wasAlongside = overlaps(
          prevS - PLAYER_HALF_DEPTH,
          prevS + PLAYER_HALF_DEPTH,
          o.s0,
          o.s1,
        );
        handler.onObstacleHit(o, wasAlongside ? 'sideHit' : 'fatal');
      }
    }
  }
}
