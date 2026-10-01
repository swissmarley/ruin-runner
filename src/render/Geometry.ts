import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SurfKind } from './art/Surface';
import { SURF } from './art/Surface';

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
  /** Surface kind for the procedural shader (default: plain stone). */
  m?: SurfKind;
  /** Recompute flat face normals (chiselled / faceted look). */
  facet?: boolean;
}

/**
 * Returns a non-indexed copy of `geo`, transformed, painted with a vertex color and tagged
 * with a surface kind. Used at load time to bake many primitives into one merged geometry.
 */
export function part(
  geo: THREE.BufferGeometry,
  color: number,
  t: PartTransform = {},
): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (g.getAttribute('uv')) g.deleteAttribute('uv');
  tmpEuler.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0);
  tmpQuat.setFromEuler(tmpEuler);
  tmpPos.set(t.x ?? 0, t.y ?? 0, t.z ?? 0);
  tmpScale.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
  tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
  g.applyMatrix4(tmpMatrix);
  if (t.facet || !g.getAttribute('normal')) g.computeVertexNormals();
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  tmpColor.setHex(color);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('surf', new THREE.BufferAttribute(new Float32Array(count).fill(t.m ?? 0), 1));
  return g;
}

/** Merges parts produced by `part()` into one geometry (position, normal, color, surf). */
export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  for (const g of parts) total += g.getAttribute('position').count;
  const pos = new Float32Array(total * 3);
  const nrm = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const srf = new Float32Array(total);
  let offset = 0;
  for (const g of parts) {
    const n = g.getAttribute('position').count;
    pos.set(g.getAttribute('position').array as Float32Array, offset * 3);
    nrm.set(g.getAttribute('normal').array as Float32Array, offset * 3);
    col.set(g.getAttribute('color').array as Float32Array, offset * 3);
    srf.set(g.getAttribute('surf').array as Float32Array, offset);
    offset += n;
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  merged.setAttribute('surf', new THREE.BufferAttribute(srf, 1));
  merged.computeBoundingSphere();
  return merged;
}

/** Tags a plain geometry (no vertex colors) with one surface kind, e.g. for instanced slabs. */
export function withSurf(geo: THREE.BufferGeometry, kind: SurfKind): THREE.BufferGeometry {
  const count = geo.getAttribute('position').count;
  geo.setAttribute('surf', new THREE.BufferAttribute(new Float32Array(count).fill(kind), 1));
  return geo;
}

/** Deterministic hash → [0, 1) for decoration variety without touching the sim RNG. */
export function hash01(a: number, b = 0): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 3-D value noise built on `hash01` (for load-time vertex displacement). */
function noise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const h = (a: number, b: number, c: number) =>
    hash01(Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791), seed);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return lerp(
    lerp(
      lerp(h(ix, iy, iz), h(ix + 1, iy, iz), ux),
      lerp(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), ux),
      uy,
    ),
    lerp(
      lerp(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), ux),
      lerp(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), ux),
      uy,
    ),
    uz,
  );
}

/**
 * Pushes every vertex along its normal by smooth noise (shared positions move together, so
 * seams stay closed). Gives chiselled stone and lumpy foliage an organic silhouette.
 */
export function displace(
  geo: THREE.BufferGeometry,
  amount: number,
  frequency: number,
  seed: number,
): THREE.BufferGeometry {
  // Weld by position only, so displacement cannot tear seams apart.
  const src = new THREE.BufferGeometry();
  src.setAttribute('position', geo.getAttribute('position').clone());
  if (geo.index) src.setIndex(geo.index.clone());
  const g = mergeVertices(src, 1e-4);
  src.dispose();
  g.computeVertexNormals();
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n =
      noise3(x * frequency, y * frequency, z * frequency, seed) * 0.7 +
      noise3(x * frequency * 2.3, y * frequency * 2.3, z * frequency * 2.3, seed + 1) * 0.3;
    const d = (n - 0.5) * 2 * amount;
    pos.setXYZ(i, x + nrm.getX(i) * d, y + nrm.getY(i) * d, z + nrm.getZ(i) * d);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A weathered boulder: subdivided icosahedron with noisy displacement, then sliced by a few
 * random planes so it reads as split, chiselled stone rather than a smooth blob.
 */
export function rock(seed: number, detail = 2, roughness = 0.28, cuts = 6): THREE.BufferGeometry {
  const ico = new THREE.IcosahedronGeometry(1, detail);
  const g = displace(ico, roughness, 1.6, seed);
  ico.dispose();
  const pos = g.getAttribute('position');
  const n = new THREE.Vector3();
  for (let k = 0; k < cuts; k++) {
    const u = hash01(seed, k * 3) * 2 - 1;
    const a = hash01(seed, k * 3 + 1) * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    n.set(r * Math.cos(a), u, r * Math.sin(a));
    const d = 0.62 + hash01(seed, k * 3 + 2) * 0.25;
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getX(i) * n.x + pos.getY(i) * n.y + pos.getZ(i) * n.z;
      if (t > d) {
        pos.setXYZ(
          i,
          pos.getX(i) - n.x * (t - d),
          pos.getY(i) - n.y * (t - d),
          pos.getZ(i) - n.z * (t - d),
        );
      }
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Box with rounded edges (radius in meters, before any part scaling). */
export function roundedBox(
  w: number,
  h: number,
  d: number,
  r: number,
  seg = 2,
): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));
}

/** Lathe from (radius, height) pairs. */
export function lathe(profile: readonly number[], segments = 16): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < profile.length; i += 2)
    pts.push(new THREE.Vector2(profile[i], profile[i + 1]));
  return new THREE.LatheGeometry(pts, segments);
}

export { SURF };
