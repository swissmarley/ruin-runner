import * as THREE from 'three';
import { hash01 } from '../Geometry';

/**
 * A fluted column shaft (open cylinder with `flutes` concave grooves), from y = 0 to `height`.
 * Smooth normals; pair with the `drum` surface for stacked-drum joints.
 */
export function flutedShaft(
  rBottom: number,
  rTop: number,
  height: number,
  flutes = 12,
  heightSegments = 1,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBottom, height, flutes * 4, heightSegments, true);
  g.translate(0, height / 2, 0);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 - 0.07 * Math.pow(0.5 + 0.5 * Math.cos(a * flutes), 2);
    pos.setXYZ(i, x * k, pos.getY(i), z * k);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/**
 * Jagged break: pushes the top ring of a shaft down by random amounts so a snapped column
 * has an irregular, chipped top. Works on geometries built by `flutedShaft` with segments.
 */
export function snapTop(
  geo: THREE.BufferGeometry,
  topY: number,
  depth: number,
  seed: number,
): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < topY - 1e-3) continue;
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    const n = hash01(seed, Math.floor((a + Math.PI) * 2.2)) * 0.7 + 0.3 * Math.sin(a * 3 + seed);
    pos.setY(i, topY - depth * Math.abs(n));
  }
  geo.computeVertexNormals();
  return geo;
}

/** Disc capping a shaft at height y (radius r), facing up. */
export function cap(r: number, y: number, segments = 24): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(r, segments);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** Flame: nested cones whose vertex colors run white-hot core → orange → deep red tips. */
export function flameGeometry(radius: number, height: number, baseY: number): THREE.BufferGeometry {
  const layers = [
    { r: radius, h: height, hot: 0.0 },
    { r: radius * 0.62, h: height * 0.72, hot: 0.55 },
    { r: radius * 0.32, h: height * 0.45, hot: 1.0 },
  ];
  const parts: THREE.BufferGeometry[] = [];
  const outer = new THREE.Color(0xc2300c);
  const mid = new THREE.Color(0xff8a1c);
  const core = new THREE.Color(0xfff2b0);
  const c = new THREE.Color();
  for (const l of layers) {
    const g = new THREE.ConeGeometry(l.r, l.h, 10, 3, true).toNonIndexed();
    g.translate(0, baseY + l.h / 2, 0);
    const pos = g.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) - baseY) / l.h;
      c.copy(mid).lerp(outer, t * (1 - l.hot));
      c.lerp(core, l.hot * (1 - t * 0.6));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    parts.push(g);
  }
  let total = 0;
  for (const g of parts) total += g.getAttribute('position').count;
  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    const n = g.getAttribute('position').count;
    pos.set(g.getAttribute('position').array as Float32Array, o * 3);
    col.set(g.getAttribute('color').array as Float32Array, o * 3);
    o += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
