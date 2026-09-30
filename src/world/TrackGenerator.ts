import { CORNER_SIZE } from '../config';
import { Rng } from '../core/Rng';
import { cornerChanceAt, difficultyAt, speedAt, timeAtDistance } from '../systems/Difficulty';
import type { Segment, SegmentKind } from './Segment';
import { TILE_LENGTH } from './Segment';
import type { SegmentPool } from './SegmentPool';

/** The first segment starts behind the player so the camera never sees the track's end. */
const START_BACKSTOP = 16;
const START_STRAIGHTS = 2;
const MIN_STRAIGHTS_BETWEEN_CORNERS = 1;
const BRIDGE_MIN_GAP = 5;
const BRIDGE_LENGTH_TILES = [10, 11, 12];

/** Snapshot of generation-time difficulty for one segment. */
export interface GenContext {
  difficulty: number;
  /** Upper-bound speed estimate when the player reaches this segment. */
  speed: number;
  /** True if the segment is followed by a corner (its tail must stay clear). */
  cornerNext: boolean;
}

/**
 * Streams segments ahead of the player. The track is a pure function of the seed:
 * difficulty is derived from distance (via the base speed curve), never from live state.
 *
 * Headings are limited to {west, north, east}, so the path zig-zags forward and can never
 * loop back over itself.
 */
export class TrackGenerator {
  private readonly rng: Rng;
  private nextId = 0;
  private cursorS = 0;
  private cursorX = 0;
  private cursorZ = 0;
  private heading = 0;
  private straightsSinceCorner = 0;
  private segmentsSinceBridge = 0;
  private emitted = 0;
  private cornerNext = false;
  private readonly ctx: GenContext = { difficulty: 0, speed: 0, cornerNext: false };

  constructor(seed: number) {
    this.rng = new Rng(seed);
  }

  reset(seed: number, startS = 0): void {
    this.rng.reset(seed);
    this.nextId = 0;
    this.cursorS = startS - START_BACKSTOP;
    this.cursorX = 0;
    this.cursorZ = START_BACKSTOP;
    this.heading = 0;
    this.straightsSinceCorner = 0;
    this.segmentsSinceBridge = 0;
    this.emitted = 0;
    this.cornerNext = false;
  }

  /** Path distance where the next generated segment will start. */
  get frontierS(): number {
    return this.cursorS;
  }

  /** Generates segments until the frontier passes `untilS` or the pool is full. */
  fill(pool: SegmentPool, untilS: number): void {
    while (!pool.isFull && this.cursorS < untilS) this.emit(pool.acquire());
  }

  private emit(seg: Segment): void {
    const t = timeAtDistance(Math.max(0, this.cursorS));
    const ctx = this.ctx;
    ctx.difficulty = difficultyAt(t);
    ctx.speed = speedAt(t + 3);

    if (this.cornerNext) {
      this.cornerNext = false;
      this.emitCorner(seg);
    } else if (this.wantsBridge()) {
      this.emitBridge(seg);
    } else {
      this.emitStraight(seg);
    }
    this.emitted++;
  }

  private wantsBridge(): boolean {
    return (
      this.emitted >= START_STRAIGHTS + 2 &&
      this.straightsSinceCorner >= 1 &&
      this.segmentsSinceBridge >= BRIDGE_MIN_GAP &&
      this.rng.chance(0.07 + 0.05 * this.ctx.difficulty)
    );
  }

  private emitStraight(seg: Segment): void {
    const ctx = this.ctx;
    ctx.cornerNext =
      this.emitted >= START_STRAIGHTS &&
      this.straightsSinceCorner >= MIN_STRAIGHTS_BETWEEN_CORNERS &&
      this.rng.chance(cornerChanceAt(ctx.difficulty));
    const tiles = this.rng.int(4, 10);
    this.place(seg, 'straight', tiles * TILE_LENGTH);
    this.cornerNext = ctx.cornerNext;
    this.straightsSinceCorner++;
    this.segmentsSinceBridge++;
  }

  private emitBridge(seg: Segment): void {
    this.ctx.cornerNext = false;
    const tiles = this.rng.pick(BRIDGE_LENGTH_TILES);
    this.place(seg, 'bridge', tiles * TILE_LENGTH);
    this.segmentsSinceBridge = 0;
  }

  private emitCorner(seg: Segment): void {
    // Keep headings within {3, 0, 1}: from east only turn left, from west only turn right.
    let dir: -1 | 1;
    if (this.heading === 1) dir = -1;
    else if (this.heading === 3) dir = 1;
    else dir = this.rng.chance(0.5) ? -1 : 1;
    this.place(seg, dir < 0 ? 'cornerLeft' : 'cornerRight', CORNER_SIZE);
    this.straightsSinceCorner = 0;
    this.segmentsSinceBridge++;
  }

  private place(seg: Segment, kind: SegmentKind, length: number): void {
    seg.init(this.nextId++, kind, this.cursorS, length, this.cursorX, this.cursorZ, this.heading);
    seg.decoSeed = this.rng.int(0, 0x7fffffff);
    this.cursorS += length;
    this.cursorX = seg.exitX();
    this.cursorZ = seg.exitZ();
    this.heading = seg.exitHeading;
  }
}
