import * as THREE from 'three';
import type { Player } from '../entities/Player';
import { mergeParts, part } from './Geometry';
import type { Materials } from './Materials';

const JACKET = 0x2f7f86;
const SKIN = 0xd9a877;
const HAT = 0x7a5a36;
const SCARF = 0xe0662c;
const PACK = 0x8a6a3e;
const PANTS = 0x3b3f4f;
const BOOT = 0x3a2616;
const BELT = 0x4a3524;

function buildBody(): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 8);
  const parts = [
    part(box, JACKET, { y: 1.26, sx: 0.5, sy: 0.62, sz: 0.3 }),
    part(box, BELT, { y: 0.97, sx: 0.52, sy: 0.09, sz: 0.32 }),
    part(box, SKIN, { y: 1.76, sx: 0.32, sy: 0.34, sz: 0.3 }),
    part(box, 0x2a1d14, { y: 1.8, z: 0.06, sx: 0.34, sy: 0.3, sz: 0.24 }),
    part(cyl, HAT, { y: 1.93, sx: 0.36, sy: 0.035, sz: 0.36 }),
    part(cyl, HAT, { y: 2.02, sx: 0.2, sy: 0.16, sz: 0.2 }),
    part(box, SCARF, { y: 1.56, sx: 0.4, sy: 0.1, sz: 0.34 }),
    part(box, SCARF, { x: 0.1, y: 1.4, z: 0.19, rz: 0.2, sx: 0.1, sy: 0.3, sz: 0.04 }),
    part(box, PACK, { y: 1.28, z: 0.24, sx: 0.4, sy: 0.46, sz: 0.18 }),
    part(cyl, 0x9c3b2a, { y: 1.56, z: 0.24, rz: Math.PI / 2, sx: 0.09, sy: 0.44, sz: 0.09 }),
  ];
  const g = mergeParts(parts);
  box.dispose();
  cyl.dispose();
  return g;
}

function buildLimb(
  upper: number,
  lower: number,
  length: number,
  width: number,
): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const upperLen = length * 0.78;
  const g = mergeParts([
    part(box, upper, { y: -upperLen / 2, sx: width, sy: upperLen, sz: width }),
    part(box, lower, {
      y: -upperLen - (length - upperLen) / 2,
      sx: width * 1.05,
      sy: length - upperLen,
      sz: width * 1.25,
    }),
  ]);
  box.dispose();
  return g;
}

/** The explorer: one merged body mesh plus four pivoting limbs (5 draw calls). */
export class PlayerView {
  readonly root = new THREE.Group();
  private readonly pose = new THREE.Group();
  private readonly armL: THREE.Mesh;
  private readonly armR: THREE.Mesh;
  private readonly legL: THREE.Mesh;
  private readonly legR: THREE.Mesh;
  private phase = 0;
  private stumbleTime = 0;

  constructor(materials: Materials) {
    const mat = materials.vertexColored;
    const body = new THREE.Mesh(buildBody(), mat);
    const armGeo = buildLimb(JACKET, SKIN, 0.62, 0.14);
    const legGeo = buildLimb(PANTS, BOOT, 0.93, 0.18);
    this.armL = new THREE.Mesh(armGeo, mat);
    this.armR = new THREE.Mesh(armGeo, mat);
    this.legL = new THREE.Mesh(legGeo, mat);
    this.legR = new THREE.Mesh(legGeo, mat);
    this.armL.position.set(-0.33, 1.52, 0);
    this.armR.position.set(0.33, 1.52, 0);
    this.legL.position.set(-0.13, 0.93, 0);
    this.legR.position.set(0.13, 0.93, 0);
    this.pose.add(body, this.armL, this.armR, this.legL, this.legR);
    this.root.add(this.pose);
    for (const m of [body, this.armL, this.armR, this.legL, this.legR]) m.castShadow = true;
  }

  stumble(): void {
    this.stumbleTime = 0.45;
  }

  /** Poses the rig for the current frame. */
  update(dt: number, player: Player, speed: number, alive: boolean): void {
    if (!alive) {
      this.pose.rotation.x = Math.min(this.pose.rotation.x + dt * 6, 1.45);
      this.pose.position.y = Math.max(this.pose.position.y - dt * 2, -0.2);
      return;
    }
    this.phase += dt * (2.4 + speed * 0.12) * Math.PI * 2;
    const swing = Math.sin(this.phase);
    this.stumbleTime = Math.max(0, this.stumbleTime - dt);
    const wobble = this.stumbleTime > 0 ? Math.sin(this.stumbleTime * 40) * 0.25 : 0;

    const pose = this.pose;
    pose.rotation.set(0, 0, wobble);
    pose.position.y = 0;

    if (player.vertical === 'slide' && player.y <= 0.05) {
      pose.rotation.x = 1.15;
      pose.position.y = 0.32;
      pose.position.z = 0.2;
      this.armL.rotation.set(-2.6, 0, 0.3);
      this.armR.rotation.set(-2.6, 0, -0.3);
      this.legL.rotation.set(0.2, 0, 0);
      this.legR.rotation.set(-0.1, 0, 0);
      return;
    }
    pose.position.z = 0;
    if (player.vertical === 'jump' || player.y > 0.05) {
      pose.rotation.x = -0.15;
      this.armL.rotation.set(-2.4, 0, 0.25);
      this.armR.rotation.set(-2.2, 0, -0.25);
      this.legL.rotation.set(0.9, 0, 0);
      this.legR.rotation.set(-0.35, 0, 0);
      return;
    }
    // Running: forward lean, alternating limbs, a little bounce.
    pose.rotation.x = -0.12;
    pose.position.y = Math.abs(swing) * 0.07;
    this.armL.rotation.set(swing * 0.9, 0, 0.08);
    this.armR.rotation.set(-swing * 0.9, 0, -0.08);
    this.legL.rotation.set(-swing * 0.95, 0, 0);
    this.legR.rotation.set(swing * 0.95, 0, 0);
  }

  resetPose(): void {
    this.pose.rotation.set(0, 0, 0);
    this.pose.position.set(0, 0, 0);
    this.stumbleTime = 0;
  }
}
