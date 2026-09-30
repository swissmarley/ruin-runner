import * as THREE from 'three';
import type { SegmentPool } from '../world/SegmentPool';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * An InstancedMesh whose instances are allocated per segment slot from a free list.
 * Freed indices are reused LIFO, and `mesh.count` is the high-water mark, so the GPU only
 * processes roughly the peak number of *live* instances (not the worst-case reservation).
 * Rebuilding a slot never allocates JS memory.
 */
export class SlotInstances {
  readonly mesh: THREE.InstancedMesh;
  private readonly capacity: number;
  private readonly free: Int32Array;
  private freeTop = 0;
  private highWater = 0;
  private readonly owned: Int32Array;
  private readonly ownedCount: Int32Array;
  private slot = 0;
  private dirty = false;

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    readonly slots: number,
    readonly perSlot: number,
    withColor: boolean,
  ) {
    this.capacity = slots * perSlot;
    this.mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (withColor) {
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(this.capacity * 3),
        3,
      );
      this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.free = new Int32Array(this.capacity);
    this.owned = new Int32Array(this.capacity);
    this.ownedCount = new Int32Array(slots);
  }

  /** Frees the slot's previous instances and starts collecting new ones for it. */
  begin(slot: number): void {
    this.release(slot);
    this.slot = slot;
  }

  /** Adds an instance to the current slot. Returns its index (or -1 if full). */
  push(matrix: THREE.Matrix4, color?: THREE.Color): number {
    const n = this.ownedCount[this.slot]!;
    if (n >= this.perSlot) return -1;
    let index: number;
    if (this.freeTop > 0) index = this.free[--this.freeTop]!;
    else if (this.highWater < this.capacity) index = this.highWater++;
    else return -1;
    this.owned[this.slot * this.perSlot + n] = index;
    this.ownedCount[this.slot] = n + 1;
    this.mesh.setMatrixAt(index, matrix);
    if (color && this.mesh.instanceColor) this.mesh.setColorAt(index, color);
    this.dirty = true;
    return index;
  }

  /** Moves an existing instance (e.g. a magnet-pulled coin). */
  set(index: number, matrix: THREE.Matrix4): void {
    this.mesh.setMatrixAt(index, matrix);
    this.dirty = true;
  }

  /** Hides one instance without freeing it (it is reclaimed when its slot is rebuilt). */
  hide(index: number): void {
    if (index < 0) return;
    this.mesh.setMatrixAt(index, ZERO);
    this.dirty = true;
  }

  commit(): void {
    this.flush();
  }

  clearSlot(slot: number): void {
    this.release(slot);
    this.flush();
  }

  /** Frees instances of slots the pool no longer uses (segments recycled behind the runner). */
  releaseInactive(pool: SegmentPool, builtIds: Int32Array): void {
    for (let slot = 0; slot < this.slots; slot++) {
      if (this.ownedCount[slot]! > 0 && !pool.isSlotActive(slot)) {
        this.release(slot);
        builtIds[slot] = -1;
      }
    }
    this.flush();
  }

  /** Uploads pending changes (only the live range). */
  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.mesh.count = this.highWater;
    const im = this.mesh.instanceMatrix;
    im.clearUpdateRanges();
    im.addUpdateRange(0, this.highWater * 16);
    im.needsUpdate = true;
    const ic = this.mesh.instanceColor;
    if (ic) {
      ic.clearUpdateRanges();
      ic.addUpdateRange(0, this.highWater * 3);
      ic.needsUpdate = true;
    }
  }

  private release(slot: number): void {
    const n = this.ownedCount[slot]!;
    for (let i = 0; i < n; i++) {
      const index = this.owned[slot * this.perSlot + i]!;
      this.mesh.setMatrixAt(index, ZERO);
      this.free[this.freeTop++] = index;
    }
    if (n > 0) this.dirty = true;
    this.ownedCount[slot] = 0;
  }
}
