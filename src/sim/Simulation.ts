import { CENTER_LANE, CORNER_SIZE, KEEP_BEHIND, SEGMENT_POOL_SIZE, SPAWN_AHEAD } from '../config';
import { Player } from '../entities/Player';
import { distanceAtTime, speedAt } from '../systems/Difficulty';
import { nextCorner, turnIntentStart, turnWindowEnd, turnWindowStart } from '../systems/Turns';
import { DIR_X, DIR_Z, PathFrame } from '../world/Heading';
import type { Segment } from '../world/Segment';
import { SegmentPool } from '../world/SegmentPool';
import { TrackGenerator } from '../world/TrackGenerator';
import type { Dir } from './InputBuffer';
import { InputBuffer } from './InputBuffer';
import { SimEvents } from './SimEvents';

const PENDING_CAPACITY = 8;

export type DeathCause = 'none' | 'missedTurn' | 'wrongTurn' | 'pit' | 'obstacle' | 'caught';

/**
 * The complete game logic, headless and deterministic for a (seed, input sequence) pair.
 * Everything is in track space; `px/pz` are derived world coordinates for rendering.
 */
export class Simulation {
  readonly player = new Player();
  readonly pool = new SegmentPool(SEGMENT_POOL_SIZE);
  readonly generator: TrackGenerator;
  /** Frame of the straight run the player is currently on. */
  readonly frame = new PathFrame();
  readonly buffer = new InputBuffer();
  readonly events = new SimEvents();

  seed = 0;
  /** Path distance travelled (meters). */
  s = 0;
  prevS = 0;
  startS = 0;
  speed = 0;
  elapsed = 0;
  tick = 0;
  alive = true;
  deathCause: DeathCause = 'none';

  px = 0;
  pz = 0;
  prevPx = 0;
  prevPz = 0;
  /** Visual offset (old − new world position) produced by the latest turn. */
  turnOffsetX = 0;
  turnOffsetZ = 0;

  /** Id of the last corner turned (corners are identified by monotonic segment id). */
  lastTurnedId = -1;
  queuedTurnId = -1;

  private readonly pending: Dir[] = new Array<Dir>(PENDING_CAPACITY).fill('UP');
  private pendingCount = 0;

  constructor(seed: number) {
    this.generator = new TrackGenerator(seed);
    this.reset(seed);
  }

  /** Starts a new run. `startTime` > 0 begins mid-curve (used by tests to probe high speeds). */
  reset(seed: number, startTime = 0): void {
    this.seed = seed >>> 0;
    this.startS = distanceAtTime(startTime);
    this.generator.reset(this.seed, this.startS);
    this.pool.clear();
    this.player.reset();
    this.frame.set(0, 0, 0, this.startS);
    this.buffer.consume();
    this.events.clear();
    this.pendingCount = 0;
    this.s = this.prevS = this.startS;
    this.elapsed = startTime;
    this.tick = 0;
    this.speed = speedAt(startTime);
    this.alive = true;
    this.deathCause = 'none';
    this.lastTurnedId = -1;
    this.queuedTurnId = -1;
    this.turnOffsetX = this.turnOffsetZ = 0;
    this.generator.fill(this.pool, this.s + SPAWN_AHEAD);
    this.updateWorldPosition();
    this.prevPx = this.px;
    this.prevPz = this.pz;
  }

  /** Metres run in this attempt. */
  get distance(): number {
    return this.s - this.startS;
  }

  /** Queues a directional input; it is applied at the start of the next tick. */
  pushInput(dir: Dir): void {
    if (this.pendingCount < PENDING_CAPACITY) this.pending[this.pendingCount++] = dir;
  }

  /** The next corner the player has not turned yet (null if none streamed in). */
  upcomingCorner(): Segment | null {
    return nextCorner(this.pool, this.lastTurnedId);
  }

  step(dt: number): void {
    if (!this.alive) return;
    this.tick++;
    this.elapsed += dt;
    this.speed = speedAt(this.elapsed);
    this.prevS = this.s;
    this.prevPx = this.px;
    this.prevPz = this.pz;

    this.processInputs(dt);
    if (!this.alive) return;
    this.player.update(dt);
    this.s += this.speed * dt;
    const turned = this.updateTurn();
    this.stream();
    this.updateWorldPosition();
    if (turned) {
      // Keep interpolation continuous along the new heading.
      const h = this.frame.heading;
      this.prevPx = this.px - DIR_X[h]! * (this.s - this.prevS);
      this.prevPz = this.pz - DIR_Z[h]! * (this.s - this.prevS);
    }
  }

  die(cause: DeathCause): void {
    if (!this.alive) return;
    this.alive = false;
    this.deathCause = cause;
    this.events.push('death');
  }

  private processInputs(dt: number): void {
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
    const p = this.player;
    switch (dir) {
      case 'UP':
        if (!p.jump()) return false;
        this.events.push('jump');
        return true;
      case 'DOWN':
        p.slide();
        this.events.push('slide');
        return true;
      case 'LEFT':
      case 'RIGHT':
        return this.applyLateral(dir === 'LEFT' ? -1 : 1);
    }
  }

  private applyLateral(d: -1 | 1): boolean {
    const corner = this.upcomingCorner();
    if (corner && this.s >= turnIntentStart(corner, this.speed)) {
      if (d === corner.turnDir) {
        // Hold early intents in the buffer until the window actually opens.
        if (this.s < turnWindowStart(corner, this.speed)) return false;
        this.queuedTurnId = corner.id;
        return true;
      }
      if (this.s >= corner.startS) {
        this.die('wrongTurn');
        return true;
      }
    }
    if (!this.player.changeLane(d)) return false;
    this.events.push('lane', d);
    return true;
  }

  /** Executes a queued turn at the pivot, or kills the player if they ran past it. */
  private updateTurn(): boolean {
    const corner = this.upcomingCorner();
    if (!corner || this.s < corner.pivotS) return false;
    if (this.queuedTurnId === corner.id) {
      this.executeTurn(corner);
      return true;
    }
    if (this.s > turnWindowEnd(corner)) this.die('missedTurn');
    return false;
  }

  private executeTurn(corner: Segment): void {
    const oldX = this.frame.worldX(this.s, this.player.x);
    const oldZ = this.frame.worldZ(this.s, this.player.x);
    const h = corner.heading;
    const half = CORNER_SIZE / 2;
    this.frame.set(
      corner.originX + DIR_X[h]! * half,
      corner.originZ + DIR_Z[h]! * half,
      corner.exitHeading,
      corner.pivotS,
    );
    this.player.setLane(CENTER_LANE, true);
    this.lastTurnedId = corner.id;
    this.queuedTurnId = -1;
    this.turnOffsetX = oldX - this.frame.worldX(this.s, 0);
    this.turnOffsetZ = oldZ - this.frame.worldZ(this.s, 0);
    this.events.push('turn', corner.turnDir);
  }

  private stream(): void {
    const pool = this.pool;
    while (pool.count > 0 && pool.at(0).endS < this.s - KEEP_BEHIND) pool.releaseOldest();
    this.generator.fill(pool, this.s + SPAWN_AHEAD);
  }

  private updateWorldPosition(): void {
    this.px = this.frame.worldX(this.s, this.player.x);
    this.pz = this.frame.worldZ(this.s, this.player.x);
  }
}
