import * as THREE from 'three';

const tmpMatrix = new THREE.Matrix4();
const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpColor = new THREE.Color();

export interface PartTransform {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

/**
 * Returns a non-indexed copy of `geo`, transformed and painted with a flat vertex color.
 * Used at load time to bake many primitives into one merged, single-draw-call geometry.
 */
export function part(
  geo: THREE.BufferGeometry,
  color: number,
  t: PartTransform = {},
): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  tmpEuler.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0);
  tmpQuat.setFromEuler(tmpEuler);
  tmpPos.set(t.x ?? 0, t.y ?? 0, t.z ?? 0);
  tmpScale.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
  tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
  g.applyMatrix4(tmpMatrix);
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  tmpColor.setHex(color);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Merges parts produced by `part()` (non-indexed, position + normal + color) into one geometry. */
export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  for (const g of parts) total += g.getAttribute('position').count;
  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let offset = 0;
  for (const g of parts) {
    const gp = g.getAttribute('position') as THREE.BufferAttribute;
    const gc = g.getAttribute('color') as THREE.BufferAttribute;
    pos.set(gp.array as Float32Array, offset * 3);
    col.set(gc.array as Float32Array, offset * 3);
    offset += gp.count;
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

/** Deterministic hash → [0, 1) for decoration variety without touching the sim RNG. */
export function hash01(a: number, b = 0): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
