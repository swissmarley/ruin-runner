import {
  COIN_RADIUS,
  MAGNET_RANGE_AHEAD,
  MAGNET_RANGE_BEHIND,
  PLAYER_HALF_DEPTH,
  PLAYER_HALF_WIDTH,
} from '../config';
import { POWERUP_KINDS } from '../entities/PowerUp';
import type { Simulation } from './Simulation';

const PICKUP_RADIUS = 0.9;
/** Vertical reach beyond the runner's collider (tighter than the horizontal coin radius). */
const COIN_VERTICAL_REACH = 0.25;
/** Magnetised coins close this fraction of the remaining distance per second (exponential). */
const MAGNET_PULL = 14;
const MAGNET_COLLECT_DISTANCE = 0.7;
/** Height of the runner's chest, where attracted coins fly to. */
const CHEST = 0.9;

/**
 * Coin and power-up collection, including the magnet's pull. Runs every tick;
 * touches only segments near the runner and never allocates.
 */
export function updatePickups(sim: Simulation, dt: number): void {
  const p = sim.player;
  const s = sim.s;
  const magnet = sim.powerUps.magnet > 0;
  const reachAhead = magnet ? MAGNET_RANGE_AHEAD : COIN_RADIUS + PLAYER_HALF_DEPTH;
  const top = p.y + p.colliderHeight + COIN_VERTICAL_REACH;
  const bottom = p.y - COIN_VERTICAL_REACH;
  const pull = 1 - Math.exp(-MAGNET_PULL * dt);

  for (let i = 0; i < sim.pool.count; i++) {
    const seg = sim.pool.at(i);
    if (seg.endS < s - 3 || seg.startS > s + reachAhead + 3) continue;

    for (let k = 0; k < seg.coinCount; k++) {
      const c = seg.coins[k]!;
      if (c.collected) continue;
      if (magnet && !c.attracted && c.s < s + MAGNET_RANGE_AHEAD && c.s > s - MAGNET_RANGE_BEHIND) {
        c.attracted = true;
      }
      if (c.attracted) {
        c.s += (s - c.s) * pull;
        c.x += (p.x - c.x) * pull;
        c.y += (p.y + CHEST - c.y) * pull;
        if (
          Math.abs(c.s - s) < MAGNET_COLLECT_DISTANCE &&
          Math.abs(c.x - p.x) < MAGNET_COLLECT_DISTANCE
        ) {
          collectCoin(sim, c);
        }
        continue;
      }
      if (Math.abs(c.s - s) > COIN_RADIUS + PLAYER_HALF_DEPTH) continue;
      if (Math.abs(c.x - p.x) > COIN_RADIUS + PLAYER_HALF_WIDTH) continue;
      if (c.y < bottom || c.y > top) continue;
      collectCoin(sim, c);
    }

    for (let k = 0; k < seg.pickupCount; k++) {
      const u = seg.pickups[k]!;
      if (u.collected) continue;
      if (Math.abs(u.s - s) > PICKUP_RADIUS + PLAYER_HALF_DEPTH) continue;
      if (Math.abs(u.x - p.x) > PICKUP_RADIUS + PLAYER_HALF_WIDTH) continue;
      if (u.y < bottom - 0.3 || u.y > top + 0.3) continue;
      u.collected = true;
      sim.powerUps.activate(u.kind);
      sim.events.push('powerup', POWERUP_KINDS.indexOf(u.kind));
    }
  }
}

function collectCoin(sim: Simulation, c: { collected: boolean }): void {
  c.collected = true;
  sim.scoring.addCoin();
  sim.events.push('coin', sim.scoring.coins);
}
