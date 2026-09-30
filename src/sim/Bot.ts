import { DT } from '../config';
import { turnWindowStart } from '../systems/Turns';
import type { Simulation } from './Simulation';

/** Metres past the window opening at which the bot commits its turn swipe. */
const TURN_COMMIT_OFFSET = 0.75;

/**
 * A perfect player driven purely by simulation state. Used by headless tests to prove
 * every generated track is beatable, and by the menu as an attract-mode demo.
 * Call `update()` before each `sim.step()`.
 */
export class Bot {
  private turnedFor = -1;

  constructor(private readonly sim: Simulation) {}

  reset(): void {
    this.turnedFor = -1;
  }

  update(): void {
    const sim = this.sim;
    if (!sim.alive) return;
    this.handleTurn();
  }

  private handleTurn(): void {
    const sim = this.sim;
    const corner = sim.upcomingCorner();
    if (!corner || corner.id === this.turnedFor) return;
    if (sim.s + sim.speed * DT >= turnWindowStart(corner, sim.speed) + TURN_COMMIT_OFFSET) {
      sim.pushInput(corner.turnDir < 0 ? 'LEFT' : 'RIGHT');
      this.turnedFor = corner.id;
    }
  }
}
