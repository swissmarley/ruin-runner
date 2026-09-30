import * as THREE from 'three';
import { CORNER_SIZE, TRACK_HALF_WIDTH } from '../config';
import { DIR_X, DIR_Z, headingYaw, rightOf } from '../world/Heading';
import type { Segment } from '../world/Segment';
import { MAX_SEGMENT_LENGTH, TILE_LENGTH } from '../world/Segment';
import type { SegmentPool } from '../world/SegmentPool';
import { hash01 } from './Geometry';
import type { Materials } from './Materials';
import { PALETTE } from './Materials';
import { SlotInstances } from './SlotInstances';

const FLOOR_THICKNESS = 0.9;
const PER_SLOT_FLOOR = MAX_SEGMENT_LENGTH / TILE_LENGTH + 8;
const PER_SLOT_CURB = PER_SLOT_FLOOR * 2 + 4;

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const p = new THREE.Vector3();
const sc = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const c = new THREE.Color();

/**
 * Track structure: floor slabs (stone or bridge planks) and edge curbs, drawn with
 * slot-partitioned instanced meshes. A slot is rebuilt only when its segment id changes.
 */
export class WorldView {
  readonly group = new THREE.Group();
  private readonly floor: SlotInstances;
  private readonly planks: SlotInstances;
  private readonly curbs: SlotInstances;
  private readonly builtIds: Int32Array;

  constructor(materials: Materials, slots: number) {
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.floor = new SlotInstances(box, materials.instanced, slots, PER_SLOT_FLOOR, true);
    this.planks = new SlotInstances(box, materials.instanced, slots, PER_SLOT_FLOOR * 3, true);
    this.curbs = new SlotInstances(box, materials.instanced, slots, PER_SLOT_CURB, true);
    this.floor.mesh.receiveShadow = true;
    this.planks.mesh.receiveShadow = true;
    this.group.add(this.floor.mesh, this.planks.mesh, this.curbs.mesh);
    this.builtIds = new Int32Array(slots).fill(-1);
  }

  /** Forces every slot to rebuild (e.g. after a new run starts). */
  invalidate(): void {
    this.builtIds.fill(-1);
    for (let i = 0; i < this.builtIds.length; i++) {
      this.floor.clearSlot(i);
      this.planks.clearSlot(i);
      this.curbs.clearSlot(i);
    }
  }

  update(pool: SegmentPool): void {
    this.floor.releaseInactive(pool, this.builtIds);
    this.planks.releaseInactive(pool, this.builtIds);
    this.curbs.releaseInactive(pool, this.builtIds);
    for (let i = 0; i < pool.count; i++) {
      const seg = pool.at(i);
      if (this.builtIds[seg.slot] !== seg.id) {
        this.builtIds[seg.slot] = seg.id;
        this.build(seg);
      }
    }
  }

  private build(seg: Segment): void {
    this.floor.begin(seg.slot);
    this.planks.begin(seg.slot);
    this.curbs.begin(seg.slot);
    if (seg.isCorner) this.buildCorner(seg);
    else this.buildStraight(seg);
    this.floor.commit();
    this.planks.commit();
    this.curbs.commit();
  }

  private buildStraight(seg: Segment): void {
    // Walk the segment, cutting the floor wherever a gap obstacle opens the ground.
    let cursor = seg.startS;
    for (let i = 0; i < seg.obstacleCount; i++) {
      const o = seg.obstacles[i]!;
      if (o.kind !== 'gap') continue;
      this.floorRun(seg, cursor, o.s0);
      cursor = o.s1;
    }
    this.floorRun(seg, cursor, seg.endS);
  }

  private floorRun(seg: Segment, s0: number, s1: number): void {
    const bridge = seg.kind === 'bridge';
    let s = s0;
    let n = 0;
    while (s1 - s > 0.05) {
      const len = Math.min(TILE_LENGTH, s1 - s);
      const mid = s + len / 2;
      const r = hash01(seg.decoSeed, n++);
      if (bridge) this.bridgeChunk(seg, mid, len, r);
      else this.stoneChunk(seg, mid, len, r);
      s += len;
    }
  }

  private stoneChunk(seg: Segment, mid: number, len: number, r: number): void {
    this.place(
      seg,
      mid,
      0,
      -FLOOR_THICKNESS / 2,
      TRACK_HALF_WIDTH * 2,
      FLOOR_THICKNESS,
      len - 0.06,
    );
    c.setHex(PALETTE.stone).offsetHSL(0, 0, (r - 0.5) * 0.08);
    this.floor.push(m, c);
    for (const side of [-1, 1]) {
      const x = side * (TRACK_HALF_WIDTH + 0.25);
      this.place(seg, mid, x, 0.1, 0.5, 1.0, len - 0.1);
      c.setHex(r > 0.6 ? PALETTE.moss : PALETTE.stoneDark).offsetHSL(0, 0, (r - 0.5) * 0.06);
      this.curbs.push(m, c);
    }
  }

  private bridgeChunk(seg: Segment, mid: number, len: number, r: number): void {
    const planks = Math.max(1, Math.round(len / 1.3));
    const step = len / planks;
    for (let k = 0; k < planks; k++) {
      const s = mid - len / 2 + step * (k + 0.5);
      const rr = hash01(seg.decoSeed + k, 7);
      this.place(seg, s, 0, -0.15, TRACK_HALF_WIDTH * 2 - 0.4, 0.3, step - 0.12);
      c.setHex(PALETTE.wood).offsetHSL(0, 0, (rr - 0.5) * 0.12);
      this.planks.push(m, c);
    }
    for (const side of [-1, 1]) {
      this.place(seg, mid, side * (TRACK_HALF_WIDTH - 0.1), 0.9, 0.12, 0.12, len);
      c.setHex(0x8a6a44);
      this.curbs.push(m, c);
      this.place(seg, mid, side * (TRACK_HALF_WIDTH - 0.1), 0.45, 0.2, 1.1, 0.2);
      c.setHex(PALETTE.wood).offsetHSL(0, 0, r * 0.05);
      this.curbs.push(m, c);
    }
  }

  private buildCorner(seg: Segment): void {
    const half = CORNER_SIZE / 2;
    const h = seg.heading;
    const cx = seg.originX + DIR_X[h]! * half;
    const cz = seg.originZ + DIR_Z[h]! * half;
    p.set(cx, -FLOOR_THICKNESS / 2, cz);
    q.setFromAxisAngle(up, headingYaw(h));
    sc.set(CORNER_SIZE, FLOOR_THICKNESS, CORNER_SIZE);
    m.compose(p, q, sc);
    c.setHex(PALETTE.stoneLight);
    this.floor.push(m, c);
    // Walls on the closed sides: straight ahead and the side opposite the turn.
    const closedSide = rightOf(h) === seg.exitHeading ? -1 : 1;
    this.wall(cx + DIR_X[h]! * (half + 0.3), cz + DIR_Z[h]! * (half + 0.3), h, CORNER_SIZE + 1.2);
    const sideH = rightOf(h);
    const sx = cx + DIR_X[sideH]! * closedSide * (half + 0.3);
    const sz = cz + DIR_Z[sideH]! * closedSide * (half + 0.3);
    this.wall(sx, sz, sideH, CORNER_SIZE + 1.2);
  }

  private wall(x: number, z: number, facing: number, width: number): void {
    p.set(x, 1.1, z);
    q.setFromAxisAngle(up, headingYaw(facing));
    sc.set(width, 2.6, 0.6);
    m.compose(p, q, sc);
    c.setHex(PALETTE.stoneDark);
    this.curbs.push(m, c);
  }

  /** Composes `m` for a box at path distance `s`, lateral `x`, height `y` in a straight segment. */
  private place(
    seg: Segment,
    s: number,
    x: number,
    y: number,
    w: number,
    hgt: number,
    len: number,
  ): void {
    const h = seg.heading;
    const ls = s - seg.startS;
    const r = rightOf(h);
    p.set(
      seg.originX + DIR_X[h]! * ls + DIR_X[r]! * x,
      y,
      seg.originZ + DIR_Z[h]! * ls + DIR_Z[r]! * x,
    );
    q.setFromAxisAngle(up, headingYaw(h));
    sc.set(w, hgt, len);
    m.compose(p, q, sc);
  }
}
