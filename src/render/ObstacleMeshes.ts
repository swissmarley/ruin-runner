import * as THREE from 'three';
import { BEAM_BOTTOM, BEAM_TOP, LOW_BARRIER_HEIGHT, PILLAR_HEIGHT } from '../config';
import { mergeParts, part } from './Geometry';
import { PALETTE } from './Materials';

/**
 * Unit geometries for obstacles, authored for one lane (~1.6 m wide) at the origin.
 * Multi-lane obstacles are built from several units or a stretched unit.
 */
export function rubbleBarrier(): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const rock = new THREE.DodecahedronGeometry(1, 0);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 7);
  const h = LOW_BARRIER_HEIGHT;
  const g = mergeParts([
    part(cyl, PALETTE.wood, { y: h * 0.62, rz: Math.PI / 2, sx: 0.24, sy: 1.8, sz: 0.24 }),
    part(rock, PALETTE.stoneDark, { x: -0.55, y: 0.2, sx: 0.32, sy: 0.24, sz: 0.3 }),
    part(rock, PALETTE.stone, { x: 0.1, y: 0.22, sx: 0.36, sy: 0.26, sz: 0.28, ry: 0.7 }),
    part(rock, PALETTE.stoneLight, { x: 0.62, y: 0.18, sx: 0.26, sy: 0.2, sz: 0.3, rx: 0.4 }),
    part(box, PALETTE.mossDark, { x: -0.2, y: h * 0.62 + 0.2, sx: 0.5, sy: 0.08, sz: 0.3 }),
    part(box, PALETTE.wood, { x: 0.7, y: 0.4, rz: 0.4, sx: 0.12, sy: 0.7, sz: 0.12 }),
    part(box, PALETTE.wood, { x: -0.7, y: 0.4, rz: -0.4, sx: 0.12, sy: 0.7, sz: 0.12 }),
  ]);
  box.dispose();
  rock.dispose();
  cyl.dispose();
  return g;
}

/** Carved lintel block spanning 1 unit of width; stretched along X per obstacle. */
export function beamBlock(): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const height = BEAM_TOP - BEAM_BOTTOM;
  const g = mergeParts([
    part(box, PALETTE.stoneDark, { y: BEAM_BOTTOM + height / 2, sx: 1, sy: height, sz: 0.55 }),
    part(box, PALETTE.stone, { y: BEAM_BOTTOM + 0.12, sx: 1.02, sy: 0.24, sz: 0.62 }),
    part(box, PALETTE.stoneLight, { y: BEAM_TOP - 0.1, sx: 1.04, sy: 0.2, sz: 0.62 }),
    part(box, PALETTE.moss, { y: BEAM_TOP + 0.04, sx: 0.9, sy: 0.1, sz: 0.5 }),
  ]);
  box.dispose();
  return g;
}

/** Thin support post placed at each end of a beam. */
export function beamPost(): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const g = mergeParts([
    part(box, PALETTE.stone, { y: BEAM_BOTTOM / 2, sx: 0.28, sy: BEAM_BOTTOM, sz: 0.4 }),
  ]);
  box.dispose();
  return g;
}

/** A broken standing pillar stump blocking one lane. */
export function pillarStump(): THREE.BufferGeometry {
  const cyl = new THREE.CylinderGeometry(1, 1.08, 1, 8);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const H = PILLAR_HEIGHT;
  const g = mergeParts([
    part(box, PALETTE.stoneDark, { y: 0.15, sx: 1.6, sy: 0.3, sz: 1.3 }),
    part(cyl, PALETTE.stone, { y: 0.3 + (H - 0.3) / 2, sx: 0.62, sy: H - 0.3, sz: 0.62 }),
    part(cyl, PALETTE.stoneLight, { y: H - 0.05, sx: 0.64, sy: 0.12, sz: 0.64, rx: 0.12 }),
    part(box, PALETTE.moss, { x: 0.3, y: H * 0.55, sx: 0.12, sy: 0.9, sz: 0.3 }),
  ]);
  cyl.dispose();
  box.dispose();
  return g;
}

/** A fallen column lying across the path; authored 1 m long along X, stretched per obstacle. */
export function fallenColumn(): THREE.BufferGeometry {
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 9);
  const r = PILLAR_HEIGHT / 2;
  const g = mergeParts([
    part(cyl, PALETTE.stone, { y: r, rz: Math.PI / 2, sx: r, sy: 1, sz: r }),
    part(cyl, PALETTE.stoneDark, { y: r, rz: Math.PI / 2, sx: r * 1.02, sy: 0.12, sz: r * 1.02 }),
    part(cyl, PALETTE.moss, { y: r * 1.95, sx: 0.5 * r, sy: 0.08, sz: 0.3 * r }),
  ]);
  cyl.dispose();
  return g;
}

/** A single bridge plank (used for the crumbling section). */
export function plank(): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const g = mergeParts([part(box, PALETTE.wood, { sx: 1, sy: 0.3, sz: 1 })]);
  box.dispose();
  return g;
}
