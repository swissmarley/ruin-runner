import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { Bot } from '../src/sim/Bot';
import { Simulation } from '../src/sim/Simulation';
import { SegmentPool } from '../src/world/SegmentPool';
import { TrackGenerator } from '../src/world/TrackGenerator';
import { TUTORIAL_STEPS } from '../src/world/Tutorial';

describe('first-run tutorial', () => {
  it('opens the track with the lessons in order, then a corner', () => {
    const gen = new TrackGenerator(9);
    gen.reset(9, 0, true);
    const pool = new SegmentPool(40);
    gen.fill(pool, 800);
    const hints: string[] = [];
    let cornerAfterTurnHint = false;
    for (let i = 0; i < pool.count; i++) {
      const seg = pool.at(i);
      for (let k = 0; k < seg.hintCount; k++) {
        const h = seg.hints[k]!;
        hints.push(h.text);
        expect(h.s).toBeGreaterThanOrEqual(seg.startS);
        expect(h.s).toBeLessThanOrEqual(seg.endS);
        if (h.text === 'turn') cornerAfterTurnHint = pool.at(i + 1).isCorner;
      }
    }
    expect(hints).toEqual(TUTORIAL_STEPS.map((s) => s.hint));
    expect(cornerAfterTurnHint).toBe(true);
    expect(Number.isFinite(gen.tutorialEndS)).toBe(true);
    expect(gen.tutorialEndS).toBeLessThan(600);
  });

  it('is off by default', () => {
    const gen = new TrackGenerator(9);
    gen.reset(9);
    const pool = new SegmentPool(40);
    gen.fill(pool, 800);
    for (let i = 0; i < pool.count; i++) expect(pool.at(i).hintCount).toBe(0);
  });

  it('is beatable by the bot', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const sim = new Simulation(seed);
      sim.reset(seed, 0, true);
      const bot = new Bot(sim);
      for (let i = 0; i < 60 / DT && sim.alive; i++) {
        bot.update();
        sim.step(DT);
        sim.events.clear();
      }
      expect(sim.alive).toBe(true);
      expect(sim.s).toBeGreaterThan(sim.generator.tutorialEndS);
    }
  });
});
