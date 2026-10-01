import * as THREE from 'three';
import { BEAM_BOTTOM, BEAM_TOP, LOW_BARRIER_HEIGHT, PILLAR_HEIGHT } from '../config';
import { cap, flutedShaft, snapTop } from './art/Shapes';
import { displace, lathe, mergeParts, part, rock, roundedBox, SURF } from './Geometry';
import { PALETTE } from './Materials';

const P = PALETTE;

/**
 * Unit geometries for obstacles, authored for one lane (~1.6 m wide) at the origin.
 * Multi-lane obstacles are built from several units or a stretched unit.
 */
export function rubbleBarrier(): THREE.BufferGeometry {
  const h = LOW_BARRIER_HEIGHT;
  // Fallen, weathered building blocks with a toppled log resting on top.
  const block = displace(roundedBox(1, 1, 1, 0.12, 2), 0.025, 3, 61);
  const chip = rock(52, 1, 0.18, 7);
  const log = new THREE.CylinderGeometry(0.13, 0.14, 1.85, 14);
  const ring = new THREE.CircleGeometry(0.13, 14);
  const g = mergeParts([
    part(block, P.stone, {
      x: -0.5,
      y: 0.22,
      rz: 0.06,
      ry: 0.2,
      sx: 0.62,
      sy: 0.44,
      sz: 0.46,
      m: SURF.masonry,
    }),
    part(block, P.stoneDark, {
      x: 0.12,
      y: 0.2,
      ry: -0.15,
      sx: 0.55,
      sy: 0.4,
      sz: 0.5,
      m: SURF.masonry,
    }),
    part(block, P.stone, {
      x: 0.62,
      y: 0.17,
      rz: -0.25,
      ry: 0.4,
      sx: 0.42,
      sy: 0.36,
      sz: 0.4,
      m: SURF.masonry,
    }),
    part(chip, P.stoneDark, { x: -0.15, y: 0.07, z: -0.32, sx: 0.16, sy: 0.09, sz: 0.13 }),
    part(chip, P.stone, { x: 0.35, y: 0.06, z: 0.33, ry: 2, sx: 0.13, sy: 0.08, sz: 0.11 }),
    part(chip, P.stone, { x: -0.72, y: 0.05, z: 0.28, ry: 1, sx: 0.1, sy: 0.06, sz: 0.1 }),
    part(log, 0x8a6a48, { y: h - 0.14, rz: Math.PI / 2 + 0.04, m: SURF.bark }),
    part(ring, 0xc9a77a, { x: 0.925, y: h - 0.1, ry: Math.PI / 2, m: SURF.wood }),
    part(ring, 0xc9a77a, { x: -0.925, y: h - 0.18, ry: -Math.PI / 2, m: SURF.wood }),
  ]);
  for (const geo of [block, chip, log, ring]) geo.dispose();
  return g;
}

/** Carved lintel block spanning 1 unit of width; stretched along X per obstacle. */
export function beamBlock(): THREE.BufferGeometry {
  const height = BEAM_TOP - BEAM_BOTTOM;
  const mid = BEAM_BOTTOM + height / 2;
  return mergeParts([
    part(roundedBox(1, height - 0.1, 0.56, 0.08), P.stone, { y: mid + 0.05, m: SURF.masonry }),
    part(roundedBox(1.02, 0.2, 0.64, 0.06), P.stoneDark, { y: BEAM_BOTTOM + 0.1, m: SURF.masonry }),
    part(roundedBox(1.03, 0.14, 0.62, 0.05), P.stoneLight, { y: BEAM_TOP - 0.07, m: SURF.masonry }),
    part(roundedBox(1.0, 0.06, 0.04, 0.02), P.goldDark, { y: mid + 0.12, z: -0.3, m: SURF.gold }),
    part(roundedBox(1.0, 0.06, 0.04, 0.02), P.goldDark, { y: mid + 0.12, z: 0.3, m: SURF.gold }),
  ]);
}

/** Slim fluted post at each end of a beam. */
export function beamPost(): THREE.BufferGeometry {
  const shaft = flutedShaft(0.17, 0.15, BEAM_BOTTOM - 0.15, 8);
  const g = mergeParts([
    part(roundedBox(0.44, 0.15, 0.5, 0.04), P.stoneDark, { y: 0.075, m: SURF.masonry }),
    part(shaft, P.stone, { y: 0.15 }),
  ]);
  shaft.dispose();
  return g;
}

/** A broken standing pillar stump blocking one lane. */
export function pillarStump(): THREE.BufferGeometry {
  const H = PILLAR_HEIGHT;
  const r = 0.55;
  const shaft = snapTop(flutedShaft(r * 1.04, r, H - 0.45, 12), H - 0.45, 0.4, 13);
  const torus = new THREE.TorusGeometry(r * 1.03, r * 0.14, 8, 28);
  const chunk = rock(9, 2, 0.2, 3);
  const g = mergeParts([
    part(roundedBox(1.55, 0.3, 1.35, 0.06), P.stoneDark, { y: 0.15, m: SURF.masonry }),
    part(torus, P.stone, { y: 0.38, rx: Math.PI / 2 }),
    part(shaft, P.stone, { y: 0.4, m: SURF.drum }),
    part(chunk, P.stoneLight, { y: H - 0.32, sx: r * 0.95, sy: 0.2, sz: r * 0.95 }),
    part(chunk, P.stone, { x: -0.62, y: 0.38, z: 0.4, sx: 0.2, sy: 0.12, sz: 0.18 }),
  ]);
  for (const geo of [shaft, torus, chunk]) geo.dispose();
  return g;
}

/** A fallen column lying across the path; authored 1 m long along X, stretched per obstacle. */
export function fallenColumn(): THREE.BufferGeometry {
  const r = PILLAR_HEIGHT / 2;
  const drum = flutedShaft(r, r, 0.315, 16);
  const end = cap(r * 0.94, 0, 28);
  const collar = lathe([r * 0.9, 0, r * 1.04, 0.02, r * 1.04, 0.06, r * 0.9, 0.08], 28);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    parts.push(part(drum, P.stone, { x: -0.5 + i * 0.3425, y: r, rz: -Math.PI / 2 }));
  }
  parts.push(
    part(end, P.stoneLight, { x: 0.5, y: r, rz: -Math.PI / 2 }),
    part(end, P.stoneLight, { x: -0.5, y: r, rz: Math.PI / 2 }),
    part(collar, P.stoneDark, { x: -0.04, y: r, rz: -Math.PI / 2 }),
  );
  for (const geo of [drum, end, collar]) geo.dispose();
  return mergeParts(parts);
}

/** A single bridge plank (used for the crumbling section). */
export function plank(): THREE.BufferGeometry {
  return mergeParts([part(roundedBox(1, 0.3, 1, 0.05), P.wood, { m: SURF.wood })]);
}
