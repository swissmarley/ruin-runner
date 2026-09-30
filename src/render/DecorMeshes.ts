import * as THREE from 'three';
import { mergeParts, part } from './Geometry';
import { PALETTE } from './Materials';

/** How far below the walkway the sunken ruins reach (hidden by fog long before). */
export const DEPTH = 26;

/** A tall column rising out of the depths with a carved capital and moss on top. */
export function sunkenColumn(): THREE.BufferGeometry {
  const shaft = new THREE.CylinderGeometry(0.55, 0.65, 1, 8);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const top = 4.2;
  const g = mergeParts([
    part(shaft, PALETTE.stone, { y: (top - DEPTH) / 2, sy: top + DEPTH }),
    part(shaft, PALETTE.stoneDark, { y: 0.6, sx: 1.08, sy: 0.25, sz: 1.08 }),
    part(box, PALETTE.stoneLight, { y: top + 0.18, sx: 1.5, sy: 0.36, sz: 1.5 }),
    part(box, PALETTE.stone, { y: top + 0.5, sx: 1.25, sy: 0.3, sz: 1.25 }),
    part(box, PALETTE.moss, { y: top + 0.7, sx: 1.1, sy: 0.12, sz: 1.0 }),
    part(box, PALETTE.vine, { x: 0.58, y: top - 1.2, sx: 0.08, sy: 2.4, sz: 0.3 }),
    part(box, PALETTE.vine, { z: -0.6, y: top - 0.8, sx: 0.3, sy: 1.6, sz: 0.08 }),
  ]);
  shaft.dispose();
  box.dispose();
  return g;
}

/** A column snapped off at a jagged height. */
export function brokenColumn(): THREE.BufferGeometry {
  const shaft = new THREE.CylinderGeometry(0.55, 0.65, 1, 8);
  const rock = new THREE.DodecahedronGeometry(1, 0);
  const top = 1.6;
  const g = mergeParts([
    part(shaft, PALETTE.stone, { y: (top - DEPTH) / 2, sy: top + DEPTH }),
    part(shaft, PALETTE.stoneLight, { y: top + 0.15, rz: 0.35, sy: 0.4, sx: 0.95, sz: 0.95 }),
    part(rock, PALETTE.moss, { y: top + 0.35, sx: 0.35, sy: 0.18, sz: 0.3 }),
    part(rock, PALETTE.stoneDark, { x: 0.3, y: top + 0.45, sx: 0.22, sy: 0.3, sz: 0.2 }),
  ]);
  shaft.dispose();
  rock.dispose();
  return g;
}

/** Stout pier under the walkway, reaching into the mist. */
export function supportPier(): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const g = mergeParts([
    part(box, PALETTE.stoneDark, { y: -DEPTH / 2 - 0.9, sx: 2.6, sy: DEPTH, sz: 1.8 }),
    part(box, PALETTE.stone, { y: -1.25, sx: 3.4, sy: 0.7, sz: 2.2 }),
    part(box, PALETTE.mossDark, { y: -1.7, x: 1.2, sx: 0.3, sy: 1.6, sz: 1.9 }),
  ]);
  box.dispose();
  return g;
}

/** Torch post clamped to the curb: pole, iron bowl (the flame is a separate mesh). */
export function torchPost(): THREE.BufferGeometry {
  const pole = new THREE.CylinderGeometry(0.07, 0.09, 1, 5);
  const bowl = new THREE.CylinderGeometry(0.22, 0.12, 0.2, 6);
  const g = mergeParts([
    part(pole, PALETTE.wood, { y: 0.85, sy: 1.7 }),
    part(bowl, 0x3a3128, { y: 1.75 }),
  ]);
  pole.dispose();
  bowl.dispose();
  return g;
}

export function torchFlame(): THREE.BufferGeometry {
  const cone = new THREE.ConeGeometry(0.17, 0.5, 5);
  const inner = new THREE.ConeGeometry(0.09, 0.3, 4);
  const g = mergeParts([
    part(cone, PALETTE.torchFlame, { y: 2.05 }),
    part(inner, 0xfff0a0, { y: 1.98 }),
  ]);
  cone.dispose();
  inner.dispose();
  return g;
}

/** Gateway arch spanning the path (lintel high above any jump). */
export function gatewayArch(width: number): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const half = width / 2;
  const g = mergeParts([
    part(box, PALETTE.stone, { x: -half, y: (4.6 - DEPTH) / 2, sx: 1.1, sy: 4.6 + DEPTH, sz: 1.1 }),
    part(box, PALETTE.stone, { x: half, y: (4.6 - DEPTH) / 2, sx: 1.1, sy: 4.6 + DEPTH, sz: 1.1 }),
    part(box, PALETTE.stoneLight, { y: 4.95, sx: width + 1.8, sy: 0.7, sz: 1.3 }),
    part(box, PALETTE.stoneDark, { y: 5.5, sx: width * 0.5, sy: 0.5, sz: 1.0 }),
    part(box, PALETTE.gold, { y: 4.95, z: -0.66, sx: 0.5, sy: 0.4, sz: 0.04 }),
    part(box, PALETTE.moss, { y: 5.36, sx: width + 1.2, sy: 0.12, sz: 1.2 }),
    part(box, PALETTE.vine, { x: -half + 1.2, y: 4.1, sx: 0.08, sy: 1.4, sz: 0.3 }),
    part(box, PALETTE.vine, { x: half - 1.6, y: 3.9, sx: 0.08, sy: 1.8, sz: 0.3 }),
  ]);
  box.dispose();
  return g;
}

/** Jungle canopy tree far below the walkway (reads as a silhouette through the fog). */
export function canopyTree(): THREE.BufferGeometry {
  const cone = new THREE.ConeGeometry(1, 1, 6);
  const trunk = new THREE.CylinderGeometry(0.3, 0.4, 1, 5);
  const g = mergeParts([
    part(trunk, PALETTE.wood, { y: -3, sy: 8 }),
    part(cone, PALETTE.foliage, { y: 2, sx: 3.2, sy: 4, sz: 3.2 }),
    part(cone, PALETTE.foliageLight, { y: 4.2, sx: 2.4, sy: 3.2, sz: 2.4 }),
    part(cone, PALETTE.foliage, { y: 6, sx: 1.5, sy: 2.4, sz: 1.5 }),
  ]);
  cone.dispose();
  trunk.dispose();
  return g;
}

/** Stone guardian statue at the outside of corners. */
export function cornerStatue(): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const g = mergeParts([
    part(box, PALETTE.stoneDark, { y: 0.5, sx: 1.6, sy: 1.0, sz: 1.6 }),
    part(box, PALETTE.stone, { y: 1.9, sx: 1.1, sy: 1.8, sz: 0.9 }),
    part(box, PALETTE.stone, { y: 3.2, sx: 0.8, sy: 0.8, sz: 0.8 }),
    part(box, PALETTE.gold, { y: 3.25, z: -0.41, sx: 0.5, sy: 0.12, sz: 0.04 }),
    part(box, PALETTE.moss, { y: 3.65, sx: 0.7, sy: 0.1, sz: 0.7 }),
    part(box, PALETTE.stoneLight, { x: -0.75, y: 2.2, sx: 0.35, sy: 1.2, sz: 0.4 }),
    part(box, PALETTE.stoneLight, { x: 0.75, y: 2.2, sx: 0.35, sy: 1.2, sz: 0.4 }),
  ]);
  box.dispose();
  return g;
}
