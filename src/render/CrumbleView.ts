import * as THREE from 'three';
import { CRUMBLE_GAP_LENGTH, TRACK_HALF_WIDTH } from '../config';
import type { Simulation } from '../sim/Simulation';
import { DIR_X, DIR_Z, headingYaw } from '../world/Heading';
import type { Segment } from '../world/Segment';
import type { Materials } from './Materials';
import { plank } from './ObstacleMeshes';

const PLANKS = 4;
/** Distance before the crumbling section at which it visibly gives way. */
export const CRUMBLE_TRIGGER_DISTANCE = 16;
const GRAVITY = 14;

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const p = new THREE.Vector3();
const sc = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * The crumbling bridge section: planks drawn over the (simulation) gap until the runner gets
 * close, then they tumble into the chasm so the jump must be timed on sight.
 */
export class CrumbleView {
  readonly mesh: THREE.InstancedMesh;
  private segId = -1;
  private seg: Segment | null = null;
  private triggered = false;
  private t = 0;

  constructor(materials: Materials) {
    this.mesh = new THREE.InstancedMesh(plank(), materials.vertexColored, PLANKS);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.hideAll();
  }

  reset(): void {
    this.segId = -1;
    this.seg = null;
    this.triggered = false;
    this.hideAll();
  }

  /** Returns true on the frame the section starts collapsing (for audio/effects). */
  update(dt: number, sim: Simulation): boolean {
    const seg = this.findBridge(sim);
    if (seg && seg.id !== this.segId) {
      this.segId = seg.id;
      this.seg = seg;
      this.triggered = false;
      this.t = 0;
    }
    if (!this.seg) return false;
    let started = false;
    if (!this.triggered && sim.s >= this.seg.crumbleS - CRUMBLE_TRIGGER_DISTANCE) {
      this.triggered = true;
      started = true;
    }
    if (this.triggered) this.t += dt;
    this.layout(this.seg);
    return started;
  }

  private findBridge(sim: Simulation): Segment | null {
    for (let i = 0; i < sim.pool.count; i++) {
      const seg = sim.pool.at(i);
      if (seg.kind === 'bridge' && seg.crumbleS + CRUMBLE_GAP_LENGTH > sim.s - 30) return seg;
    }
    return null;
  }

  private layout(seg: Segment): void {
    const h = seg.heading;
    const step = CRUMBLE_GAP_LENGTH / PLANKS;
    for (let i = 0; i < PLANKS; i++) {
      const delay = i * 0.07;
      const ft = this.triggered ? Math.max(0, this.t - delay) : 0;
      if (ft > 2.5) {
        this.mesh.setMatrixAt(i, ZERO);
        continue;
      }
      const ls = seg.crumbleS + step * (i + 0.5) - seg.startS;
      p.set(
        seg.originX + DIR_X[h]! * ls,
        -0.15 - 0.5 * GRAVITY * ft * ft,
        seg.originZ + DIR_Z[h]! * ls,
      );
      e.set(ft * (i % 2 ? 2.2 : -1.8), headingYaw(h), ft * (i % 2 ? -0.9 : 1.1));
      q.setFromEuler(e);
      sc.set(TRACK_HALF_WIDTH * 2 - 0.4, 1, step - 0.12);
      m.compose(p, q, sc);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private hideAll(): void {
    for (let i = 0; i < PLANKS; i++) this.mesh.setMatrixAt(i, ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
