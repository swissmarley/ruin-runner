import { Rng } from '../core/Rng';
import type { Segment, SegmentKind } from './Segment';
import type { SegmentPool } from './SegmentPool';

const STRAIGHT_LENGTH = 32;
/** The first segment starts behind the player so the camera never sees the track's end. */
const START_BACKSTOP = 16;

/**
 * Streams segments ahead of the player. Deterministic for a given seed.
 * (M2: straight segments only.)
 */
export class TrackGenerator {
  private readonly rng: Rng;
  private nextId = 0;
  private cursorS = 0;
  private cursorX = 0;
  private cursorZ = 0;
  private heading = 0;

  constructor(seed: number) {
    this.rng = new Rng(seed);
  }

  reset(seed: number): void {
    this.rng.reset(seed);
    this.nextId = 0;
    this.cursorS = -START_BACKSTOP;
    this.cursorX = 0;
    this.cursorZ = START_BACKSTOP;
    this.heading = 0;
  }

  /** Path distance where the next generated segment will start. */
  get frontierS(): number {
    return this.cursorS;
  }

  /** Generates segments until the frontier passes `untilS` or the pool is full. */
  fill(pool: SegmentPool, untilS: number): void {
    while (!pool.isFull && this.cursorS < untilS) {
      const seg = pool.acquire();
      this.place(seg, 'straight', STRAIGHT_LENGTH);
    }
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
