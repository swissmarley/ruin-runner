import * as THREE from 'three';
import { CORNER_SIZE, TRACK_HALF_WIDTH } from '../config';
import { DIR_X, DIR_Z, headingYaw, rightOf } from '../world/Heading';
import type { Segment } from '../world/Segment';
import type { SegmentPool } from '../world/SegmentPool';
import {
  brokenColumn,
  canopyTree,
  cornerStatue,
  gatewayArch,
  sunkenColumn,
  supportPier,
  torchFlame,
  torchPost,
} from './DecorMeshes';
import { hash01 } from './Geometry';
import type { Materials } from './Materials';
import { SlotInstances } from './SlotInstances';

const COLUMN_STEP = 9;
const PIER_STEP = 14;
const TORCH_STEP = 18;

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const p = new THREE.Vector3();
const sc = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

/**
 * Scenery around the walkway: sunken columns rising from the mist, piers under the path,
 * torches, occasional gateway arches, corner statues and jungle canopy far below.
 * Deterministic per segment (seeded by `decoSeed`), rebuilt only when a slot is recycled.
 */
export class DecorView {
  readonly group = new THREE.Group();
  /** Drives the flame flicker shader. */
  readonly time = { value: 0 };
  private readonly columns: SlotInstances;
  private readonly broken: SlotInstances;
  private readonly piers: SlotInstances;
  private readonly posts: SlotInstances;
  private readonly flames: SlotInstances;
  private readonly arches: SlotInstances;
  private readonly statues: SlotInstances;
  private readonly trees: SlotInstances;
  private readonly all: SlotInstances[];
  private readonly builtIds: Int32Array;

  constructor(materials: Materials, slots: number) {
    const mat = materials.vertexColored;
    this.columns = new SlotInstances(sunkenColumn(), mat, slots, 36, false);
    this.broken = new SlotInstances(brokenColumn(), mat, slots, 36, false);
    this.piers = new SlotInstances(supportPier(), mat, slots, 12, false);
    this.posts = new SlotInstances(torchPost(), mat, slots, 18, false);
    const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    addFlicker(flameMat, this.time);
    this.flames = new SlotInstances(torchFlame(), flameMat, slots, 18, false);
    this.arches = new SlotInstances(gatewayArch(TRACK_HALF_WIDTH * 2 + 1.4), mat, slots, 1, false);
    this.statues = new SlotInstances(cornerStatue(), mat, slots, 1, false);
    this.trees = new SlotInstances(canopyTree(), mat, slots, 10, false);
    this.all = [
      this.columns,
      this.broken,
      this.piers,
      this.posts,
      this.flames,
      this.arches,
      this.statues,
      this.trees,
    ];
    for (const s of this.all) this.group.add(s.mesh);
    this.builtIds = new Int32Array(slots).fill(-1);
  }

  invalidate(): void {
    this.builtIds.fill(-1);
    for (let i = 0; i < this.builtIds.length; i++) for (const s of this.all) s.clearSlot(i);
  }

  update(dt: number, pool: SegmentPool): void {
    this.time.value += dt;
    for (let k = 0; k < this.all.length; k++) this.all[k]!.releaseInactive(pool, this.builtIds);
    for (let i = 0; i < pool.count; i++) {
      const seg = pool.at(i);
      if (this.builtIds[seg.slot] === seg.id) continue;
      this.builtIds[seg.slot] = seg.id;
      for (const s of this.all) s.begin(seg.slot);
      if (seg.isCorner) this.buildCorner(seg);
      else this.buildStraight(seg);
      for (const s of this.all) s.commit();
    }
  }

  private buildStraight(seg: Segment): void {
    const seed = seg.decoSeed;
    const bridge = seg.kind === 'bridge';
    let n = 0;
    for (let s = 3; s < seg.length - 2; s += COLUMN_STEP) {
      for (let side = -1; side <= 1; side += 2) {
        const r = hash01(seed, n++);
        if (r < 0.25) continue;
        const x = side * (TRACK_HALF_WIDTH + 1.6 + r * 1.4);
        this.place(seg, seg.startS + s + r * 3, x, 0, r * 6, 1, 1);
        (r < 0.6 ? this.broken : this.columns).push(m);
      }
    }
    if (!bridge) {
      for (let s = PIER_STEP / 2; s < seg.length; s += PIER_STEP) {
        this.place(seg, seg.startS + s, 0, 0, 0, 1, 1);
        this.piers.push(m);
      }
      for (let s = 6; s < seg.length - 3; s += TORCH_STEP) {
        const side = hash01(seed, 900 + s) < 0.5 ? -1 : 1;
        this.place(seg, seg.startS + s, side * (TRACK_HALF_WIDTH + 0.28), 0, 0, 1, 1);
        this.posts.push(m);
        this.flames.push(m);
      }
      if (hash01(seed, 77) < 0.35) {
        this.place(seg, seg.startS + 1.5, 0, 0, 0, 1, 1);
        this.arches.push(m);
      }
    }
    for (let i = 0; i < 4; i++) {
      const r = hash01(seed, 500 + i);
      const side = i % 2 === 0 ? -1 : 1;
      const s = seg.startS + (seg.length * (i + r)) / 4;
      this.place(seg, s, side * (14 + r * 16), -14 - r * 6, r * 6, 1 + r, 1 + r);
      this.trees.push(m);
    }
  }

  private buildCorner(seg: Segment): void {
    const half = CORNER_SIZE / 2;
    const h = seg.heading;
    const outer = rightOf(h) === seg.exitHeading ? -1 : 1;
    // Statue on the outside corner, facing the runner as they approach.
    const cx = seg.originX + DIR_X[h]! * (CORNER_SIZE + 1.2);
    const cz = seg.originZ + DIR_Z[h]! * (CORNER_SIZE + 1.2);
    const r = rightOf(h);
    p.set(cx + DIR_X[r]! * outer * (half + 1.2), 0, cz + DIR_Z[r]! * outer * (half + 1.2));
    q.setFromAxisAngle(up, headingYaw(h) + Math.PI);
    sc.set(1.3, 1.3, 1.3);
    m.compose(p, q, sc);
    this.statues.push(m);
    p.set(seg.originX + DIR_X[h]! * half, 0, seg.originZ + DIR_Z[h]! * half);
    q.setFromAxisAngle(up, headingYaw(h));
    sc.set(1, 1, 1);
    m.compose(p, q, sc);
    this.piers.push(m);
  }

  /** Composes `m` at (s, x, y) in a straight segment's frame, rotated by `yaw`. */
  private place(
    seg: Segment,
    s: number,
    x: number,
    y: number,
    yaw: number,
    sxz: number,
    sy: number,
  ): void {
    const h = seg.heading;
    const r = rightOf(h);
    const ls = s - seg.startS;
    p.set(
      seg.originX + DIR_X[h]! * ls + DIR_X[r]! * x,
      y,
      seg.originZ + DIR_Z[h]! * ls + DIR_Z[r]! * x,
    );
    q.setFromAxisAngle(up, headingYaw(h) + yaw);
    sc.set(sxz, sy, sxz);
    m.compose(p, q, sc);
  }
}

/** Flames sway and pulse in the vertex shader, so torches animate at zero CPU cost. */
function addFlicker(material: THREE.Material, time: { value: number }): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3;
        float k = max(0.0, transformed.y - 1.8);
        transformed.y = 1.8 + k * (0.85 + 0.25 * sin(uTime * 13.0 + ph));
        transformed.x += k * 0.25 * sin(uTime * 7.0 + ph * 2.0);
      #endif`,
    );
  };
  material.customProgramCacheKey = () => 'flicker';
}
