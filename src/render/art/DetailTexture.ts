import * as THREE from 'three';

const SIZE = 256;

/** Tileable value-noise lattice (period `period` cells) with a fixed integer seed. */
function lattice(ix: number, iy: number, period: number, seed: number): number {
  const x = ((ix % period) + period) % period;
  const y = ((iy % period) + period) % period;
  let h = Math.imul(x * 374761393 + y * 668265263 + seed * 2246822519, 3266489917);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return ((h >>> 0) & 0xffff) / 0xffff;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Tileable 2-D value noise in [0, 1]; u, v in [0, 1). */
function valueNoise(u: number, v: number, period: number, seed: number): number {
  const x = u * period;
  const y = v * period;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = lattice(ix, iy, period, seed);
  const b = lattice(ix + 1, iy, period, seed);
  const c = lattice(ix, iy + 1, period, seed);
  const d = lattice(ix + 1, iy + 1, period, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm(u: number, v: number, base: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let period = base;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(u, v, period, seed + o * 31) * amp;
    norm += amp;
    amp *= 0.5;
    period *= 2;
  }
  return sum / norm;
}

/** Tileable Worley noise: F2 − F1 (small along cell borders → crack network). */
function worleyEdge(u: number, v: number, cells: number, seed: number): number {
  const x = u * cells;
  const y = v * cells;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let f1 = 9;
  let f2 = 9;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx;
      const cy = iy + dy;
      const px = cx + lattice(cx, cy, cells, seed);
      const py = cy + lattice(cx, cy, cells, seed + 7);
      const d = Math.hypot(px - x, py - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return Math.min(1, (f2 - f1) * 1.4);
}

/**
 * One tileable RGBA data texture shared by every procedural surface:
 * R = broad fbm (tint / macro variation), G = fine fbm (grain),
 * B = Worley cell edges (cracks, rune veins), A = blotchy fbm (moss / lichen patches).
 * Generated once at startup (~15 ms); sampled tri-planar in world or object space.
 */
export function createDetailTexture(): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    const v = y / SIZE;
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const i = (y * SIZE + x) * 4;
      const warp = valueNoise(u, v, 4, 99) * 0.08;
      data[i] = fbm(u + warp, v, 4, 5, 1) * 255;
      data[i + 1] = fbm(u, v + warp, 16, 3, 2) * 255;
      data[i + 2] = worleyEdge(u + warp * 0.5, v + warp * 0.5, 10, 3) * 255;
      data[i + 3] = fbm(u, v, 6, 4, 4) * 255;
    }
  }
  const tex = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}
