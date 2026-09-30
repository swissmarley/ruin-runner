import { DT } from '../src/config';
import { Bot } from '../src/sim/Bot';
import { Simulation } from '../src/sim/Simulation';
import type { Segment } from '../src/world/Segment';

export interface BotRunResult {
  sim: Simulation;
  alive: boolean;
  seconds: number;
  maxPoolCount: number;
  jumps: number;
  slides: number;
  lanes: number;
  turns: number;
}

/** Runs the perfect-play bot headlessly for `seconds` of game time. */
export function runBot(seed: number, seconds: number, startTime = 0): BotRunResult {
  const sim = new Simulation(seed);
  sim.reset(seed, startTime);
  const bot = new Bot(sim);
  const ticks = Math.round(seconds / DT);
  let maxPoolCount = 0;
  const counts = { jump: 0, slide: 0, lane: 0, turn: 0 };
  for (let i = 0; i < ticks && sim.alive; i++) {
    bot.update();
    sim.step(DT);
    for (let k = 0; k < sim.events.count; k++) {
      const t = sim.events.types[k]!;
      if (t === 'jump' || t === 'slide' || t === 'lane' || t === 'turn') counts[t]++;
    }
    sim.events.clear();
    if (sim.pool.count > maxPoolCount) maxPoolCount = sim.pool.count;
  }
  return {
    sim,
    alive: sim.alive,
    seconds: sim.elapsed - startTime,
    maxPoolCount,
    jumps: counts.jump,
    slides: counts.slide,
    lanes: counts.lane,
    turns: counts.turn,
  };
}

/** Steps a simulation without input for `seconds`. */
export function advance(sim: Simulation, seconds: number): void {
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i < ticks && sim.alive; i++) sim.step(DT);
}

/** Steps until `predicate` holds (or a safety limit), returning whether it held. */
export function advanceUntil(sim: Simulation, predicate: () => boolean, maxSeconds = 120): boolean {
  const ticks = Math.round(maxSeconds / DT);
  for (let i = 0; i < ticks; i++) {
    if (predicate()) return true;
    if (!sim.alive) return false;
    sim.step(DT);
  }
  return predicate();
}

/** Clears generated content from the first segments and returns the one under the runner. */
export function emptyTrack(sim: Simulation): Segment {
  for (let i = 0; i < sim.pool.count; i++) {
    const seg = sim.pool.at(i);
    seg.obstacleCount = 0;
    seg.coinCount = 0;
    seg.pickupCount = 0;
  }
  return sim.pool.at(0);
}
