import { DT, JUMP_DURATION, LANE_CHANGE_TIME, LANE_COUNT, PLAYER_HALF_DEPTH } from '../config';
import { turnIntentStart, turnWindowStart } from '../systems/Turns';
import type { Action } from '../world/PatternValidator';
import { requiredGap } from '../world/PatternValidator';
import type { Obstacle } from '../world/Segment';
import type { Simulation } from './Simulation';

/** Metres past the window opening at which the bot commits its turn swipe. */
const TURN_COMMIT_OFFSET = 0.75;
const MAX_ROWS = 8;
const PLAN_ROWS = 4;
const HORIZON = 110;
/** Start a slide this long before touching a beam. */
const SLIDE_LEAD_TIME = 0.2;

/** An obstacle row ahead: per-lane action (null = impassable) and its path extent. */
class Row {
  center = 0;
  s0 = 0;
  s1 = 0;
  readonly lanes: (Action | null)[] = ['none', 'none', 'none'];

  clear(center: number): void {
    this.center = center;
    this.s0 = Number.POSITIVE_INFINITY;
    this.s1 = Number.NEGATIVE_INFINITY;
    this.lanes[0] = this.lanes[1] = this.lanes[2] = 'none';
  }
}

function actionOf(o: Obstacle): Action | null {
  return o.kind === 'pillar' ? null : o.kind === 'beam' ? 'slide' : 'jump';
}

/**
 * A perfect player driven purely by simulation state. Used by headless tests to prove
 * every generated track is beatable, and by the menu as an attract-mode demo.
 * Call `update()` before each `sim.step()`.
 */
export class Bot {
  private readonly rows: Row[] = [];
  private rowCount = 0;
  private turnedFor = -1;
  private jumpedFor = Number.NaN;
  private slidFor = Number.NaN;
  private readonly plan = new Int8Array(PLAN_ROWS);
  private readonly cost = new Float64Array(LANE_COUNT * PLAN_ROWS);
  private readonly from = new Int8Array(LANE_COUNT * PLAN_ROWS);

  constructor(private readonly sim: Simulation) {
    for (let i = 0; i < MAX_ROWS; i++) this.rows.push(new Row());
  }

  reset(): void {
    this.turnedFor = -1;
    this.jumpedFor = Number.NaN;
    this.slidFor = Number.NaN;
  }

  update(): void {
    if (!this.sim.alive) return;
    this.scanRows();
    this.handleTurn();
    const first = this.firstUpcomingRow();
    const planned = this.planLanes(first);
    if (planned > 0) {
      this.handleLane(first);
      this.handleVertical(first, planned);
    }
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

  /** Collects obstacle rows ahead of the player (up to the next corner pivot). */
  private scanRows(): void {
    const sim = this.sim;
    const corner = sim.upcomingCorner();
    const limit = Math.min(sim.s + HORIZON, corner ? corner.pivotS : Number.POSITIVE_INFINITY);
    this.rowCount = 0;
    for (let i = 0; i < sim.pool.count; i++) {
      const seg = sim.pool.at(i);
      if (seg.endS < sim.s - 2 || seg.startS > limit) continue;
      for (let k = 0; k < seg.obstacleCount; k++) {
        const o = seg.obstacles[k]!;
        if (o.s1 + PLAYER_HALF_DEPTH < sim.s || o.s0 > limit) continue;
        const center = (o.s0 + o.s1) / 2;
        let row = this.rowCount > 0 ? this.rows[this.rowCount - 1]! : null;
        if (!row || Math.abs(row.center - center) > 0.01) {
          if (this.rowCount >= MAX_ROWS) return;
          row = this.rows[this.rowCount++]!;
          row.clear(center);
        }
        row.s0 = Math.min(row.s0, o.s0);
        row.s1 = Math.max(row.s1, o.s1);
        const act = actionOf(o);
        for (let lane = 0; lane < LANE_COUNT; lane++) {
          if ((o.laneMask & (1 << lane)) !== 0) row.lanes[lane] = act;
        }
      }
    }
  }

  /** Index of the first row the player has not started crossing yet. */
  private firstUpcomingRow(): number {
    const s = this.sim.s;
    let i = 0;
    while (i < this.rowCount && this.rows[i]!.s0 - PLAYER_HALF_DEPTH <= s) i++;
    return i;
  }

  private insideRow(): boolean {
    const s = this.sim.s;
    for (let i = 0; i < this.rowCount; i++) {
      const r = this.rows[i]!;
      if (s + PLAYER_HALF_DEPTH > r.s0 - 0.05 && s - PLAYER_HALF_DEPTH < r.s1 + 0.05) return true;
    }
    return false;
  }

  /**
   * Dynamic programme over the next few rows: cheapest feasible lane sequence (lane changes
   * plus a small penalty for needing to jump/slide). Fills `plan`; returns rows planned.
   */
  private planLanes(first: number): number {
    const sim = this.sim;
    const v = Math.max(sim.speed, 1);
    const n = Math.min(PLAN_ROWS, this.rowCount - first);
    if (n <= 0) return 0;
    const lane0 = sim.player.lane;
    const cost = this.cost;
    cost.fill(Number.POSITIVE_INFINITY);

    const r0 = this.rows[first]!;
    const tContact = (r0.s0 - PLAYER_HALF_DEPTH - sim.s) / v;
    for (let l = 0; l < LANE_COUNT; l++) {
      const act = r0.lanes[l];
      if (act === null || act === undefined) continue;
      const k = Math.abs(l - lane0);
      if (k > 0 && tContact < k * LANE_CHANGE_TIME + 0.02) continue;
      cost[l] = k + (act === 'none' ? 0 : 0.3);
    }
    for (let i = 1; i < n; i++) {
      const a = this.rows[first + i - 1]!;
      const b = this.rows[first + i]!;
      const dt = (b.center - a.center) / v;
      const hdA = ((a.s1 - a.s0) / 2 + PLAYER_HALF_DEPTH) / v;
      const hdB = ((b.s1 - b.s0) / 2 + PLAYER_HALF_DEPTH) / v;
      for (let lb = 0; lb < LANE_COUNT; lb++) {
        const actB = b.lanes[lb];
        if (actB === null || actB === undefined) continue;
        for (let la = 0; la < LANE_COUNT; la++) {
          const prev = cost[(i - 1) * LANE_COUNT + la]!;
          if (prev === Number.POSITIVE_INFINITY) continue;
          const k = Math.abs(la - lb);
          if (dt < requiredGap(a.lanes[la]!, actB, k, hdA, hdB)) continue;
          const c = prev + k + (actB === 'none' ? 0 : 0.3);
          if (c < cost[i * LANE_COUNT + lb]!) {
            cost[i * LANE_COUNT + lb] = c;
            this.from[i * LANE_COUNT + lb] = la;
          }
        }
      }
    }
    // Backtrack from the cheapest reachable lane of the deepest planned row.
    let depth = n - 1;
    let best = -1;
    while (depth >= 0 && best < 0) {
      let bestCost = Number.POSITIVE_INFINITY;
      for (let l = 0; l < LANE_COUNT; l++) {
        const c = cost[depth * LANE_COUNT + l]!;
        if (c < bestCost) {
          bestCost = c;
          best = l;
        }
      }
      if (best < 0) depth--;
    }
    if (best < 0) return 0;
    for (let i = depth; i >= 0; i--) {
      this.plan[i] = best;
      if (i > 0) best = this.from[i * LANE_COUNT + best]!;
    }
    return depth + 1;
  }

  private handleLane(first: number): void {
    const sim = this.sim;
    const target = this.plan[0]!;
    const lane = sim.player.lane;
    if (target === lane || this.insideRow()) return;
    const corner = sim.upcomingCorner();
    if (corner && sim.s >= turnIntentStart(corner, sim.speed) - 1) return;
    if (first >= this.rowCount) return;
    sim.pushInput(target < lane ? 'LEFT' : 'RIGHT');
  }

  private handleVertical(first: number, planned: number): void {
    const sim = this.sim;
    const v = sim.speed;
    for (let i = 0; i < planned; i++) {
      const row = this.rows[first + i]!;
      const act = row.lanes[this.plan[i]!];
      if (act === 'none') continue;
      if (act === 'jump') {
        if (this.jumpedFor === row.center) return;
        // Center the jump over the row (inputs apply on the next tick).
        if (sim.s >= row.center - (v * JUMP_DURATION) / 2 - v * DT * 0.5) {
          sim.pushInput('UP');
          this.jumpedFor = row.center;
        }
      } else if (act === 'slide') {
        if (this.slidFor === row.center) return;
        if (sim.s + PLAYER_HALF_DEPTH >= row.s0 - v * SLIDE_LEAD_TIME) {
          sim.pushInput('DOWN');
          this.slidFor = row.center;
        }
      }
      return;
    }
  }
}
