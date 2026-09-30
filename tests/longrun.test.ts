import { describe, expect, it } from 'vitest';
import { DT, SEGMENT_POOL_SIZE } from '../src/config';
import { Bot } from '../src/sim/Bot';
import { Simulation } from '../src/sim/Simulation';
import { distanceAtTime } from '../src/systems/Difficulty';

declare const process: { memoryUsage(): { heapUsed: number } };
const gc = (globalThis as { gc?: () => void }).gc;

function heapAfterGc(): number {
  gc?.();
  gc?.();
  return process.memoryUsage().heapUsed;
}

describe('10-minute headless run', () => {
  it('survives, keeps the pool bounded and does not grow the heap', () => {
    const sim = new Simulation(20260930);
    const bot = new Bot(sim);
    const minute = Math.round(60 / DT);
    const samples: number[] = [];
    for (let m = 0; m < 10; m++) {
      for (let i = 0; i < minute; i++) {
        bot.update();
        sim.step(DT);
        sim.events.clear();
        expect(sim.pool.count).toBeLessThanOrEqual(SEGMENT_POOL_SIZE);
      }
      expect(sim.alive, `died: ${sim.deathCause} at ${sim.s.toFixed(0)} m`).toBe(true);
      samples.push(heapAfterGc());
    }
    expect(sim.elapsed).toBeCloseTo(600, 3);
    // Base-speed distance for 10 minutes (no surge in this run yet).
    expect(sim.s).toBeGreaterThan(distanceAtTime(600) * 0.95);
    if (gc) {
      // Compare the settled heap after minute 2 to the end: allow < 1 MB of noise.
      const growth = samples[9]! - samples[1]!;
      expect(growth).toBeLessThan(1024 * 1024);
    }
  });
});
