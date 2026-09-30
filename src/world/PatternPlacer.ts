import { CRUMBLE_GAP_LENGTH } from '../config';
import type { Rng } from '../core/Rng';
import type { CellType, Pattern } from './ObstaclePatterns';
import { PATTERNS } from './ObstaclePatterns';
import { cellDepth } from './PatternValidator';
import type { ObstacleKind, Segment } from './Segment';
import { ALL_LANES } from './Segment';

const KIND: Record<Exclude<CellType, 'free'>, ObstacleKind> = {
  low: 'low',
  beam: 'beam',
  pillar: 'pillar',
  gap: 'gap',
};

const MAX_TIER = 3;

/** Per-tier candidate lists and weights, built once (generation never allocates). */
const TIER_POOLS: { patterns: Pattern[]; weights: number[] }[] = [];
for (let tier = 0; tier <= MAX_TIER; tier++) {
  const patterns = PATTERNS.filter((p) => p.tier <= tier);
  // Favour the newest tier so difficulty is felt, but keep older patterns in the mix.
  const weights = patterns.map((p) => p.weight * (p.tier === tier ? 2.2 : 1));
  TIER_POOLS.push({ patterns, weights });
}

/** Picks weighted patterns for a tier, never repeating the previous pick. */
export class PatternPicker {
  private last: Pattern | null = null;

  reset(): void {
    this.last = null;
  }

  pick(rng: Rng, tier: number): Pattern {
    const pool = TIER_POOLS[Math.max(0, Math.min(MAX_TIER, tier))]!;
    let p = pool.patterns[rng.weightedIndex(pool.weights)]!;
    if (p === this.last && pool.patterns.length > 1) {
      p = pool.patterns[rng.weightedIndex(pool.weights)]!;
    }
    this.last = p;
    return p;
  }
}

/**
 * Writes a pattern's rows into a segment as obstacles. Adjacent identical cells in a row
 * merge into one obstacle (e.g. `PP.` is a single pillar lying across two lanes).
 */
export function placePattern(
  seg: Segment,
  pattern: Pattern,
  firstCenter: number,
  slotLength: number,
  variantSeed: number,
): void {
  for (let r = 0; r < pattern.rows.length; r++) {
    const row = pattern.rows[r]!;
    const center = firstCenter + row.at * slotLength;
    let lane = 0;
    while (lane < 3) {
      const cell = row.cells[lane]!;
      if (cell === 'free') {
        lane++;
        continue;
      }
      let mask = 0;
      let end = lane;
      while (end < 3 && row.cells[end] === cell) mask |= 1 << end++;
      const half = cellDepth(cell) / 2;
      const kind = KIND[cell];
      seg.addObstacle(
        kind,
        center - half,
        center + half,
        kind === 'gap' ? ALL_LANES : mask,
        variantSeed + r * 3 + lane,
      );
      lane = end;
    }
  }
}

/** Adds a bridge's crumbled section (a long all-lane gap) centered at `center`. */
export function placeCrumble(seg: Segment, center: number): void {
  const half = CRUMBLE_GAP_LENGTH / 2;
  seg.crumbleS = center - half;
  seg.addObstacle('gap', center - half, center + half, ALL_LANES, 1);
}
