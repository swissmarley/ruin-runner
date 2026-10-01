import * as THREE from 'three';
import { hash01 } from '../Geometry';
import { FERN_U0, FERN_U1, LEAF_U0, LEAF_U1, STEM_U } from './LeafTexture';

/** Accumulates quads into flat arrays (position, normal, uv, sway). Load-time only. */
class Builder {
  readonly pos: number[] = [];
  readonly nrm: number[] = [];
  readonly uv: number[] = [];
  readonly sway: number[] = [];
  readonly index: number[] = [];

  vertex(p: THREE.Vector3, n: THREE.Vector3, u: number, v: number, s: number): number {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    this.sway.push(s);
    return this.pos.length / 3 - 1;
  }

  /** A curved ribbon: `centers` along its length, `side` vectors give half-width offsets. */
  ribbon(
    centers: THREE.Vector3[],
    sides: THREE.Vector3[],
    normals: THREE.Vector3[],
    u0: number,
    u1: number,
    sway: (t: number) => number,
  ): void {
    const base = this.pos.length / 3;
    const tmp = new THREE.Vector3();
    const n = centers.length;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      this.vertex(tmp.copy(centers[i]!).sub(sides[i]!), normals[i]!, u0, t, sway(t));
      this.vertex(tmp.copy(centers[i]!).add(sides[i]!), normals[i]!, u1, t, sway(t));
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2;
      this.index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('sway', new THREE.Float32BufferAttribute(this.sway, 1));
    g.setIndex(this.index);
    g.computeBoundingSphere();
    return g;
  }
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * An arching frond: leaves the base at `rise` radians above horizontal and droops to `fall`
 * at the tip. Normals lean toward +Y so foliage lights softly instead of flipping.
 */
function frond(
  b: Builder,
  yaw: number,
  length: number,
  width: number,
  rise: number,
  fall: number,
  u0: number,
  u1: number,
  segments = 6,
): void {
  const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(width / 2);
  const centers: THREE.Vector3[] = [];
  const sides: THREE.Vector3[] = [];
  const normals: THREE.Vector3[] = [];
  const p = new THREE.Vector3();
  const step = length / segments;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    centers.push(p.clone());
    const taper = i === segments ? 0.6 : 1;
    sides.push(side.clone().multiplyScalar(taper));
    const a = rise + (fall - rise) * t;
    const tangent = new THREE.Vector3()
      .copy(dir)
      .multiplyScalar(Math.cos(a))
      .addScaledVector(UP, Math.sin(a));
    const n = new THREE.Vector3().crossVectors(side, tangent).normalize();
    if (n.y < 0) n.negate();
    normals.push(n.lerp(UP, 0.5).normalize());
    p.addScaledVector(tangent, step);
  }
  b.ribbon(centers, sides, normals, u0, u1, (t) => t);
}

/** A fern tuft of 8 arching fronds (~1 m across at scale 1). */
export function fernTuft(seed: number): THREE.BufferGeometry {
  const b = new Builder();
  const n = 8;
  for (let i = 0; i < n; i++) {
    const yaw = (i / n) * Math.PI * 2 + hash01(seed, i) * 0.5;
    const len = 0.8 + hash01(seed, i + 20) * 0.5;
    frond(b, yaw, len, 0.42, 1.25 + hash01(seed, i + 40) * 0.3, -0.35, FERN_U0, FERN_U1);
  }
  return b.build();
}

/** A clump of broad tropical leaves (elephant-ear style), ~1.6 m across at scale 1. */
export function broadleafBush(seed: number): THREE.BufferGeometry {
  const b = new Builder();
  const n = 7;
  for (let i = 0; i < n; i++) {
    const yaw = (i / n) * Math.PI * 2 + hash01(seed, i) * 0.6;
    const len = 0.75 + hash01(seed, i + 10) * 0.35;
    frond(b, yaw, len, 0.48, 0.9 + hash01(seed, i + 30) * 0.4, -0.5, LEAF_U0, LEAF_U1, 4);
  }
  return b.build();
}

/**
 * A hanging vine `length` meters long (top at y = 0), wiggling gently outward (+Z), with
 * alternating leaves. `sway` grows with depth so the tip moves most.
 */
export function hangingVine(seed: number, length: number): THREE.BufferGeometry {
  const b = new Builder();
  const segs = 10;
  const centers: THREE.Vector3[] = [];
  const sides: THREE.Vector3[] = [];
  const normals: THREE.Vector3[] = [];
  const stemSide = new THREE.Vector3(0.012, 0, 0);
  const out = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    centers.push(
      new THREE.Vector3(Math.sin(t * 5 + seed) * 0.08, -t * length, Math.sin(t * 2.2) * 0.25),
    );
    sides.push(stemSide);
    normals.push(out);
  }
  b.ribbon(centers, sides, normals, STEM_U - 0.004, STEM_U + 0.004, (t) => t);
  const leaves = Math.floor(length / 0.2);
  for (let i = 1; i < leaves; i++) {
    const t = i / leaves;
    const c = centers[Math.min(segs, Math.round(t * segs))]!.clone();
    c.y = -t * length;
    const yaw = (i % 2 === 0 ? 0.9 : -0.9) + (hash01(seed, i) - 0.5) * 1.2;
    const size = 0.16 + hash01(seed, i + 50) * 0.08;
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(size * 0.4);
    const tip = c
      .clone()
      .addScaledVector(dir, size * 0.8)
      .add(new THREE.Vector3(0, -size * 0.55, 0));
    const n = dir.clone().lerp(UP, 0.6).normalize();
    b.ribbon([c, tip], [side, side], [n, n], LEAF_U0, LEAF_U1, () => t);
  }
  return b.build();
}

export interface FoliageUniforms {
  [name: string]: { value: unknown };
  uTime: { value: number };
}

/** Alpha-tested, double-sided foliage material with vertex-shader wind sway. */
export function createFoliageMaterial(
  map: THREE.Texture,
  uniforms: FoliageUniforms,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      `uniform float uTime;\nattribute float sway;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.29;
      #else
        float ph = 0.0;
      #endif
      float gust = 0.6 + 0.4 * sin(uTime * 0.7 + ph * 0.3);
      transformed.x += sway * gust * 0.07 * sin(uTime * 2.1 + ph);
      transformed.z += sway * gust * 0.05 * sin(uTime * 1.7 + ph * 1.3);
      transformed.y += sway * 0.03 * sin(uTime * 2.6 + ph * 0.7);`,
      );
    // Keep thin leaves from dissolving at a distance: alpha-tested mips lose coverage, so
    // boost alpha with the mip level. Then let sunlight glow through the thin leaves.
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
      vec2 lodDx = dFdx(vMapUv * 512.0);
      vec2 lodDy = dFdy(vMapUv * 256.0);
      float lod = 0.5 * log2(max(dot(lodDx, lodDx), dot(lodDy, lodDy)));
      diffuseColor.a *= 1.0 + max(lod, 0.0) * 0.35;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.12;',
      );
  };
  mat.customProgramCacheKey = () => 'foliage';
  return mat;
}
