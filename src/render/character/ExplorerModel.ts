import * as THREE from 'three';
import {
  foot,
  forearm,
  head,
  HIP_HEIGHT,
  Kit,
  pelvis,
  scarfTail,
  shin,
  SHIN,
  thigh,
  THIGH,
  torso,
  upperArm,
  UPPER_ARM,
} from './ExplorerParts';

export { HIP_HEIGHT };

/** Every animated joint of the explorer rig. Rotations are applied by `PlayerView`. */
export interface ExplorerRig {
  root: THREE.Group;
  body: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  head: THREE.Group;
  scarf1: THREE.Group;
  scarf2: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  thighL: THREE.Group;
  thighR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  ankleL: THREE.Group;
  ankleR: THREE.Group;
}

function joint(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  geo?: THREE.BufferGeometry,
  mat?: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (geo && mat) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    g.add(mesh);
  }
  parent.add(g);
  return g;
}

/** Builds the explorer: smooth-shaded, jointed rig (13 draw calls), facing −Z. */
export function buildExplorer(material: THREE.Material): ExplorerRig {
  const k = new Kit();
  const root = new THREE.Group();
  const body = joint(root, 0, 0, 0);
  const hips = joint(body, 0, HIP_HEIGHT, 0, pelvis(k), material);
  const spine = joint(hips, 0, 0.08, 0, torso(k), material);
  const headJ = joint(spine, 0, 0.53, -0.01, head(k), material);
  const scarf1 = joint(spine, 0.02, 0.45, 0.08, scarfTail(0.2, 0.075), material);
  const scarf2 = joint(scarf1, 0, 0, 0.19, scarfTail(0.18, 0.06), material);
  const upper = upperArm(k);
  const fore = forearm(k);
  const shoulderL = joint(spine, -0.205, 0.405, 0, upper, material);
  const shoulderR = joint(spine, 0.205, 0.405, 0, upper, material);
  const elbowL = joint(shoulderL, 0, -UPPER_ARM, 0, fore, material);
  const elbowR = joint(shoulderR, 0, -UPPER_ARM, 0, fore, material);
  const th = thigh(k);
  const sh = shin(k);
  const ft = foot();
  const thighL = joint(hips, -0.1, -0.03, 0, th, material);
  const thighR = joint(hips, 0.1, -0.03, 0, th, material);
  const kneeL = joint(thighL, 0, -THIGH, 0, sh, material);
  const kneeR = joint(thighR, 0, -THIGH, 0, sh, material);
  const ankleL = joint(kneeL, 0, -SHIN, 0, ft, material);
  const ankleR = joint(kneeR, 0, -SHIN, 0, ft, material);
  // Mirror the right side so pockets and thumbs sit on the outside.
  for (const g of [shoulderR, thighR]) g.children[0]!.scale.x = -1;
  (elbowR.children[0] as THREE.Mesh).scale.x = -1;
  k.dispose();
  return {
    root,
    body,
    hips,
    spine,
    head: headJ,
    scarf1,
    scarf2,
    shoulderL,
    shoulderR,
    elbowL,
    elbowR,
    thighL,
    thighR,
    kneeL,
    kneeR,
    ankleL,
    ankleR,
  };
}
