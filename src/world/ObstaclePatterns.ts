/**
 * Hand-authored obstacle templates.
 *
 * A row is written `"<slot> <cells>"`, e.g. `"1.5 P.L"`. Slots are time units
 * (`SLOT_TIME` seconds each, converted to meters with the generation-time speed estimate),
 * so templates stay equally fair at every speed. Cells, left → right lane:
 *   `.` free   `L` low barrier (jump)   `B` overhead beam (slide)
 *   `P` fallen pillar (change lane)     `G` floor gap (must be `GGG`; jump)
 *
 * Every template is checked by `PatternValidator` (unit-tested at build time) and the
 * generator only ever picks from this list, so unavoidable combinations cannot occur.
 */

export type CellType = 'free' | 'low' | 'beam' | 'pillar' | 'gap';

export interface PatternRow {
  at: number;
  cells: readonly [CellType, CellType, CellType];
}

export interface Pattern {
  name: string;
  tier: number;
  weight: number;
  rows: readonly PatternRow[];
}

/** Seconds per slot. Chosen so any single transition between rows is always feasible. */
export const SLOT_TIME = 1.15;

const CELL: Record<string, CellType> = {
  '.': 'free',
  L: 'low',
  B: 'beam',
  P: 'pillar',
  G: 'gap',
};

function parseRow(src: string): PatternRow {
  const [at, cells] = src.trim().split(/\s+/);
  if (at === undefined || cells === undefined || cells.length !== 3) {
    throw new Error(`Bad pattern row "${src}"`);
  }
  const c = [...cells].map((ch) => {
    const t = CELL[ch];
    if (!t) throw new Error(`Bad cell "${ch}" in "${src}"`);
    return t;
  });
  return { at: Number(at), cells: [c[0]!, c[1]!, c[2]!] };
}

function def(name: string, tier: number, weight: number, rows: string[]): Pattern {
  return { name, tier, weight, rows: rows.map(parseRow) };
}

export const PATTERNS: readonly Pattern[] = [
  // Tier 0 — single, readable obstacles.
  def('hurdle', 0, 3, ['0 LLL']),
  def('duck', 0, 3, ['0 BBB']),
  def('pillar-left', 0, 2, ['0 P..']),
  def('pillar-right', 0, 2, ['0 ..P']),
  def('pillar-mid', 0, 2, ['0 .P.']),
  def('rubble-left', 0, 2, ['0 LL.']),
  def('rubble-right', 0, 2, ['0 .LL']),
  def('fallen-two-left', 0, 2, ['0 PP.']),
  def('fallen-two-right', 0, 2, ['0 .PP']),
  def('pit', 0, 2, ['0 GGG']),

  // Tier 1 — pairs.
  def('hurdle-duck', 1, 3, ['0 LLL', '1 BBB']),
  def('duck-hurdle', 1, 3, ['0 BBB', '1 LLL']),
  def('double-hurdle', 1, 2, ['0 LLL', '1 LLL']),
  def('slalom', 1, 3, ['0 PP.', '1 .PP']),
  def('slalom-rev', 1, 3, ['0 .PP', '1 PP.']),
  def('gate', 1, 2, ['0 P.P', '0.5 P.P', '1 P.P']),
  def('split', 1, 2, ['0 LPB']),
  def('split-rev', 1, 2, ['0 BPL']),
  def('pit-hurdle', 1, 2, ['0 GGG', '1.2 LLL']),
  def('beam-gate', 1, 2, ['0 BPB']),

  // Tier 2 — short sequences.
  def('triple', 2, 3, ['0 LLL', '1 BBB', '2 LLL']),
  def('zigzag', 2, 3, ['0 PP.', '1 .PP', '2 PP.']),
  def('mixed-a', 2, 2, ['0 L.B', '1 .P.', '2 BBB']),
  def('pit-run', 2, 2, ['0 GGG', '1 PP.', '2 BBB']),
  def('mixed-b', 2, 2, ['0 .LP', '1 BB.', '2 PLL']),
  def('duck-jump', 2, 2, ['0 BBB', '0.7 LLL']),
  def('jump-pit', 2, 2, ['0 LLL', '0.8 GGG']),
  def('corridor', 2, 2, ['0 P.P', '0.5 P.P', '1 PBP', '1.5 P.P', '2 PLP']),

  // Tier 3 — dense.
  def('fast-slalom', 3, 3, ['0 PP.', '0.7 .PP', '1.4 PP.', '2.1 .PP']),
  def('gauntlet', 3, 2, ['0 LPB', '1 BPL', '2 GGG']),
  def('switchback', 3, 2, ['0 BBB', '0.8 PP.', '1.6 LLL', '2.4 .PP']),
  def('double-pit', 3, 2, ['0 GGG', '0.9 GGG']),
  def('weave', 3, 2, ['0 L.L', '0.6 P.P', '1.2 BBB', '2 .PP']),
  def('stairs', 3, 2, ['0 LLL', '0.8 BBB', '1.5 LLL', '2.3 BBB']),
];

/** Span of a pattern in slots (first row to last row). */
export function patternSpan(p: Pattern): number {
  return p.rows[p.rows.length - 1]!.at;
}

/** Patterns available at a tier: everything at or below it (higher tiers weighted more). */
export function patternsForTier(tier: number): Pattern[] {
  return PATTERNS.filter((p) => p.tier <= tier);
}
