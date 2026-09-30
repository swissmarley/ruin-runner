import { describe, expect, it } from 'vitest';
import {
  BEAM_BOTTOM,
  DT,
  LOW_BARRIER_HEIGHT,
  POWERUP_DURATION,
  SPEED_MIN,
  SURGE_SPEED_MULT,
} from '../src/config';
import { laneToX } from '../src/entities/Player';
import { Simulation } from '../src/sim/Simulation';
import { SegmentPool } from '../src/world/SegmentPool';
import { TrackGenerator } from '../src/world/TrackGenerator';
import { advance, emptyTrack, runBot } from './helpers';

describe('coins', () => {
  it('are collected when the runner passes through them', () => {
    const sim = new Simulation(1);
    const seg = emptyTrack(sim);
    seg.addCoin(sim.s + 5, 0, 0.9);
    seg.addCoin(sim.s + 6, laneToX(2), 0.9);
    advance(sim, 1.2);
    expect(sim.scoring.coins).toBe(1);
    expect(seg.coins[0]!.collected).toBe(true);
    expect(seg.coins[1]!.collected).toBe(false);
  });

  it('need a jump when they float high', () => {
    const sim = new Simulation(1);
    const seg = emptyTrack(sim);
    seg.addCoin(sim.s + 4 + SPEED_MIN * 0.35, 0, 2.1);
    advance(sim, 1.5);
    expect(sim.scoring.coins).toBe(0);

    const sim2 = new Simulation(1);
    const seg2 = emptyTrack(sim2);
    seg2.addCoin(sim2.s + 4 + SPEED_MIN * 0.35, 0, 2.1);
    advance(sim2, 4 / SPEED_MIN);
    sim2.pushInput('UP');
    advance(sim2, 1.5);
    expect(sim2.scoring.coins).toBe(1);
  });

  it('are pulled in from other lanes by the magnet', () => {
    const sim = new Simulation(1);
    const seg = emptyTrack(sim);
    for (let i = 0; i < 5; i++) seg.addCoin(sim.s + 6 + i * 2, laneToX(i % 2 === 0 ? 0 : 2), 0.9);
    sim.powerUps.activate('magnet');
    advance(sim, 2.5);
    expect(sim.scoring.coins).toBe(5);
  });
});

describe('power-ups', () => {
  it('activate on pickup and last ~8 s', () => {
    const sim = new Simulation(1);
    const seg = emptyTrack(sim);
    seg.addPickup('shield', sim.s + 4, 0, 1);
    advance(sim, 1);
    expect(sim.powerUps.shield).toBeGreaterThan(POWERUP_DURATION - 1);
    advance(sim, POWERUP_DURATION);
    expect(sim.powerUps.shield).toBe(0);
  });

  it('surge boosts speed and leaves a short grace period', () => {
    const sim = new Simulation(1);
    emptyTrack(sim);
    sim.powerUps.activate('surge');
    sim.step(DT);
    expect(sim.speed).toBeCloseTo(SPEED_MIN * SURGE_SPEED_MULT, 0);
    expect(sim.invulnerable).toBe(true);
    for (let i = 0; i < Math.round(POWERUP_DURATION / DT); i++) {
      sim.powerUps.surge = Math.max(sim.powerUps.surge, 0);
      sim.step(DT);
      if (!sim.alive) break;
      sim.controls.queuedTurnId = sim.upcomingCorner()?.id ?? -1;
    }
    expect(sim.powerUps.surge).toBe(0);
    expect(sim.invulnerable).toBe(true);
    advance(sim, 1.1);
    expect(sim.invulnerable).toBe(false);
  });
});

describe('generated collectibles', () => {
  it('never place coins inside obstacles or over pits', () => {
    for (const seed of [3, 17, 256, 4096]) {
      const gen = new TrackGenerator(seed);
      gen.reset(seed);
      const pool = new SegmentPool(96);
      gen.fill(pool, 9000);
      let coins = 0;
      let pickups = 0;
      for (let i = 0; i < pool.count; i++) {
        const seg = pool.at(i);
        coins += seg.coinCount;
        pickups += seg.pickupCount;
        for (let c = 0; c < seg.coinCount; c++) {
          const coin = seg.coins[c]!;
          for (let k = 0; k < seg.obstacleCount; k++) {
            const o = seg.obstacles[k]!;
            if (coin.s < o.s0 || coin.s > o.s1) continue;
            const lane = Math.round(coin.x / 2.2) + 1;
            if (o.kind === 'gap') expect(coin.y).toBeGreaterThan(1.2);
            else if (!o.blocksLane(lane)) continue;
            else if (o.kind === 'pillar') throw new Error('coin inside pillar');
            else if (o.kind === 'low') expect(coin.y).toBeGreaterThan(LOW_BARRIER_HEIGHT);
            else if (o.kind === 'beam') expect(coin.y).toBeLessThan(BEAM_BOTTOM);
          }
        }
      }
      expect(coins).toBeGreaterThan(300);
      expect(pickups).toBeGreaterThan(3);
    }
  });

  it('the bot collects plenty of coins while running flawlessly', () => {
    const r = runBot(77, 90);
    expect(r.alive).toBe(true);
    expect(r.sim.scoring.coins).toBeGreaterThan(20);
    expect(r.sim.scoring.total).toBeGreaterThan(r.sim.distance);
  });
});
