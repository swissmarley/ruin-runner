import { DT } from '../src/config';
import { Bot } from '../src/sim/Bot';
import { Simulation } from '../src/sim/Simulation';

export interface BotRunResult {
  sim: Simulation;
  alive: boolean;
  seconds: number;
  maxPoolCount: number;
}

/** Runs the perfect-play bot headlessly for `seconds` of game time. */
export function runBot(seed: number, seconds: number, startTime = 0): BotRunResult {
  const sim = new Simulation(seed);
  sim.reset(seed, startTime);
  const bot = new Bot(sim);
  const ticks = Math.round(seconds / DT);
  let maxPoolCount = 0;
  for (let i = 0; i < ticks && sim.alive; i++) {
    bot.update();
    sim.step(DT);
    sim.events.clear();
    if (sim.pool.count > maxPoolCount) maxPoolCount = sim.pool.count;
  }
  return { sim, alive: sim.alive, seconds: sim.elapsed - startTime, maxPoolCount };
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
