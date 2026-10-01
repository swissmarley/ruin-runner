import * as THREE from 'three';
import { mergeParts, part, rock, SURF } from '../Geometry';

const STONE = 0x7d8072;
const STONE_DARK = 0x5b5e52;
const STONE_WARM = 0x8f826c;
const EMBER = 0xff8a2a;

/** One shared boulder shape per seed, re-used (scaled/rotated) across the body. */
function boulders(): THREE.BufferGeometry[] {
  return [rock(11, 2, 0.24), rock(23, 2, 0.3), rock(37, 1, 0.22), rock(41, 2, 0.2)];
}

function torso(r: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const [a, b, c, d] = r as [
    THREE.BufferGeometry,
    THREE.BufferGeometry,
    THREE.BufferGeometry,
    THREE.BufferGeometry,
  ];
  const rune = SURF.runestone;
  return mergeParts([
    // Hunched chest and back plates (the camera mostly sees the back).
    part(a, STONE, { y: 1.95, sx: 0.85, sy: 0.72, sz: 0.62, m: rune }),
    part(b, STONE_DARK, { y: 2.2, z: 0.32, rx: 0.3, sx: 0.7, sy: 0.5, sz: 0.35, m: rune }),
    part(d, STONE_WARM, { x: -0.38, y: 1.75, z: 0.35, sx: 0.4, sy: 0.38, sz: 0.3, m: rune }),
    part(c, STONE, { x: 0.4, y: 1.8, z: 0.33, sx: 0.38, sy: 0.4, sz: 0.28, m: rune }),
    part(b, STONE_DARK, { y: 1.35, sx: 0.62, sy: 0.38, sz: 0.48 }),
    // Spine ridge of jagged stones along the back.
    part(c, STONE_DARK, { y: 2.55, z: 0.28, rx: 0.6, sx: 0.16, sy: 0.24, sz: 0.14 }),
    part(c, STONE_DARK, { y: 2.3, z: 0.5, rx: 0.9, sx: 0.14, sy: 0.22, sz: 0.12 }),
    part(c, STONE_DARK, { y: 2.0, z: 0.58, rx: 1.2, sx: 0.12, sy: 0.18, sz: 0.1 }),
    // Massive shoulder boulders (moss collects on top in the shader).
    part(a, STONE_WARM, { x: -0.92, y: 2.42, sx: 0.5, sy: 0.44, sz: 0.48, ry: 1 }),
    part(d, STONE_WARM, { x: 0.92, y: 2.42, sx: 0.5, sy: 0.44, sz: 0.48, ry: 2 }),
    // Head sunk low between the shoulders, with a heavy brow and ember eyes.
    part(b, STONE, { y: 2.72, z: -0.28, sx: 0.36, sy: 0.32, sz: 0.36 }),
    part(c, STONE_DARK, { y: 2.84, z: -0.5, sx: 0.34, sy: 0.1, sz: 0.14 }),
    part(new THREE.SphereGeometry(1, 10, 8), EMBER, {
      x: -0.12,
      y: 2.74,
      z: -0.6,
      sx: 0.07,
      sy: 0.04,
      sz: 0.04,
      m: SURF.glow,
    }),
    part(new THREE.SphereGeometry(1, 10, 8), EMBER, {
      x: 0.12,
      y: 2.74,
      z: -0.6,
      sx: 0.07,
      sy: 0.04,
      sz: 0.04,
      m: SURF.glow,
    }),
    // Ember core glowing through the cracks of the back.
    part(new THREE.SphereGeometry(1, 12, 10), EMBER, {
      y: 2.05,
      z: 0.3,
      sx: 0.3,
      sy: 0.3,
      sz: 0.2,
      m: SURF.glow,
    }),
  ]);
}

function upperArm(r: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeParts([
    part(r[1]!, STONE, { y: -0.45, sx: 0.3, sy: 0.55, sz: 0.3, m: SURF.runestone }),
  ]);
}

function forearm(r: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeParts([
    part(r[3]!, STONE_DARK, { y: -0.4, sx: 0.28, sy: 0.48, sz: 0.28 }),
    part(r[0]!, STONE_WARM, { y: -0.95, sx: 0.4, sy: 0.36, sz: 0.42, ry: 0.7, m: SURF.runestone }),
  ]);
}

function leg(r: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeParts([
    part(r[2]!, STONE, { y: -0.4, sx: 0.34, sy: 0.5, sz: 0.34 }),
    part(r[0]!, STONE_DARK, { y: -1.0, z: -0.12, sx: 0.36, sy: 0.2, sz: 0.5 }),
  ]);
}

export interface WardenRig {
  body: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
}

function limb(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  g.add(mesh);
  parent.add(g);
  return g;
}

/** Builds the Stone Warden facing −Z (6 draw calls). */
export function buildWarden(material: THREE.Material): WardenRig {
  const r = boulders();
  const body = new THREE.Group();
  const torsoMesh = new THREE.Mesh(torso(r), material);
  torsoMesh.castShadow = true;
  body.add(torsoMesh);
  const ua = upperArm(r);
  const fa = forearm(r);
  const lg = leg(r);
  const armL = limb(body, ua, material, -1.0, 2.35);
  const armR = limb(body, ua, material, 1.0, 2.35);
  const elbowL = limb(armL, fa, material, 0, -0.95);
  const elbowR = limb(armR, fa, material, 0, -0.95);
  const legL = limb(body, lg, material, -0.42, 1.15);
  const legR = limb(body, lg, material, 0.42, 1.15);
  for (const g of r) g.dispose();
  return { body, armL, armR, elbowL, elbowR, legL, legR };
}
