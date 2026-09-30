import { describe, expect, it } from 'vitest';
import { SPEED_MAX, SPEED_MIN, SURGE_SPEED_MULT } from '../src/config';
import { turnWindowStart } from '../src/systems/Turns';
import type { Pattern } from '../src/world/ObstaclePatterns';
import { PATTERNS, SLOT_TIME } from '../src/world/ObstaclePatterns';
import { requiredGap, validatePattern } from '../src/world/PatternValidator';
import { SegmentPool } from '../src/world/SegmentPool';
import { TrackGenerator } from '../src/world/TrackGenerator';

function pattern(rows: [number, string][]): Pattern {
  const map: Record<string, 'free' | 'low' | 'beam' | 'pillar' | 'gap'> = {
    '.': 'free',
    L: 'low',
    B: 'beam',
    P: 'pillar',
    G: 'gap',
  };
  return {
    name: 'test',
    tier: 0,
    weight: 1,
    rows: rows.map(([at, c]) => ({
      at,
      cells: [map[c[0]!]!, map[c[1]!]!, map[c[2]!]!] as const,
    })),
  };
}

describe('pattern library', () => {
  it('has unique names and all four tiers', () => {
    const names = new Set(PATTERNS.map((p) => p.name));
    expect(names.size).toBe(PATTERNS.length);
    for (const tier of [0, 1, 2, 3]) expect(PATTERNS.some((p) => p.tier === tier)).toBe(true);
  });

  it.each(PATTERNS.map((p) => [p.name, p] as const))('%s is beatable at every speed', (_n, p) => {
    for (const v of [SPEED_MIN, 12, 16, SPEED_MAX, SPEED_MAX * SURGE_SPEED_MULT]) {
      const r = validatePattern(p, v);
      expect(r.ok, r.reason).toBe(true);
    }
  });

  it('covers every obstacle type', () => {
    const cells = new Set(PATTERNS.flatMap((p) => p.rows.flatMap((r) => r.cells)));
    for (const c of ['low', 'beam', 'pillar', 'gap', 'free']) expect(cells).toContain(c);
  });
});

describe('PatternValidator', () => {
  it('rejects a fully blocked row', () => {
    expect(validatePattern(pattern([[0, 'PPP']])).ok).toBe(false);
  });

  it('rejects partial gaps', () => {
    expect(validatePattern(pattern([[0, 'GG.']])).ok).toBe(false);
  });

  it('rejects rows too close for the required lane change', () => {
    // Lane 2 then lane 0 needs two lane changes: impossible in 0.2 slot.
    expect(
      validatePattern(
        pattern([
          [0, 'PP.'],
          [0.2, '.PP'],
        ]),
      ).ok,
    ).toBe(false);
    expect(
      validatePattern(
        pattern([
          [0, 'PP.'],
          [1, '.PP'],
        ]),
      ).ok,
    ).toBe(true);
  });

  it('rejects back-to-back jumps closer than one jump duration', () => {
    expect(
      validatePattern(
        pattern([
          [0, 'LLL'],
          [0.4, 'LLL'],
        ]),
      ).ok,
    ).toBe(false);
  });

  it('one slot always covers the worst single transition', () => {
    const worst = requiredGap('jump', 'jump', 2, 0.3, 0.3);
    expect(worst).toBeLessThan(SLOT_TIME);
  });
});

describe('generated obstacles', () => {
  it('keep turn windows and segment boundaries clear', () => {
    for (const seed of [1, 2, 3, 99, 1234]) {
      const gen = new TrackGenerator(seed);
      gen.reset(seed);
      const pool = new SegmentPool(64);
      gen.fill(pool, 6000);
      for (let i = 0; i < pool.count; i++) {
        const seg = pool.at(i);
        for (let k = 0; k < seg.obstacleCount; k++) {
          const o = seg.obstacles[k]!;
          expect(o.s0).toBeGreaterThanOrEqual(seg.startS);
          expect(o.s1).toBeLessThanOrEqual(seg.endS);
        }
        const next = i + 1 < pool.count ? pool.at(i + 1) : null;
        if (next?.isCorner && seg.obstacleCount > 0) {
          const last = seg.obstacles[seg.obstacleCount - 1]!;
          expect(last.s1).toBeLessThan(turnWindowStart(next, SPEED_MAX * 1.05));
        }
        if (seg.isCorner) expect(seg.obstacleCount).toBe(0);
        if (seg.kind === 'bridge') {
          expect(seg.obstacleCount).toBe(1);
          expect(seg.obstacles[0]!.kind).toBe('gap');
        }
      }
    }
  });
});
