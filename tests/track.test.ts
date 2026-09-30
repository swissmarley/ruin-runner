import { describe, expect, it } from 'vitest';
import { CORNER_SIZE, TRACK_HALF_WIDTH } from '../src/config';
import { difficultyAt, distanceAtTime, speedAt, timeAtDistance } from '../src/systems/Difficulty';
import type { Segment } from '../src/world/Segment';
import { SegmentPool } from '../src/world/SegmentPool';
import { TrackGenerator } from '../src/world/TrackGenerator';

interface SegInfo {
  kind: string;
  startS: number;
  length: number;
  x: number;
  z: number;
  heading: number;
  exitX: number;
  exitZ: number;
}

/** Generates `count` segments, recycling the pool as a real run would. */
function generate(seed: number, count: number): SegInfo[] {
  const gen = new TrackGenerator(seed);
  gen.reset(seed);
  const pool = new SegmentPool(8);
  const out: SegInfo[] = [];
  while (out.length < count) {
    gen.fill(pool, Number.POSITIVE_INFINITY);
    while (pool.count > 0) {
      const s: Segment = pool.at(0);
      out.push({
        kind: s.kind,
        startS: s.startS,
        length: s.length,
        x: s.originX,
        z: s.originZ,
        heading: s.heading,
        exitX: s.exitX(),
        exitZ: s.exitZ(),
      });
      pool.releaseOldest();
    }
  }
  return out.slice(0, count);
}

describe('TrackGenerator', () => {
  it('is deterministic for a seed', () => {
    expect(generate(42, 300)).toEqual(generate(42, 300));
  });

  it('differs between seeds', () => {
    expect(generate(1, 50)).not.toEqual(generate(2, 50));
  });

  it('produces contiguous segments in both path distance and world space', () => {
    const segs = generate(7, 500);
    for (let i = 1; i < segs.length; i++) {
      const a = segs[i - 1]!;
      const b = segs[i]!;
      expect(b.startS).toBeCloseTo(a.startS + a.length, 6);
      expect(b.x).toBeCloseTo(a.exitX, 6);
      expect(b.z).toBeCloseTo(a.exitZ, 6);
    }
  });

  it('keeps headings forward-facing so the path never loops back', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const s of generate(seed, 400)) expect([0, 1, 3]).toContain(s.heading);
    }
  });

  it('never places a corner directly after a corner or next to a bridge', () => {
    const segs = generate(11, 2000);
    for (let i = 1; i < segs.length; i++) {
      const prev = segs[i - 1]!.kind;
      const cur = segs[i]!.kind;
      if (cur.startsWith('corner')) {
        expect(prev).toBe('straight');
      }
      if (cur === 'bridge') expect(prev.startsWith('corner')).toBe(false);
    }
  });

  it('contains corners of both directions and occasional bridges', () => {
    const kinds = new Set(generate(3, 600).map((s) => s.kind));
    expect(kinds).toContain('cornerLeft');
    expect(kinds).toContain('cornerRight');
    expect(kinds).toContain('bridge');
    expect(kinds).toContain('straight');
  });

  it('never overlaps itself in world space (non-neighbouring segments)', () => {
    const segs = generate(19, 400);
    const half = TRACK_HALF_WIDTH;
    const boxes = segs.map((s) => {
      const len = s.kind.startsWith('corner') ? CORNER_SIZE / 2 : s.length;
      const minX = Math.min(s.x, s.exitX) - half;
      const maxX = Math.max(s.x, s.exitX) + half;
      const minZ = Math.min(s.z, s.exitZ) - half;
      const maxZ = Math.max(s.z, s.exitZ) + half;
      return { minX, maxX, minZ, maxZ, len };
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 3; j < Math.min(boxes.length, i + 60); j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlap =
          a.minX < b.maxX - 0.01 &&
          b.minX < a.maxX - 0.01 &&
          a.minZ < b.maxZ - 0.01 &&
          b.minZ < a.maxZ - 0.01;
        expect(overlap).toBe(false);
      }
    }
  });
});

describe('Difficulty curve', () => {
  it('starts at ~8 m/s and caps at ~22 m/s after ~3 minutes', () => {
    expect(speedAt(0)).toBeCloseTo(8);
    expect(speedAt(180)).toBeCloseTo(22);
    expect(speedAt(600)).toBeCloseTo(22);
  });

  it('ramps monotonically and smoothly', () => {
    let prev = speedAt(0);
    for (let t = 0.5; t <= 200; t += 0.5) {
      const v = speedAt(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v - prev).toBeLessThan(0.1);
      prev = v;
    }
  });

  it('distance/time conversions are inverse of each other and match integration', () => {
    let integrated = 0;
    const dt = 1 / 600;
    for (let t = 0; t < 240; t += dt) integrated += speedAt(t + dt / 2) * dt;
    expect(distanceAtTime(240)).toBeCloseTo(integrated, 0);
    for (const t of [0, 5, 60, 179, 181, 400])
      expect(timeAtDistance(distanceAtTime(t))).toBeCloseTo(t, 3);
  });

  it('difficulty rises from 0 to 1', () => {
    expect(difficultyAt(0)).toBe(0);
    expect(difficultyAt(90)).toBeCloseTo(0.5);
    expect(difficultyAt(999)).toBe(1);
  });
});
