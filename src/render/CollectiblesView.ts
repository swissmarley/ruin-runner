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
import { SlotInstances } from './SlotInstances';

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
  private readonly coins: SlotInstances;
  /** Instance index of coin k in slot s at [s × MAX_COINS + k] (-1 = not drawn). */
  private readonly coinIndex: Int32Array;
  private readonly pickups: Record<PowerUpKind, THREE.InstancedMesh>;
  private readonly builtIds: Int32Array;
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
    this.coins = new SlotInstances(coinGeometry(), coinMat, slots, MAX_COINS, false);
    this.group.add(this.coins.mesh);
    this.coinIndex = new Int32Array(slots * MAX_COINS).fill(-1);
    const orbMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.pickups = {
      magnet: this.instanced(magnetGeometry(), orbMat, slots * MAX_PICKUPS),
      shield: this.instanced(shieldGeometry(), orbMat, slots * MAX_PICKUPS),
      surge: this.instanced(surgeGeometry(), orbMat, slots * MAX_PICKUPS),
    };
    this.builtIds = new Int32Array(slots).fill(-1);
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
    this.coinIndex.fill(-1);
    for (let i = 0; i < this.slots; i++) this.coins.clearSlot(i);
  }

  update(dt: number, sim: Simulation, onCollect: CoinBurst): void {
    this.time.value += dt;
    this.coins.releaseInactive(sim.pool, this.builtIds);
    for (let i = 0; i < sim.pool.count; i++) {
      const seg = sim.pool.at(i);
      if (this.builtIds[seg.slot] !== seg.id) {
        this.builtIds[seg.slot] = seg.id;
        this.buildCoins(sim, seg);
      }
      if (seg.endS < sim.s - 5 || seg.startS > sim.s + 40) continue;
      this.syncCoins(sim, seg, onCollect);
    }
    this.coins.flush();
    this.updatePickups(sim);
  }

  private buildCoins(sim: Simulation, seg: Segment): void {
    const base = seg.slot * MAX_COINS;
    this.coins.begin(seg.slot);
    for (let k = 0; k < MAX_COINS; k++) {
      this.coinIndex[base + k] = k < seg.coinCount ? this.placeCoin(sim, seg, k, -1) : -1;
    }
    this.coins.commit();
  }

  /** Positions coin k; pushes a new instance when `index` is -1. Returns the index. */
  private placeCoin(sim: Simulation, seg: Segment, k: number, index: number): number {
    const c = seg.coins[k]!;
    if (c.collected || !worldAt(sim.pool, c.s, c.x, wp)) return -1;
    p.set(wp.x, c.y, wp.z);
    q.setFromAxisAngle(up, headingYaw(wp.heading));
    m.compose(p, q, one);
    if (index < 0) return this.coins.push(m);
    this.coins.set(index, m);
    return index;
  }

  /** Hides collected coins and moves magnet-attracted ones. */
  private syncCoins(sim: Simulation, seg: Segment, onCollect: CoinBurst): void {
    const base = seg.slot * MAX_COINS;
    for (let k = 0; k < seg.coinCount; k++) {
      const index = this.coinIndex[base + k]!;
      if (index < 0) continue;
      const c = seg.coins[k]!;
      if (c.collected) {
        this.coinIndex[base + k] = -1;
        this.coins.hide(index);
        if (worldAt(sim.pool, c.s, c.x, wp)) onCollect(wp.x, c.y, wp.z);
      } else if (c.attracted) {
        this.placeCoin(sim, seg, k, index);
      }
    }
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
