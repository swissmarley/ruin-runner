import { describe, expect, it } from 'vitest';
import { DT, JUMP_DURATION, LANE_CHANGE_TIME, STUMBLE_WINDOW } from '../src/config';
import { Player } from '../src/entities/Player';
import { Simulation } from '../src/sim/Simulation';
import type { HitKind } from '../src/systems/Collision';
import { checkCollisions } from '../src/systems/Collision';
import type { ObstacleKind } from '../src/world/Segment';
import { Obstacle } from '../src/world/Segment';
import { SegmentPool } from '../src/world/SegmentPool';

function world(kind: ObstacleKind, s0: number, s1: number, mask = 0b111) {
  const pool = new SegmentPool(2);
  const seg = pool.acquire();
  seg.init(0, 'straight', 0, 100, 0, 0, 0);
  seg.addObstacle(kind, s0, s1, mask);
  const hits: HitKind[] = [];
  const handler = { onObstacleHit: (_o: Obstacle, k: HitKind) => hits.push(k) };
  return { pool, hits, handler };
}

describe('obstacle collisions', () => {
  it('a low barrier trips a grounded runner but not a jumping one', () => {
    const w = world('low', 10, 10.5);
    const p = new Player();
    checkCollisions(w.pool, p, 10.2, 10.0, w.handler);
    expect(w.hits).toEqual(['stumble']);

    const w2 = world('low', 10, 10.5);
    p.jump();
    for (let i = 0; i < Math.round(JUMP_DURATION / 2 / DT); i++) p.update(DT);
    checkCollisions(w2.pool, p, 10.2, 10.0, w2.handler);
    expect(w2.hits).toEqual([]);
  });

  it('an overhead beam is fatal unless sliding', () => {
    const w = world('beam', 10, 10.5);
    const p = new Player();
    checkCollisions(w.pool, p, 10.2, 10.0, w.handler);
    expect(w.hits).toEqual(['fatal']);

    const w2 = world('beam', 10, 10.5);
    p.slide();
    p.update(DT);
    checkCollisions(w2.pool, p, 10.2, 10.0, w2.handler);
    expect(w2.hits).toEqual([]);
  });

  it('jumping into a beam is still fatal', () => {
    const w = world('beam', 10, 10.5);
    const p = new Player();
    p.jump();
    for (let i = 0; i < 10; i++) p.update(DT);
    checkCollisions(w.pool, p, 10.2, 10.0, w.handler);
    expect(w.hits).toEqual(['fatal']);
  });

  it('even the apex of a jump cannot clear a beam', () => {
    const w = world('beam', 10, 10.5);
    const p = new Player();
    p.jump();
    for (let i = 0; i < Math.round(JUMP_DURATION / 2 / DT); i++) p.update(DT);
    checkCollisions(w.pool, p, 10.2, 10.0, w.handler);
    expect(w.hits).toEqual(['fatal']);
  });

  it('a pillar is fatal head-on and cannot be jumped', () => {
    const w = world('pillar', 10, 11.2, 0b010);
    const p = new Player();
    p.jump();
    for (let i = 0; i < Math.round(JUMP_DURATION / 2 / DT); i++) p.update(DT);
    checkCollisions(w.pool, p, 9.8, 9.6, w.handler);
    expect(w.hits).toEqual(['fatal']);
  });

  it('only blocks the lanes in its mask', () => {
    const w = world('pillar', 10, 11.2, 0b100);
    const p = new Player();
    checkCollisions(w.pool, p, 10.5, 10.3, w.handler);
    expect(w.hits).toEqual([]);
  });

  it('steering into the side of a pillar is a side hit (stumble), not a crash', () => {
    const w = world('pillar', 10, 11.2, 0b100);
    const p = new Player();
    p.changeLane(1);
    for (let i = 0; i < Math.round(LANE_CHANGE_TIME / DT); i++) p.update(DT);
    // Already alongside the pillar on the previous tick.
    checkCollisions(w.pool, p, 10.8, 10.6, w.handler);
    expect(w.hits).toEqual(['sideHit']);
  });

  it('a gap swallows a grounded runner but not an airborne one', () => {
    const w = world('gap', 10, 12.6);
    const p = new Player();
    checkCollisions(w.pool, p, 11.3, 11.1, w.handler);
    expect(w.hits).toEqual(['pit']);
    const w2 = world('gap', 10, 12.6);
    p.jump();
    p.update(DT);
    checkCollisions(w2.pool, p, 11.3, 11.1, w2.handler);
    expect(w2.hits).toEqual([]);
  });

  it('forgives hanging slightly over a gap edge', () => {
    const w = world('gap', 10, 12.6);
    checkCollisions(w.pool, new Player(), 10.1, 10.0, w.handler);
    expect(w.hits).toEqual([]);
  });
});

describe('stumble and death rules', () => {
  const obstacle = () => {
    const o = new Obstacle();
    o.set('low', 0, 1, 0b111, 0);
    return o;
  };

  it('a second stumble within ~4 s lets the pursuer catch the runner', () => {
    const sim = new Simulation(1);
    sim.onObstacleHit(obstacle(), 'stumble');
    expect(sim.alive).toBe(true);
    expect(sim.recentlyStumbled).toBe(true);
    for (let i = 0; i < 120; i++) sim.step(DT);
    sim.onObstacleHit(obstacle(), 'stumble');
    expect(sim.alive).toBe(false);
    expect(sim.deathCause).toBe('caught');
  });

  it('stumbles further apart than the window are survivable', () => {
    const sim = new Simulation(1);
    sim.onObstacleHit(obstacle(), 'stumble');
    sim.elapsed += STUMBLE_WINDOW + 0.1;
    sim.onObstacleHit(obstacle(), 'stumble');
    expect(sim.alive).toBe(true);
    expect(sim.stumbles).toBe(2);
  });

  it('fatal hits end the run immediately', () => {
    const sim = new Simulation(1);
    sim.onObstacleHit(obstacle(), 'fatal');
    expect(sim.deathCause).toBe('obstacle');
    const sim2 = new Simulation(1);
    sim2.onObstacleHit(obstacle(), 'pit');
    expect(sim2.deathCause).toBe('pit');
  });

  it('a shield absorbs exactly one hit', () => {
    const sim = new Simulation(1);
    sim.powerUps.activate('shield');
    sim.onObstacleHit(obstacle(), 'fatal');
    expect(sim.alive).toBe(true);
    expect(sim.powerUps.shield).toBe(0);
    sim.onObstacleHit(obstacle(), 'fatal');
    expect(sim.alive).toBe(false);
  });

  it('surge makes the runner invulnerable, even over pits', () => {
    const sim = new Simulation(1);
    sim.powerUps.activate('surge');
    sim.onObstacleHit(obstacle(), 'fatal');
    sim.onObstacleHit(obstacle(), 'pit');
    sim.onObstacleHit(obstacle(), 'stumble');
    expect(sim.alive).toBe(true);
    expect(sim.stumbles).toBe(0);
  });

  it('a side hit bounces the runner back to the previous lane', () => {
    const sim = new Simulation(1);
    sim.pushInput('LEFT');
    sim.step(DT);
    expect(sim.player.lane).toBe(0);
    sim.onObstacleHit(obstacle(), 'sideHit');
    expect(sim.player.lane).toBe(1);
    expect(sim.stumbles).toBe(1);
  });
});
