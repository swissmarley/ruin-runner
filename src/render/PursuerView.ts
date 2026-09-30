import * as THREE from 'three';
import type { Simulation } from '../sim/Simulation';
import { headingYaw } from '../world/Heading';
import { WorldPoint, worldAt } from '../world/Track';
import { mergeParts, part } from './Geometry';
import type { Materials } from './Materials';

const STONE = 0x6f7568;
const STONE_DARK = 0x4c5148;
const MOSS = 0x55702f;
const EYE = 0xffb347;

function buildTorso(): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const rock = new THREE.DodecahedronGeometry(1, 0);
  const g = mergeParts([
    part(box, STONE, { y: 1.9, sx: 1.5, sy: 1.3, sz: 1.0 }),
    part(box, STONE_DARK, { y: 1.25, sx: 1.2, sy: 0.35, sz: 0.85 }),
    part(box, STONE, { y: 2.85, z: -0.1, sx: 0.9, sy: 0.75, sz: 0.8 }),
    part(box, STONE_DARK, { y: 2.72, z: -0.52, sx: 0.8, sy: 0.18, sz: 0.1 }),
    part(rock, STONE_DARK, { x: -0.95, y: 2.45, sx: 0.5, sy: 0.45, sz: 0.5 }),
    part(rock, STONE_DARK, { x: 0.95, y: 2.45, sx: 0.5, sy: 0.45, sz: 0.5 }),
    part(box, MOSS, { x: -0.95, y: 2.85, sx: 0.55, sy: 0.12, sz: 0.5 }),
    part(box, MOSS, { y: 3.26, z: -0.1, sx: 0.7, sy: 0.1, sz: 0.6 }),
    part(box, MOSS, { x: 0.4, y: 1.7, z: -0.51, sx: 0.4, sy: 0.5, sz: 0.04 }),
    part(box, 0x8a6a3e, { y: 2.1, z: -0.51, sx: 0.5, sy: 0.5, sz: 0.04 }),
  ]);
  box.dispose();
  rock.dispose();
  return g;
}

function buildLimb(length: number, width: number, fist: boolean): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const parts = [part(box, STONE, { y: -length / 2, sx: width, sy: length, sz: width })];
  if (fist) parts.push(part(box, STONE_DARK, { y: -length - 0.2, sx: 0.55, sy: 0.45, sz: 0.55 }));
  else
    parts.push(part(box, STONE_DARK, { y: -length + 0.1, z: -0.1, sx: 0.6, sy: 0.25, sz: 0.75 }));
  const g = mergeParts(parts);
  box.dispose();
  return g;
}

/**
 * The Stone Warden: a hulking moss-covered guardian with ember eyes. Positioned `gap`
 * meters behind the runner along the path; lumbers with a heavy, swaying gait.
 */
export class PursuerView {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly armL: THREE.Mesh;
  private readonly armR: THREE.Mesh;
  private readonly legL: THREE.Mesh;
  private readonly legR: THREE.Mesh;
  private readonly eyes: THREE.Mesh;
  private readonly wp = new WorldPoint();
  private phase = 0;
  private yaw = 0;
  private visualGap = 0;

  constructor(materials: Materials) {
    const mat = materials.vertexColored;
    const torso = new THREE.Mesh(buildTorso(), mat);
    const armGeo = buildLimb(1.5, 0.42, true);
    const legGeo = buildLimb(1.1, 0.5, false);
    this.armL = new THREE.Mesh(armGeo, mat);
    this.armR = new THREE.Mesh(armGeo, mat);
    this.legL = new THREE.Mesh(legGeo, mat);
    this.legR = new THREE.Mesh(legGeo, mat);
    this.armL.position.set(-1.0, 2.4, 0);
    this.armR.position.set(1.0, 2.4, 0);
    this.legL.position.set(-0.4, 1.1, 0);
    this.legR.position.set(0.4, 1.1, 0);
    const eyeGeo = new THREE.BoxGeometry(0.62, 0.12, 0.06);
    this.eyes = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: EYE }));
    this.eyes.position.set(0, 2.9, -0.52);
    this.body.add(torso, this.armL, this.armR, this.legL, this.legR, this.eyes);
    this.body.scale.setScalar(0.62);
    this.root.add(this.body);
    for (const mesh of [torso, this.armL, this.armR, this.legL, this.legR]) mesh.castShadow = true;
  }

  reset(sim: Simulation): void {
    this.visualGap = sim.pursuer.gap;
    this.yaw = headingYaw(sim.frame.heading);
  }

  update(dt: number, sim: Simulation, alpha: number, runnerS: number): void {
    const pur = sim.pursuer;
    let gap = pur.prevGap + (pur.gap - pur.prevGap) * alpha;
    // After a catch the sim stops; finish the grab visually.
    if (!sim.alive && sim.deathCause === 'caught') {
      this.visualGap = Math.max(0.8, this.visualGap - dt * 18);
      gap = this.visualGap;
    } else {
      this.visualGap = gap;
    }
    const x = pur.prevX + (pur.x - pur.prevX) * alpha;
    const visible = gap < 14;
    this.root.visible = visible;
    if (!visible || !worldAt(sim.pool, runnerS - gap, x, this.wp)) return;

    const targetYaw = headingYaw(this.wp.heading);
    let d = targetYaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * 8);
    this.root.position.set(this.wp.x, 0, this.wp.z);
    this.root.rotation.y = this.yaw;

    const running = sim.alive || sim.deathCause !== 'caught';
    this.phase += dt * (running ? 1.6 + sim.speed * 0.09 : 0.5) * Math.PI * 2;
    const sw = Math.sin(this.phase);
    this.body.position.y = Math.abs(sw) * 0.18;
    this.body.rotation.z = sw * 0.06;
    this.body.rotation.x = -0.18;
    this.legL.rotation.x = -sw * 0.7;
    this.legR.rotation.x = sw * 0.7;
    const reach = sim.alive ? 0 : 1.2;
    this.armL.rotation.x = sw * 0.8 + reach;
    this.armR.rotation.x = -sw * 0.8 + reach;
    const glow = 0.75 + 0.25 * Math.sin(this.phase * 0.5);
    (this.eyes.material as THREE.MeshBasicMaterial).color.setHex(EYE).multiplyScalar(glow);
  }
}
