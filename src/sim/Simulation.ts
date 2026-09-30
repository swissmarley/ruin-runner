import { KEEP_BEHIND, SEGMENT_POOL_SIZE, SPAWN_AHEAD } from '../config';
import { Player } from '../entities/Player';
import { speedAt } from '../systems/Difficulty';
import { PathFrame } from '../world/Heading';
import { SegmentPool } from '../world/SegmentPool';
import { TrackGenerator } from '../world/TrackGenerator';
import type { Dir } from './InputBuffer';
import { InputBuffer } from './InputBuffer';
import { SimEvents } from './SimEvents';

const PENDING_CAPACITY = 8;

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
  speed = 0;
  elapsed = 0;
  tick = 0;
  alive = true;

  px = 0;
  pz = 0;
  prevPx = 0;
  prevPz = 0;
  /** Visual offset (old − new world position) produced by the latest turn. */
  turnOffsetX = 0;
  turnOffsetZ = 0;

  private readonly pending: Dir[] = new Array<Dir>(PENDING_CAPACITY).fill('UP');
  private pendingCount = 0;

  constructor(seed: number) {
    this.generator = new TrackGenerator(seed);
    this.reset(seed);
  }

  reset(seed: number): void {
    this.seed = seed >>> 0;
    this.generator.reset(this.seed);
    this.pool.clear();
    this.player.reset();
    this.frame.set(0, 0, 0, 0);
    this.buffer.consume();
    this.events.clear();
    this.pendingCount = 0;
    this.s = this.prevS = 0;
    this.elapsed = 0;
    this.tick = 0;
    this.speed = speedAt(0);
    this.alive = true;
    this.generator.fill(this.pool, SPAWN_AHEAD);
    this.updateWorldPosition();
    this.prevPx = this.px;
    this.prevPz = this.pz;
  }

  /** Queues a directional input; it is applied at the start of the next tick. */
  pushInput(dir: Dir): void {
    if (this.pendingCount < PENDING_CAPACITY) this.pending[this.pendingCount++] = dir;
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
    this.player.update(dt);
    this.s += this.speed * dt;
    this.stream();
    this.updateWorldPosition();
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
      case 'RIGHT': {
        const d = dir === 'LEFT' ? -1 : 1;
        if (!p.changeLane(d)) return false;
        this.events.push('lane', d);
        return true;
      }
    }
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
