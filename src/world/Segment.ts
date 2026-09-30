import { CORNER_SIZE } from '../config';
import { Coin } from '../entities/Coin';
import { PowerUpPickup } from '../entities/PowerUp';
import { DIR_X, DIR_Z, turnHeading } from './Heading';

export type SegmentKind = 'straight' | 'cornerLeft' | 'cornerRight' | 'bridge';
export type ObstacleKind = 'low' | 'beam' | 'pillar' | 'gap';

export const MAX_OBSTACLES = 20;
export const MAX_COINS = 64;
export const MAX_PICKUPS = 2;
export const MAX_HINTS = 2;
/** Floor tiles are this long; straight segment lengths are multiples of it. */
export const TILE_LENGTH = 4;
export const MAX_SEGMENT_LENGTH = 144;
export const ALL_LANES = 0b111;

/** An obstacle spanning [s0, s1] of path distance over the lanes in `laneMask`. */
export class Obstacle {
  kind: ObstacleKind = 'low';
  s0 = 0;
  s1 = 0;
  laneMask = 0;
  hit = false;
  /** Visual variant seed. */
  variant = 0;

  set(kind: ObstacleKind, s0: number, s1: number, laneMask: number, variant: number): void {
    this.kind = kind;
    this.s0 = s0;
    this.s1 = s1;
    this.laneMask = laneMask;
    this.hit = false;
    this.variant = variant;
  }

  blocksLane(lane: number): boolean {
    return (this.laneMask & (1 << lane)) !== 0;
  }
}

/** In-world tutorial prompt anchored at a path distance. */
export class Hint {
  s = 0;
  text = '';
}

/**
 * One modular piece of track. Instances live in a fixed pool and are refilled in place,
 * so every array here is preallocated to its capacity.
 */
export class Segment {
  /** Monotonic generation id (changes each time the slot is refilled). */
  id = -1;
  kind: SegmentKind = 'straight';
  startS = 0;
  length = 0;
  originX = 0;
  originZ = 0;
  heading = 0;
  decoSeed = 0;
  /** For bridges: path distance at which the floor has crumbled away (see gap obstacle). */
  crumbleS = 0;

  readonly obstacles: Obstacle[] = [];
  obstacleCount = 0;
  readonly coins: Coin[] = [];
  coinCount = 0;
  readonly pickups: PowerUpPickup[] = [];
  pickupCount = 0;
  readonly hints: Hint[] = [];
  hintCount = 0;

  constructor(readonly slot: number) {
    for (let i = 0; i < MAX_OBSTACLES; i++) this.obstacles.push(new Obstacle());
    for (let i = 0; i < MAX_COINS; i++) this.coins.push(new Coin());
    for (let i = 0; i < MAX_PICKUPS; i++) this.pickups.push(new PowerUpPickup());
    for (let i = 0; i < MAX_HINTS; i++) this.hints.push(new Hint());
  }

  init(
    id: number,
    kind: SegmentKind,
    startS: number,
    length: number,
    x: number,
    z: number,
    h: number,
  ): void {
    this.id = id;
    this.kind = kind;
    this.startS = startS;
    this.length = length;
    this.originX = x;
    this.originZ = z;
    this.heading = h;
    this.obstacleCount = 0;
    this.coinCount = 0;
    this.pickupCount = 0;
    this.hintCount = 0;
    this.crumbleS = 0;
  }

  get endS(): number {
    return this.startS + this.length;
  }

  get isCorner(): boolean {
    return this.kind === 'cornerLeft' || this.kind === 'cornerRight';
  }

  get turnDir(): -1 | 0 | 1 {
    return this.kind === 'cornerLeft' ? -1 : this.kind === 'cornerRight' ? 1 : 0;
  }

  get exitHeading(): number {
    const d = this.turnDir;
    return d === 0 ? this.heading : turnHeading(this.heading, d);
  }

  /** Corner pivot path distance (the point where the run direction turns). */
  get pivotS(): number {
    return this.startS + CORNER_SIZE / 2;
  }

  /** World X/Z of the far end, i.e. the next segment's origin. */
  exitX(): number {
    if (!this.isCorner) return this.originX + DIR_X[this.heading]! * this.length;
    const half = CORNER_SIZE / 2;
    return this.originX + DIR_X[this.heading]! * half + DIR_X[this.exitHeading]! * half;
  }

  exitZ(): number {
    if (!this.isCorner) return this.originZ + DIR_Z[this.heading]! * this.length;
    const half = CORNER_SIZE / 2;
    return this.originZ + DIR_Z[this.heading]! * half + DIR_Z[this.exitHeading]! * half;
  }

  addObstacle(kind: ObstacleKind, s0: number, s1: number, laneMask: number, variant = 0): void {
    if (this.obstacleCount >= MAX_OBSTACLES) return;
    this.obstacles[this.obstacleCount++]!.set(kind, s0, s1, laneMask, variant);
  }

  addCoin(s: number, x: number, y: number): void {
    if (this.coinCount >= MAX_COINS) return;
    this.coins[this.coinCount++]!.set(s, x, y);
  }

  addPickup(kind: PowerUpPickup['kind'], s: number, x: number, y: number): void {
    if (this.pickupCount >= MAX_PICKUPS) return;
    this.pickups[this.pickupCount++]!.set(kind, s, x, y);
  }

  addHint(s: number, text: string): void {
    if (this.hintCount >= MAX_HINTS) return;
    const h = this.hints[this.hintCount++]!;
    h.s = s;
    h.text = text;
  }
}
