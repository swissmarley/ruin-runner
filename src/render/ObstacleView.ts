import * as THREE from 'three';
import { LANE_WIDTH, OBSTACLE_LANE_INSET } from '../config';
import { laneToX } from '../entities/Player';
import { DIR_X, DIR_Z, headingYaw, rightOf } from '../world/Heading';
import type { Obstacle, Segment } from '../world/Segment';
import { MAX_OBSTACLES } from '../world/Segment';
import type { SegmentPool } from '../world/SegmentPool';
import type { Materials } from './Materials';
import { beamBlock, beamPost, fallenColumn, pillarStump, rubbleBarrier } from './ObstacleMeshes';
import { SlotInstances } from './SlotInstances';

const PER_SLOT = MAX_OBSTACLES * 3;

const NONE = -1;

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const p = new THREE.Vector3();
const sc = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

/** Which instanced mesh (and indices) represent each obstacle, so hits can hide it. */
interface Ref {
  mesh: SlotInstances | null;
  readonly indices: Int32Array;
  count: number;
}

/**
 * Draws obstacles with one instanced mesh per obstacle type. Hit obstacles (stumbled
 * through, smashed by surge or shield) are hidden individually.
 */
export class ObstacleView {
  readonly group = new THREE.Group();
  private readonly rubble: SlotInstances;
  private readonly beams: SlotInstances;
  private readonly posts: SlotInstances;
  private readonly stumps: SlotInstances;
  private readonly columns: SlotInstances;
  private readonly all: SlotInstances[];
  private readonly builtIds: Int32Array;
  private readonly refs: Ref[][] = [];
  private readonly hidden: Uint8Array;

  constructor(materials: Materials, slots: number) {
    const mat = materials.stone;
    this.rubble = new SlotInstances(rubbleBarrier(), mat, slots, PER_SLOT, false);
    this.beams = new SlotInstances(beamBlock(), mat, slots, MAX_OBSTACLES, false);
    this.posts = new SlotInstances(beamPost(), mat, slots, MAX_OBSTACLES * 2, false);
    this.stumps = new SlotInstances(pillarStump(), mat, slots, MAX_OBSTACLES, false);
    this.columns = new SlotInstances(fallenColumn(), mat, slots, MAX_OBSTACLES, false);
    this.all = [this.rubble, this.beams, this.posts, this.stumps, this.columns];
    for (const s of [this.rubble, this.beams, this.stumps, this.columns]) s.mesh.castShadow = true;
    this.group.add(
      this.rubble.mesh,
      this.beams.mesh,
      this.posts.mesh,
      this.stumps.mesh,
      this.columns.mesh,
    );
    this.builtIds = new Int32Array(slots).fill(-1);
    this.hidden = new Uint8Array(slots * MAX_OBSTACLES);
    for (let i = 0; i < slots; i++) {
      const row: Ref[] = [];
      for (let k = 0; k < MAX_OBSTACLES; k++) {
        row.push({ mesh: null, indices: new Int32Array(3).fill(NONE), count: 0 });
      }
      this.refs.push(row);
    }
  }

  invalidate(): void {
    this.builtIds.fill(-1);
    for (let i = 0; i < this.builtIds.length; i++) for (const s of this.all) s.clearSlot(i);
  }

  update(pool: SegmentPool): void {
    for (let k = 0; k < this.all.length; k++) this.all[k]!.releaseInactive(pool, this.builtIds);
    for (let i = 0; i < pool.count; i++) {
      const seg = pool.at(i);
      if (this.builtIds[seg.slot] !== seg.id) {
        this.builtIds[seg.slot] = seg.id;
        this.build(seg);
      }
      this.syncHits(seg);
    }
    for (let k = 0; k < this.all.length; k++) this.all[k]!.flush();
  }

  private syncHits(seg: Segment): void {
    const base = seg.slot * MAX_OBSTACLES;
    for (let k = 0; k < seg.obstacleCount; k++) {
      if (!seg.obstacles[k]!.hit || this.hidden[base + k]) continue;
      this.hidden[base + k] = 1;
      const ref = this.refs[seg.slot]![k]!;
      if (!ref.mesh) continue;
      for (let n = 0; n < ref.count; n++) ref.mesh.hide(ref.indices[n]!);
    }
  }

  private build(seg: Segment): void {
    const slot = seg.slot;
    for (const s of this.all) s.begin(slot);
    this.hidden.fill(0, slot * MAX_OBSTACLES, (slot + 1) * MAX_OBSTACLES);
    for (let k = 0; k < seg.obstacleCount; k++) {
      const ref = this.refs[slot]![k]!;
      ref.mesh = null;
      ref.count = 0;
      this.buildObstacle(seg, seg.obstacles[k]!, ref);
    }
    for (const s of this.all) s.commit();
  }

  private buildObstacle(seg: Segment, o: Obstacle, ref: Ref): void {
    if (o.kind === 'gap') return;
    const s = (o.s0 + o.s1) / 2;
    let first = -1;
    let last = -1;
    for (let lane = 0; lane < 3; lane++) {
      if (o.blocksLane(lane)) {
        if (first < 0) first = lane;
        last = lane;
      }
    }
    const x0 = laneToX(first) - LANE_WIDTH / 2 + OBSTACLE_LANE_INSET;
    const x1 = laneToX(last) + LANE_WIDTH / 2 - OBSTACLE_LANE_INSET;
    const cx = (x0 + x1) / 2;
    const width = x1 - x0;
    const flip = o.variant % 2 === 0 ? 0 : Math.PI;

    if (o.kind === 'low') {
      // One rubble unit per lane; a hit knocks the whole barrier down.
      ref.mesh = this.rubble;
      for (let lane = first; lane <= last; lane++) {
        this.compose(seg, s, laneToX(lane), 1, 1, flip);
        ref.indices[ref.count++] = this.rubble.push(m);
      }
    } else if (o.kind === 'beam') {
      ref.mesh = this.beams;
      this.compose(seg, s, cx, width + 0.4, 1, 0);
      ref.indices[ref.count++] = this.beams.push(m);
      this.compose(seg, s, x0 - 0.2, 1, 1, 0);
      this.posts.push(m);
      this.compose(seg, s, x1 + 0.2, 1, 1, 0);
      this.posts.push(m);
    } else if (first === last) {
      ref.mesh = this.stumps;
      this.compose(seg, s, cx, 1, 1, flip + o.variant * 0.7);
      ref.indices[ref.count++] = this.stumps.push(m);
    } else {
      ref.mesh = this.columns;
      this.compose(seg, s, cx, width + 0.2, 1, flip);
      ref.indices[ref.count++] = this.columns.push(m);
    }
  }

  /** Composes `m` at track position (s, x) with a width stretch along the lateral axis. */
  private compose(seg: Segment, s: number, x: number, sx: number, sz: number, yaw: number): void {
    const h = seg.heading;
    const r = rightOf(h);
    const ls = s - seg.startS;
    p.set(
      seg.originX + DIR_X[h]! * ls + DIR_X[r]! * x,
      0,
      seg.originZ + DIR_Z[h]! * ls + DIR_Z[r]! * x,
    );
    q.setFromAxisAngle(up, headingYaw(h) + (sx === 1 ? yaw : 0));
    sc.set(sx, 1, sz);
    m.compose(p, q, sc);
  }
}
