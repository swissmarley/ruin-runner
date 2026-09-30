import {
  CORNER_SIZE,
  CRUMBLE_GAP_LENGTH,
  INPUT_BUFFER_TIME,
  TURN_WINDOW_LEAD_TIME,
  TURN_WINDOW_MIN_LEAD,
} from '../config';
import { Rng } from '../core/Rng';
import {
  cornerChanceAt,
  difficultyAt,
  patternChanceAt,
  restSlotsAt,
  speedAt,
  tierAt,
  timeAtDistance,
} from '../systems/Difficulty';
import { patternSpan, SLOT_TIME } from './ObstaclePatterns';
import { PatternPicker, placeCrumble, placePattern } from './PatternPlacer';
import type { Segment, SegmentKind } from './Segment';
import { MAX_SEGMENT_LENGTH, TILE_LENGTH } from './Segment';
import type { SegmentPool } from './SegmentPool';

/** The first segment starts behind the player so the camera never sees the track's end. */
const START_BACKSTOP = 16;
const START_STRAIGHTS = 2;
const MIN_STRAIGHTS_BETWEEN_CORNERS = 1;
const BRIDGE_MIN_GAP = 5;
const BRIDGE_LENGTH_TILES = [10, 11, 12];
const MIN_STRAIGHT_TILES = 4;
/** Extra meters after a pattern's last row center (covers the deepest obstacle). */
const PATTERN_TAIL = 2;

function roundUpToTiles(meters: number): number {
  return Math.ceil(meters / TILE_LENGTH) * TILE_LENGTH;
}

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
  private readonly picker = new PatternPicker();
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
    this.picker.reset();
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

    const slot = SLOT_TIME * ctx.speed;
    const lead = restSlotsAt(ctx.difficulty) * slot;
    const withPattern =
      this.emitted >= START_STRAIGHTS && this.rng.chance(patternChanceAt(ctx.difficulty));
    const pattern = withPattern ? this.picker.pick(this.rng, tierAt(ctx.difficulty)) : null;
    const span = pattern ? patternSpan(pattern) * slot + PATTERN_TAIL : 0;
    // Before a corner the turn window (plus reaction time) must be free of obstacles.
    const tail = ctx.cornerNext ? this.clearTail(ctx.speed) : 0;
    const wanted = pattern ? lead + span + tail : this.rng.int(4, 8) * TILE_LENGTH + tail;
    const length = Math.min(
      MAX_SEGMENT_LENGTH,
      Math.max(MIN_STRAIGHT_TILES * TILE_LENGTH, roundUpToTiles(wanted)),
    );
    this.place(seg, 'straight', length);
    if (pattern) placePattern(seg, pattern, seg.startS + lead, slot, seg.decoSeed);

    this.cornerNext = ctx.cornerNext;
    this.straightsSinceCorner++;
    this.segmentsSinceBridge++;
  }

  /** Obstacle-free distance needed before a corner block at `speed`. */
  private clearTail(speed: number): number {
    const window = Math.max(TURN_WINDOW_MIN_LEAD, speed * TURN_WINDOW_LEAD_TIME);
    return window + speed * (INPUT_BUFFER_TIME + SLOT_TIME * 0.6);
  }

  private emitBridge(seg: Segment): void {
    this.ctx.cornerNext = false;
    const slot = SLOT_TIME * this.ctx.speed;
    const lead = Math.max(slot, 14);
    const minLength = roundUpToTiles(lead + CRUMBLE_GAP_LENGTH + 10);
    const length = Math.max(this.rng.pick(BRIDGE_LENGTH_TILES) * TILE_LENGTH, minLength);
    this.place(seg, 'bridge', Math.min(MAX_SEGMENT_LENGTH, length));
    placeCrumble(seg, seg.startS + lead + CRUMBLE_GAP_LENGTH / 2);
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
