import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/Rng';

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    let same = 0;
    for (let i = 0; i < 100; i++) if (a.next() === b.next()) same++;
    expect(same).toBeLessThan(3);
  });

  it('reset restarts the sequence', () => {
    const rng = new Rng(99);
    const first = [rng.next(), rng.next(), rng.next()];
    rng.reset();
    expect([rng.next(), rng.next(), rng.next()]).toEqual(first);
  });

  it('stays within bounds and is roughly uniform', () => {
    const rng = new Rng(7);
    const buckets = [0, 0, 0, 0, 0];
    for (let i = 0; i < 50_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      buckets[Math.floor(v * 5)]!++;
    }
    for (const b of buckets) expect(Math.abs(b - 10_000)).toBeLessThan(600);
  });

  it('int is inclusive on both ends', () => {
    const rng = new Rng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(rng.int(0, 2));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it('weightedIndex never picks zero-weight entries', () => {
    const rng = new Rng(5);
    for (let i = 0; i < 1000; i++) expect(rng.weightedIndex([0, 1, 0, 3])).not.toBe(0);
  });
});
