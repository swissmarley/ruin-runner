import * as THREE from 'three';
import { lathe, mergeParts, part, roundedBox, SURF } from '../Geometry';

/** Explorer palette (sRGB). The builders below each merge one bone's parts at load time. */
const C = {
  jacket: 0x2e7168,
  jacketDark: 0x1f4f48,
  shirt: 0xd9c8a0,
  skin: 0xc58a5e,
  hair: 0x2b1a10,
  hat: 0x7a5934,
  hatBand: 0x2a1c12,
  scarf: 0xd4522a,
  pack: 0x7a5530,
  packDark: 0x5a3c20,
  bedroll: 0x8e3b2c,
  pants: 0x6b6448,
  pantsDark: 0x575038,
  boot: 0x3e2819,
  sole: 0x1e140d,
  belt: 0x3a2616,
  brass: 0xd6a548,
  eye: 0x1a120c,
} as const;

/** Joint heights (meters): the rig stands ~1.85 m to the top of the hat. */
export const HIP_HEIGHT = 0.96;
export const THIGH = 0.45;
export const SHIN = 0.42;
export const UPPER_ARM = 0.27;
export const FOREARM = 0.25;

/** Shared primitives, disposed after the merged meshes are built. */
export class Kit {
  readonly sphere = new THREE.SphereGeometry(1, 18, 14);
  readonly cyl = new THREE.CylinderGeometry(1, 1, 1, 16);
  readonly torus = new THREE.TorusGeometry(1, 0.25, 10, 24);
  capsule(r: number, len: number): THREE.CapsuleGeometry {
    return new THREE.CapsuleGeometry(r, len, 5, 14);
  }
  dispose(): void {
    this.sphere.dispose();
    this.cyl.dispose();
    this.torus.dispose();
  }
}

export function pelvis(k: Kit): THREE.BufferGeometry {
  const canteen = new THREE.CylinderGeometry(0.06, 0.06, 0.035, 14);
  const g = mergeParts([
    part(k.sphere, C.pants, { y: -0.02, sx: 0.175, sy: 0.14, sz: 0.125, m: SURF.cloth }),
    part(k.torus, C.belt, {
      y: 0.05,
      rx: Math.PI / 2,
      sx: 0.158,
      sy: 0.12,
      sz: 0.09,
      m: SURF.leather,
    }),
    part(roundedBox(0.06, 0.05, 0.02, 0.008), C.brass, { y: 0.05, z: -0.122, m: SURF.gold }),
    part(roundedBox(0.08, 0.1, 0.05, 0.02), C.packDark, {
      x: 0.15,
      y: -0.01,
      z: 0.03,
      ry: 0.4,
      m: SURF.leather,
    }),
    part(canteen, 0x6b6a5a, {
      x: -0.17,
      y: -0.04,
      z: 0.04,
      rz: Math.PI / 2,
      ry: -0.3,
      m: SURF.iron,
    }),
    // Jacket hem flaring over the hips.
    part(lathe([0.17, -0.02, 0.162, 0.07, 0.152, 0.16], 18), C.jacket, { sz: 0.78, m: SURF.cloth }),
  ]);
  canteen.dispose();
  return g;
}

export function torso(k: Kit): THREE.BufferGeometry {
  const body = lathe(
    [
      0.0, -0.04, 0.16, -0.04, 0.165, 0.06, 0.182, 0.2, 0.2, 0.31, 0.195, 0.39, 0.155, 0.45, 0.08,
      0.485, 0.0, 0.49,
    ],
    20,
  );
  const strap = new THREE.TorusGeometry(0.13, 0.014, 6, 14, Math.PI * 1.15);
  const g = mergeParts([
    part(body, C.jacket, { sz: 0.7, m: SURF.cloth }),
    part(k.sphere, C.shirt, { y: 0.4, z: -0.1, sx: 0.07, sy: 0.07, sz: 0.04, m: SURF.cloth }),
    // Backpack with flap, buckles and a rolled bedroll on top.
    part(roundedBox(0.3, 0.34, 0.15, 0.05), C.pack, { y: 0.22, z: 0.19, m: SURF.leather }),
    part(roundedBox(0.31, 0.15, 0.165, 0.04), C.packDark, { y: 0.33, z: 0.195, m: SURF.leather }),
    part(roundedBox(0.2, 0.12, 0.05, 0.02), C.packDark, { y: 0.14, z: 0.275, m: SURF.leather }),
    part(roundedBox(0.03, 0.035, 0.01, 0.005), C.brass, {
      x: -0.07,
      y: 0.27,
      z: 0.28,
      m: SURF.gold,
    }),
    part(roundedBox(0.03, 0.035, 0.01, 0.005), C.brass, {
      x: 0.07,
      y: 0.27,
      z: 0.28,
      m: SURF.gold,
    }),
    part(k.cyl, C.bedroll, {
      y: 0.45,
      z: 0.19,
      rz: Math.PI / 2,
      sx: 0.065,
      sy: 0.38,
      sz: 0.065,
      m: SURF.cloth,
    }),
    part(k.torus, C.belt, {
      x: -0.11,
      y: 0.45,
      z: 0.19,
      ry: Math.PI / 2,
      sx: 0.068,
      sy: 0.068,
      sz: 0.05,
      m: SURF.leather,
    }),
    part(k.torus, C.belt, {
      x: 0.11,
      y: 0.45,
      z: 0.19,
      ry: Math.PI / 2,
      sx: 0.068,
      sy: 0.068,
      sz: 0.05,
      m: SURF.leather,
    }),
    part(strap, C.belt, { x: -0.11, y: 0.33, z: 0.04, ry: Math.PI / 2, rx: -0.2, m: SURF.leather }),
    part(strap, C.belt, { x: 0.11, y: 0.33, z: 0.04, ry: Math.PI / 2, rx: -0.2, m: SURF.leather }),
    // Scarf knotted around the neck.
    part(k.torus, C.scarf, {
      y: 0.47,
      rx: Math.PI / 2,
      sx: 0.085,
      sy: 0.075,
      sz: 0.11,
      m: SURF.cloth,
    }),
    part(k.sphere, C.scarf, { y: 0.44, z: 0.06, sx: 0.045, sy: 0.04, sz: 0.035, m: SURF.cloth }),
    part(k.cyl, C.skin, { y: 0.52, sx: 0.05, sy: 0.1, sz: 0.05, m: SURF.skin }),
  ]);
  body.dispose();
  strap.dispose();
  return g;
}

export function head(k: Kit): THREE.BufferGeometry {
  const hair = new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
  const crown = lathe([0.118, 0.0, 0.116, 0.06, 0.104, 0.105, 0.07, 0.125, 0.0, 0.118], 20);
  const brim = new THREE.CylinderGeometry(0.215, 0.215, 0.014, 28);
  const g = mergeParts([
    part(k.sphere, C.skin, { y: 0.12, sx: 0.1, sy: 0.115, sz: 0.108, m: SURF.skin }),
    part(k.sphere, C.skin, { y: 0.065, z: -0.03, sx: 0.078, sy: 0.06, sz: 0.08, m: SURF.skin }),
    part(k.sphere, C.skin, { y: 0.115, z: -0.108, sx: 0.022, sy: 0.03, sz: 0.025, m: SURF.skin }),
    part(k.sphere, C.skin, { x: -0.098, y: 0.115, sx: 0.016, sy: 0.03, sz: 0.022, m: SURF.skin }),
    part(k.sphere, C.skin, { x: 0.098, y: 0.115, sx: 0.016, sy: 0.03, sz: 0.022, m: SURF.skin }),
    part(k.sphere, C.eye, {
      x: -0.037,
      y: 0.142,
      z: -0.094,
      sx: 0.013,
      sy: 0.016,
      sz: 0.01,
      m: SURF.leather,
    }),
    part(k.sphere, C.eye, {
      x: 0.037,
      y: 0.142,
      z: -0.094,
      sx: 0.013,
      sy: 0.016,
      sz: 0.01,
      m: SURF.leather,
    }),
    part(roundedBox(0.035, 0.008, 0.01, 0.003), C.hair, {
      x: -0.037,
      y: 0.168,
      z: -0.098,
      m: SURF.cloth,
    }),
    part(roundedBox(0.035, 0.008, 0.01, 0.003), C.hair, {
      x: 0.037,
      y: 0.168,
      z: -0.098,
      m: SURF.cloth,
    }),
    part(hair, C.hair, {
      y: 0.13,
      z: 0.012,
      rx: 0.55,
      sx: 0.108,
      sy: 0.12,
      sz: 0.112,
      m: SURF.cloth,
    }),
    part(k.sphere, C.hair, { y: 0.07, z: 0.08, sx: 0.07, sy: 0.06, sz: 0.04, m: SURF.cloth }),
    // Wide-brimmed explorer hat, tilted slightly back.
    part(brim, C.hat, { y: 0.205, z: 0.005, rx: -0.08, sz: 1.08, m: SURF.leather }),
    part(k.torus, C.hat, {
      y: 0.212,
      z: 0.005,
      rx: Math.PI / 2 - 0.08,
      sx: 0.212,
      sy: 0.232,
      sz: 0.04,
      m: SURF.leather,
    }),
    part(crown, C.hat, { y: 0.21, rx: -0.08, sz: 1.06, m: SURF.leather }),
    part(k.cyl, C.hatBand, {
      y: 0.232,
      rx: -0.08,
      sx: 0.119,
      sy: 0.03,
      sz: 0.126,
      m: SURF.leather,
    }),
  ]);
  hair.dispose();
  crown.dispose();
  brim.dispose();
  return g;
}

export function upperArm(k: Kit): THREE.BufferGeometry {
  const cap = k.capsule(0.058, UPPER_ARM - 0.1);
  const g = mergeParts([
    part(k.sphere, C.jacket, { sx: 0.075, sy: 0.07, sz: 0.075, m: SURF.cloth }),
    part(cap, C.jacket, { y: -UPPER_ARM / 2, m: SURF.cloth }),
  ]);
  cap.dispose();
  return g;
}

export function forearm(k: Kit): THREE.BufferGeometry {
  const cap = k.capsule(0.046, FOREARM - 0.1);
  const g = mergeParts([
    part(k.torus, C.jacketDark, {
      y: -0.02,
      rx: Math.PI / 2,
      sx: 0.056,
      sy: 0.056,
      sz: 0.1,
      m: SURF.cloth,
    }),
    part(cap, C.skin, { y: -FOREARM / 2 + 0.01, m: SURF.skin }),
    part(k.cyl, C.belt, { y: -0.17, sx: 0.05, sy: 0.08, sz: 0.05, m: SURF.leather }),
    part(k.sphere, C.skin, {
      y: -FOREARM - 0.03,
      z: -0.01,
      sx: 0.042,
      sy: 0.058,
      sz: 0.05,
      m: SURF.skin,
    }),
    part(k.sphere, C.skin, {
      x: 0.03,
      y: -FOREARM - 0.01,
      z: -0.035,
      sx: 0.016,
      sy: 0.03,
      sz: 0.016,
      m: SURF.skin,
    }),
  ]);
  cap.dispose();
  return g;
}

export function thigh(k: Kit): THREE.BufferGeometry {
  const cap = k.capsule(0.092, THIGH - 0.13);
  const g = mergeParts([
    part(cap, C.pants, { y: -THIGH / 2 + 0.02, sz: 1.08, m: SURF.cloth }),
    part(roundedBox(0.04, 0.12, 0.1, 0.02), C.pantsDark, { x: 0.075, y: -0.2, m: SURF.cloth }),
  ]);
  cap.dispose();
  return g;
}

export function shin(k: Kit): THREE.BufferGeometry {
  const cap = k.capsule(0.07, SHIN - 0.1);
  const boot = new THREE.CylinderGeometry(0.08, 0.072, 0.22, 16);
  const g = mergeParts([
    part(cap, C.pants, { y: -0.14, m: SURF.cloth }),
    part(boot, C.boot, { y: -SHIN + 0.11, m: SURF.leather }),
    part(k.torus, C.boot, {
      y: -SHIN + 0.22,
      rx: Math.PI / 2,
      sx: 0.082,
      sy: 0.082,
      sz: 0.08,
      m: SURF.leather,
    }),
  ]);
  cap.dispose();
  boot.dispose();
  return g;
}

export function foot(): THREE.BufferGeometry {
  return mergeParts([
    part(roundedBox(0.11, 0.1, 0.24, 0.045), C.boot, { y: -0.01, z: -0.05, m: SURF.leather }),
    part(roundedBox(0.118, 0.03, 0.255, 0.012), C.sole, { y: -0.055, z: -0.05, m: SURF.leather }),
  ]);
}

export function scarfTail(length: number, width: number): THREE.BufferGeometry {
  return mergeParts([
    part(roundedBox(width, 0.018, length, 0.008), C.scarf, { z: length / 2, m: SURF.cloth }),
  ]);
}
