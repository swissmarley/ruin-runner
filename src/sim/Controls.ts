import { CENTER_LANE, CORNER_SIZE } from '../config';
import { turnIntentStart, turnWindowEnd, turnWindowStart } from '../systems/Turns';
import { DIR_X, DIR_Z } from '../world/Heading';
import type { Segment } from '../world/Segment';
import type { Dir } from './InputBuffer';
import { InputBuffer } from './InputBuffer';
import type { Simulation } from './Simulation';

const PENDING_CAPACITY = 8;

/**
 * Turns queued directional inputs into player actions: lane changes, jumps, slides and
 * corner turns (including the turn window, buffered intents and wrong/missed turns).
 */
export class Controls {
  readonly buffer = new InputBuffer();
  /** Id of the last corner turned (corners are identified by monotonic segment id). */
  lastTurnedId = -1;
  queuedTurnId = -1;
  private readonly pending: Dir[] = new Array<Dir>(PENDING_CAPACITY).fill('UP');
  private pendingCount = 0;

  constructor(private readonly sim: Simulation) {}

  reset(): void {
    this.buffer.consume();
    this.pendingCount = 0;
    this.lastTurnedId = -1;
    this.queuedTurnId = -1;
  }

  push(dir: Dir): void {
    if (this.pendingCount < PENDING_CAPACITY) this.pending[this.pendingCount++] = dir;
  }

  /** Applies inputs queued since the last tick, then retries the buffered one. */
  process(dt: number): void {
    for (let i = 0; i < this.pendingCount; i++) {
      const dir = this.pending[i]!;
      if (!this.apply(dir)) this.buffer.push(dir);
    }
    this.pendingCount = 0;
    if (this.buffer.dir !== null) {
      if (this.apply(this.buffer.dir)) this.buffer.consume();
      else this.buffer.tick(dt);
    }
  }

  /** Tries to perform an input right now. Returns false if it should stay buffered. */
  private apply(dir: Dir): boolean {
    const sim = this.sim;
    switch (dir) {
      case 'UP':
        if (!sim.player.jump()) return false;
        sim.events.push('jump');
        return true;
      case 'DOWN':
        sim.player.slide();
        sim.events.push('slide');
        return true;
      case 'LEFT':
      case 'RIGHT':
        return this.applyLateral(dir === 'LEFT' ? -1 : 1);
    }
  }

  private applyLateral(d: -1 | 1): boolean {
    const sim = this.sim;
    const corner = sim.upcomingCorner();
    if (corner && sim.s >= turnIntentStart(corner, sim.speed)) {
      if (d === corner.turnDir) {
        // Hold early intents in the buffer until the window actually opens.
        if (sim.s < turnWindowStart(corner, sim.speed)) return false;
        this.queuedTurnId = corner.id;
        return true;
      }
      if (sim.s >= corner.startS) {
        sim.die('wrongTurn');
        return true;
      }
    }
    if (!sim.player.changeLane(d)) return false;
    sim.events.push('lane', d);
    return true;
  }

  /**
   * Executes a queued turn at the pivot (surge auto-steers), or ends the run if the player
   * ran past the window. Returns true if a turn happened this tick.
   */
  updateTurn(autoSteer: boolean): boolean {
    const sim = this.sim;
    const corner = sim.upcomingCorner();
    if (!corner || sim.s < corner.pivotS) return false;
    if (this.queuedTurnId === corner.id || autoSteer) {
      this.executeTurn(corner);
      return true;
    }
    if (sim.s > turnWindowEnd(corner)) sim.die('missedTurn');
    return false;
  }

  private executeTurn(corner: Segment): void {
    const sim = this.sim;
    const frame = sim.frame;
    const oldX = frame.worldX(sim.s, sim.player.x);
    const oldZ = frame.worldZ(sim.s, sim.player.x);
    const h = corner.heading;
    const half = CORNER_SIZE / 2;
    frame.set(
      corner.originX + DIR_X[h]! * half,
      corner.originZ + DIR_Z[h]! * half,
      corner.exitHeading,
      corner.pivotS,
    );
    sim.player.setLane(CENTER_LANE, true);
    this.lastTurnedId = corner.id;
    this.queuedTurnId = -1;
    sim.turnOffsetX = oldX - frame.worldX(sim.s, 0);
    sim.turnOffsetZ = oldZ - frame.worldZ(sim.s, 0);
    sim.events.push('turn', corner.turnDir);
  }
}
