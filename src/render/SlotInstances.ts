import * as THREE from 'three';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * An InstancedMesh partitioned into fixed per-segment-slot ranges. Rebuilding a slot
 * rewrites only its range (unused instances collapse to zero scale), so recycling a
 * segment never allocates and uploads only the changed bytes.
 */
export class SlotInstances {
  readonly mesh: THREE.InstancedMesh;
  private cursor = 0;
  private start = 0;
  private end = 0;

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    readonly slots: number,
    readonly perSlot: number,
    withColor: boolean,
  ) {
    const total = slots * perSlot;
    this.mesh = new THREE.InstancedMesh(geometry, material, total);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < total; i++) this.mesh.setMatrixAt(i, ZERO);
    if (withColor) {
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);
      this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
  }

  begin(slot: number): void {
    this.start = slot * this.perSlot;
    this.cursor = this.start;
    this.end = this.start + this.perSlot;
  }

  /** Appends an instance to the current slot; silently drops overflow. */
  push(matrix: THREE.Matrix4, color?: THREE.Color): void {
    if (this.cursor >= this.end) return;
    this.mesh.setMatrixAt(this.cursor, matrix);
    if (color && this.mesh.instanceColor) this.mesh.setColorAt(this.cursor, color);
    this.cursor++;
  }

  /** Hides a single instance of the current slot range by absolute index. */
  hide(index: number): void {
    this.mesh.setMatrixAt(index, ZERO);
    this.mark(index, 1);
  }

  /** Index the next `push` will write to (use to remember per-object instances). */
  get nextIndex(): number {
    return this.cursor;
  }

  commit(): void {
    for (let i = this.cursor; i < this.end; i++) this.mesh.setMatrixAt(i, ZERO);
    this.mark(this.start, this.perSlot);
  }

  /** Clears a slot entirely. */
  clearSlot(slot: number): void {
    this.begin(slot);
    this.commit();
  }

  mark(first: number, count: number): void {
    this.mesh.instanceMatrix.addUpdateRange(first * 16, count * 16);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.addUpdateRange(first * 3, count * 3);
      this.mesh.instanceColor.needsUpdate = true;
    }
  }
}
