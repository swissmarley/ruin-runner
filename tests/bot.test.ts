import { describe, expect, it } from 'vitest';
import { SEGMENT_POOL_SIZE } from '../src/config';
import type { BotRunResult } from './helpers';
import { runBot } from './helpers';

const SEEDS = 1000;

function describeFailure(seed: number, r: BotRunResult): string {
  return `seed ${seed}: ${r.sim.deathCause} (stumbles ${r.sim.stumbles}) at s=${r.sim.s.toFixed(1)}`;
}

function sweep(seedOf: (i: number) => number, seconds: number, startTime: number) {
  const failures: string[] = [];
  const totals = { jumps: 0, slides: 0, lanes: 0, turns: 0 };
  for (let i = 1; i <= SEEDS; i++) {
    const seed = seedOf(i);
    const r = runBot(seed, seconds, startTime);
    if (!r.alive || r.sim.stumbles > 0) failures.push(describeFailure(seed, r));
    totals.jumps += r.jumps;
    totals.slides += r.slides;
    totals.lanes += r.lanes;
    totals.turns += r.turns;
  }
  return { failures, totals };
}

describe('perfect-play bot', () => {
  it(`beats ${SEEDS} seeds from the start without a single stumble (40 s each)`, () => {
    const { failures, totals } = sweep((i) => i, 40, 0);
    expect(failures).toEqual([]);
    // Proves the runs were actually challenging, not empty tracks.
    expect(totals.jumps).toBeGreaterThan(SEEDS * 2);
    expect(totals.slides).toBeGreaterThan(SEEDS);
    expect(totals.lanes).toBeGreaterThan(SEEDS * 2);
    expect(totals.turns).toBeGreaterThan(SEEDS);
  });

  it(`beats ${SEEDS} seeds at top speed without a stumble (25 s each from t=175 s)`, () => {
    const { failures, totals } = sweep((i) => i * 7919, 25, 175);
    expect(failures).toEqual([]);
    expect(totals.jumps + totals.slides + totals.lanes).toBeGreaterThan(SEEDS * 5);
  });

  it('never exceeds the segment pool', () => {
    const r = runBot(123, 120);
    expect(r.alive).toBe(true);
    expect(r.maxPoolCount).toBeLessThanOrEqual(SEGMENT_POOL_SIZE);
  });
});
