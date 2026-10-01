import * as THREE from 'three';
import { cap, flameGeometry, flutedShaft, snapTop } from './art/Shapes';
import { displace, lathe, mergeParts, part, rock, roundedBox, SURF } from './Geometry';
import { PALETTE } from './Materials';

/** How far below the walkway the sunken ruins reach (hidden by depth fog long before). */
export const DEPTH = 26;

const P = PALETTE;

/** Flared capital with an abacus slab at height y. */
function capital(r: number, y: number): THREE.BufferGeometry[] {
  const echinus = lathe([r * 0.95, 0, r * 1.05, 0.12, r * 1.3, 0.3, r * 1.42, 0.36, 0, 0.36], 20);
  const ring = new THREE.TorusGeometry(r * 0.98, r * 0.08, 5, 20);
  const out = [
    part(ring, P.stone, { y: y - 0.05, rx: Math.PI / 2 }),
    part(echinus, P.stoneLight, { y }),
    part(roundedBox(r * 3.1, 0.34, r * 3.1, 0.05), P.stoneLight, { y: y + 0.52, m: SURF.masonry }),
  ];
  echinus.dispose();
  ring.dispose();
  return out;
}

/** A tall fluted column rising out of the depths with a carved capital. */
export function sunkenColumn(): THREE.BufferGeometry {
  const r = 0.58;
  const top = 4.2;
  const shaft = flutedShaft(r * 1.06, r, top + DEPTH, 11);
  const g = mergeParts([part(shaft, P.stone, { y: -DEPTH, m: SURF.drum }), ...capital(r, top)]);
  shaft.dispose();
  return g;
}

/** A column snapped off at a jagged height, rubble lodged in the break. */
export function brokenColumn(): THREE.BufferGeometry {
  const r = 0.58;
  const top = 1.7;
  const shaft = snapTop(flutedShaft(r * 1.06, r, top + DEPTH, 11), top + DEPTH, 0.55, 5);
  const chunk = rock(7, 1, 0.2, 3);
  const g = mergeParts([
    part(shaft, P.stone, { y: -DEPTH, m: SURF.drum }),
    part(chunk, P.stoneLight, { y: top - 0.3, sx: r * 0.95, sy: 0.22, sz: r * 0.95 }),
    part(chunk, P.stone, { x: 0.15, y: top - 0.05, ry: 1.3, sx: 0.28, sy: 0.22, sz: 0.24 }),
  ]);
  shaft.dispose();
  chunk.dispose();
  return g;
}

/** Stout tapered masonry pier under the walkway, reaching into the mist. */
export function supportPier(): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(1.2, 1.6, DEPTH, 4, 1);
  body.rotateY(Math.PI / 4);
  const g = mergeParts([
    part(body, P.stoneDark, { y: -DEPTH / 2 - 0.9, sx: 1.25, sz: 0.85, m: SURF.masonry }),
    part(roundedBox(3.6, 0.6, 2.4, 0.08), P.stone, { y: -1.2, m: SURF.masonry }),
    part(roundedBox(3.2, 0.4, 2.1, 0.06), P.stoneDark, { y: -1.7, m: SURF.masonry }),
  ]);
  body.dispose();
  return g;
}

/** Torch post clamped to the curb: wooden pole, iron bands and bracket, cloth-wrapped bowl. */
export function torchPost(): THREE.BufferGeometry {
  const pole = new THREE.CylinderGeometry(0.06, 0.08, 1.75, 10);
  const bowl = lathe([0.05, -0.12, 0.16, -0.06, 0.22, 0.06, 0.2, 0.08, 0.12, 0.0, 0.0, 0.02], 16);
  const band = new THREE.TorusGeometry(0.075, 0.018, 6, 16);
  const coals = rock(3, 1, 0.3, 0);
  const g = mergeParts([
    part(pole, P.wood, { y: 0.875, m: SURF.wood }),
    part(band, P.iron, { y: 0.4, rx: Math.PI / 2, m: SURF.iron }),
    part(band, P.iron, { y: 1.3, rx: Math.PI / 2, m: SURF.iron }),
    part(bowl, P.iron, { y: 1.82, m: SURF.iron }),
    part(coals, 0x2a1a10, { y: 1.86, sx: 0.15, sy: 0.07, sz: 0.15, m: SURF.wood }),
  ]);
  pole.dispose();
  bowl.dispose();
  band.dispose();
  coals.dispose();
  return g;
}

export function torchFlame(): THREE.BufferGeometry {
  return flameGeometry(0.17, 0.62, 1.86);
}

/** Gateway arch: twin masonry pylons and a stepped lintel with a carved gold sun disc. */
export function gatewayArch(width: number): THREE.BufferGeometry {
  const half = width / 2;
  const h = 4.6;
  const disc = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24);
  const ring = new THREE.TorusGeometry(0.5, 0.06, 6, 24);
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const x = side * half;
    parts.push(
      part(roundedBox(1.2, h + DEPTH, 1.2, 0.08), P.stone, {
        x,
        y: (h - DEPTH) / 2,
        m: SURF.masonry,
      }),
      part(roundedBox(1.5, 0.5, 1.5, 0.08), P.stoneDark, { x, y: 0.25, m: SURF.masonry }),
      part(roundedBox(1.45, 0.3, 1.45, 0.06), P.stoneLight, { x, y: h - 0.1, m: SURF.masonry }),
    );
  }
  parts.push(
    part(roundedBox(width + 2.2, 0.75, 1.4, 0.1), P.stoneLight, { y: h + 0.4, m: SURF.masonry }),
    part(roundedBox(width + 1.2, 0.45, 1.15, 0.08), P.stone, { y: h + 1.0, m: SURF.masonry }),
    part(roundedBox(width * 0.45, 0.45, 0.95, 0.08), P.stoneDark, { y: h + 1.45, m: SURF.masonry }),
    part(roundedBox(width + 2.0, 0.12, 0.08, 0.03), P.goldDark, {
      y: h + 0.15,
      z: -0.72,
      m: SURF.gold,
    }),
    part(disc, P.gold, { y: h + 0.45, z: -0.72, rx: Math.PI / 2, m: SURF.gold }),
    part(ring, P.goldDark, { y: h + 0.45, z: -0.74, m: SURF.gold }),
  );
  disc.dispose();
  ring.dispose();
  return mergeParts(parts);
}

/** Jungle giant far below the walkway: buttressed trunk and a lumpy, layered canopy. */
export function canopyTree(): THREE.BufferGeometry {
  const trunk = lathe([1.3, -10, 0.75, -8, 0.5, -4, 0.42, 0, 0.32, 3], 10);
  const blob = displace(new THREE.IcosahedronGeometry(1, 1), 0.22, 1.3, 9);
  const blob2 = displace(new THREE.IcosahedronGeometry(1, 1), 0.25, 1.5, 17);
  const g = mergeParts([
    part(trunk, 0x5a4632, { m: SURF.bark }),
    part(blob, P.foliage, { y: 3.4, sx: 3.6, sy: 2.0, sz: 3.4, m: SURF.leaf }),
    part(blob2, P.foliageLight, {
      x: 1.6,
      y: 4.4,
      z: 0.6,
      sx: 2.4,
      sy: 1.6,
      sz: 2.4,
      m: SURF.leaf,
    }),
    part(blob, 0x4f7a34, { x: -1.4, y: 4.6, z: -0.8, sx: 2.2, sy: 1.5, sz: 2.3, m: SURF.leaf }),
    part(blob2, P.foliage, { x: 0.2, y: 5.6, z: -0.2, sx: 1.8, sy: 1.3, sz: 1.8, m: SURF.leaf }),
  ]);
  trunk.dispose();
  blob.dispose();
  blob2.dispose();
  return g;
}

/** Colossal guardian head on a stepped plinth, watching the outside of corners. */
export function cornerStatue(): THREE.BufferGeometry {
  const head = displace(roundedBox(1.5, 1.7, 1.4, 0.45, 3), 0.05, 2.2, 31);
  const eye = new THREE.SphereGeometry(1, 14, 10);
  const spool = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 18);
  const z = -0.7;
  const g = mergeParts([
    part(roundedBox(2.4, 0.5, 2.4, 0.08), P.stoneDark, { y: 0.25, m: SURF.masonry }),
    part(roundedBox(2.0, 0.5, 2.0, 0.08), P.stone, { y: 0.75, m: SURF.masonry }),
    part(head, P.stone, { y: 1.95 }),
    part(roundedBox(1.25, 0.18, 0.3, 0.08), P.stoneDark, { y: 2.32, z: z + 0.05 }),
    part(eye, 0x2a2620, { x: -0.32, y: 2.12, z: z + 0.02, sx: 0.18, sy: 0.1, sz: 0.06 }),
    part(eye, 0x2a2620, { x: 0.32, y: 2.12, z: z + 0.02, sx: 0.18, sy: 0.1, sz: 0.06 }),
    part(roundedBox(0.34, 0.42, 0.26, 0.1), P.stone, { y: 1.86, z: z - 0.05 }),
    part(roundedBox(0.62, 0.14, 0.2, 0.06), P.stoneDark, { y: 1.5, z: z + 0.02 }),
    part(spool, P.gold, { x: -0.78, y: 2.0, rz: Math.PI / 2, m: SURF.gold }),
    part(spool, P.gold, { x: 0.78, y: 2.0, rz: Math.PI / 2, m: SURF.gold }),
    part(roundedBox(1.7, 0.4, 1.55, 0.12), P.stoneLight, { y: 2.95, m: SURF.masonry }),
    part(cap(0.34, 0, 24), P.gold, { y: 2.95, z: -0.79, rx: -Math.PI / 2, m: SURF.gold }),
  ]);
  head.dispose();
  eye.dispose();
  spool.dispose();
  return g;
}
