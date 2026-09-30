import * as THREE from 'three';
import type { PowerUpKind } from '../entities/PowerUp';
import { POWERUP_KINDS } from '../entities/PowerUp';
import type { Simulation } from '../sim/Simulation';
import { headingYaw } from '../world/Heading';
import type { Segment } from '../world/Segment';
import { MAX_COINS, MAX_PICKUPS } from '../world/Segment';
import { WorldPoint, worldAt } from '../world/Track';
import {
  addInstanceSpin,
  coinGeometry,
  magnetGeometry,
  shieldGeometry,
  surgeGeometry,
} from './CollectibleMeshes';
import { PALETTE } from './Materials';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const p = new THREE.Vector3();
const one = new THREE.Vector3(1, 1, 1);
const up = new THREE.Vector3(0, 1, 0);
const wp = new WorldPoint();

/** Fires for each coin that becomes visible-collected this frame (for sparkle effects). */
export type CoinBurst = (x: number, y: number, z: number) => void;

/**
 * Relic coins (one instanced mesh, spun on the GPU) and power-up orbs (one instanced mesh
 * per kind, bobbing). Coin instance index = slot × MAX_COINS + coin index.
 */
export class CollectiblesView {
  readonly group = new THREE.Group();
  readonly time = { value: 0 };
  private readonly coins: THREE.InstancedMesh;
  private readonly pickups: Record<PowerUpKind, THREE.InstancedMesh>;
  private readonly builtIds: Int32Array;
  private readonly coinShown: Uint8Array;
  private readonly slots: number;

  constructor(slots: number) {
    this.slots = slots;
    const coinMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
      emissive: PALETTE.goldDark,
      emissiveIntensity: 0.35,
    });
    addInstanceSpin(coinMat, this.time, 3.2);
    this.coins = this.instanced(coinGeometry(), coinMat, slots * MAX_COINS);
    const orbMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.pickups = {
      magnet: this.instanced(magnetGeometry(), orbMat, slots * MAX_PICKUPS),
      shield: this.instanced(shieldGeometry(), orbMat, slots * MAX_PICKUPS),
      surge: this.instanced(surgeGeometry(), orbMat, slots * MAX_PICKUPS),
    };
    this.builtIds = new Int32Array(slots).fill(-1);
    this.coinShown = new Uint8Array(slots * MAX_COINS);
  }

  private instanced(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    n: number,
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, ZERO);
    this.group.add(mesh);
    return mesh;
  }

  invalidate(): void {
    this.builtIds.fill(-1);
    this.coinShown.fill(0);
    for (let i = 0; i < this.slots * MAX_COINS; i++) this.coins.setMatrixAt(i, ZERO);
    this.coins.instanceMatrix.needsUpdate = true;
  }

  update(dt: number, sim: Simulation, onCollect: CoinBurst): void {
    this.time.value += dt;
    let dirty = false;
    for (let i = 0; i < sim.pool.count; i++) {
      const seg = sim.pool.at(i);
      if (this.builtIds[seg.slot] !== seg.id) {
        this.builtIds[seg.slot] = seg.id;
        this.buildCoins(sim, seg);
        dirty = true;
      }
      if (seg.endS < sim.s - 5 || seg.startS > sim.s + 40) continue;
      if (this.syncCoins(sim, seg, onCollect)) dirty = true;
    }
    if (dirty) this.coins.instanceMatrix.needsUpdate = true;
    this.updatePickups(sim);
  }

  private buildCoins(sim: Simulation, seg: Segment): void {
    const base = seg.slot * MAX_COINS;
    for (let k = 0; k < MAX_COINS; k++) {
      if (k < seg.coinCount && this.placeCoin(sim, seg, k)) this.coinShown[base + k] = 1;
      else {
        this.coins.setMatrixAt(base + k, ZERO);
        this.coinShown[base + k] = 0;
      }
    }
  }

  private placeCoin(sim: Simulation, seg: Segment, k: number): boolean {
    const c = seg.coins[k]!;
    if (c.collected || !worldAt(sim.pool, c.s, c.x, wp)) return false;
    p.set(wp.x, c.y, wp.z);
    q.setFromAxisAngle(up, headingYaw(wp.heading));
    m.compose(p, q, one);
    this.coins.setMatrixAt(seg.slot * MAX_COINS + k, m);
    return true;
  }

  /** Hides collected coins and moves magnet-attracted ones. Returns true if anything changed. */
  private syncCoins(sim: Simulation, seg: Segment, onCollect: CoinBurst): boolean {
    const base = seg.slot * MAX_COINS;
    let changed = false;
    for (let k = 0; k < seg.coinCount; k++) {
      const c = seg.coins[k]!;
      if (!this.coinShown[base + k]) continue;
      if (c.collected) {
        this.coinShown[base + k] = 0;
        this.coins.setMatrixAt(base + k, ZERO);
        if (worldAt(sim.pool, c.s, c.x, wp)) onCollect(wp.x, c.y, wp.z);
        changed = true;
      } else if (c.attracted) {
        this.placeCoin(sim, seg, k);
        changed = true;
      }
    }
    return changed;
  }

  private updatePickups(sim: Simulation): void {
    const t = this.time.value;
    for (let kind = 0; kind < POWERUP_KINDS.length; kind++) {
      const mesh = this.pickups[POWERUP_KINDS[kind]!];
      let n = 0;
      for (let i = 0; i < sim.pool.count; i++) {
        const seg = sim.pool.at(i);
        for (let k = 0; k < seg.pickupCount; k++) {
          const u = seg.pickups[k]!;
          if (u.kind !== POWERUP_KINDS[kind] || u.collected) continue;
          if (!worldAt(sim.pool, u.s, u.x, wp)) continue;
          p.set(wp.x, u.y + Math.sin(t * 3 + u.s) * 0.15, wp.z);
          q.setFromAxisAngle(up, t * 2 + u.s);
          m.compose(p, q, one);
          mesh.setMatrixAt(n++, m);
        }
      }
      for (let i = n; i < mesh.count; i++) mesh.setMatrixAt(i, ZERO);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
