import { describe, expect, it } from 'vitest';
import { SEGMENT_POOL_SIZE } from '../src/config';
import { runBot } from './helpers';

const SEEDS = 1000;

describe('perfect-play bot', () => {
  it(`survives ${SEEDS} seeds from the start (40 s each)`, () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = runBot(seed, 40);
      if (!r.alive) failures.push(`seed ${seed}: ${r.sim.deathCause} at s=${r.sim.s.toFixed(1)}`);
    }
    expect(failures).toEqual([]);
  });

  it(`survives ${SEEDS} seeds at top speed (25 s each, starting at t=175 s)`, () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = runBot(seed * 7919, 25, 175);
      if (!r.alive)
        failures.push(`seed ${seed * 7919}: ${r.sim.deathCause} at s=${r.sim.s.toFixed(1)}`);
    }
    expect(failures).toEqual([]);
  });

  it('never exceeds the segment pool', () => {
    const r = runBot(123, 120);
    expect(r.alive).toBe(true);
    expect(r.maxPoolCount).toBeLessThanOrEqual(SEGMENT_POOL_SIZE);
  });
});
