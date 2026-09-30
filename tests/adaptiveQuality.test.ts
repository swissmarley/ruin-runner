import { describe, expect, it } from 'vitest';
import { AdaptiveQuality, LOW_PIXEL_SCALES } from '../src/render/AdaptiveQuality';

function feed(q: AdaptiveQuality, dt: number, seconds: number): number {
  let changes = 0;
  for (let t = 0; t < seconds; t += dt) if (q.sample(dt)) changes++;
  return changes;
}

describe('AdaptiveQuality', () => {
  it('holds steady at a solid 60 FPS', () => {
    const q = new AdaptiveQuality('high');
    expect(feed(q, 1 / 60, 30)).toBe(0);
    expect(q.state).toEqual({ level: 'high', pixelScale: 1 });
  });

  it('steps down when frames stay over budget', () => {
    const q = new AdaptiveQuality('high');
    feed(q, 1 / 40, 4);
    expect(q.state.level).toBe('medium');
    feed(q, 1 / 40, 4);
    expect(q.state.level).toBe('low');
  });

  it('keeps lowering resolution below "low", then stops', () => {
    const q = new AdaptiveQuality('low');
    feed(q, 1 / 30, 40);
    expect(q.state.level).toBe('low');
    expect(q.state.pixelScale).toBe(LOW_PIXEL_SCALES[LOW_PIXEL_SCALES.length - 1]);
  });

  it('ignores one-off hitches (GC, tab switches)', () => {
    const q = new AdaptiveQuality('high');
    for (let i = 0; i < 600; i++) q.sample(i % 120 === 0 ? 0.5 : 1 / 60);
    expect(q.state.level).toBe('high');
  });

  it('recovers when there is headroom again, but never above its ceiling', () => {
    const q = new AdaptiveQuality('medium');
    feed(q, 1 / 35, 4);
    expect(q.state.level).toBe('low');
    feed(q, 1 / 120, 30);
    expect(q.state.level).toBe('medium');
    feed(q, 1 / 120, 30);
    expect(q.state.level).toBe('medium');
  });

  it('recovers on a vsync-capped 60 Hz screen after a sustained full frame rate', () => {
    const q = new AdaptiveQuality('high');
    feed(q, 1 / 40, 4);
    expect(q.state.level).toBe('medium');
    feed(q, 1 / 60, 20);
    expect(q.state.level).toBe('high');
  });

  it('does not oscillate on a borderline device', () => {
    const q = new AdaptiveQuality('high');
    expect(feed(q, 1 / 58, 60)).toBeLessThanOrEqual(1);
  });

  it('backs off when a step up immediately proves too much', () => {
    const q = new AdaptiveQuality('high');
    let changes = 0;
    // Device manages 60 FPS at medium but only 40 FPS at high, for 5 minutes.
    for (let t = 0; t < 300; t += 1 / 60) {
      const dt = q.state.level === 'high' ? 1 / 40 : 1 / 60;
      if (q.sample(dt)) changes++;
    }
    // Without backoff this would flip ~every 13 s (~45 changes).
    expect(changes).toBeLessThan(12);
    expect(q.state.level).toBe('medium');
  });
});
