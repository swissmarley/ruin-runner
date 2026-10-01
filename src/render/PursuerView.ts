import * as THREE from 'three';
import type { Simulation } from '../sim/Simulation';
import { headingYaw } from '../world/Heading';
import { WorldPoint, worldAt } from '../world/Track';
import type { WardenRig } from './character/WardenModel';
import { buildWarden } from './character/WardenModel';
import type { Materials } from './Materials';

/**
 * The Stone Warden: a hulking moss-covered rock golem with ember veins. Positioned `gap`
 * meters behind the runner along the path; lumbers with a heavy, swaying gait.
 */
export class PursuerView {
  readonly root = new THREE.Group();
  private readonly rig: WardenRig;
  private readonly glow: { value: number };
  private readonly wp = new WorldPoint();
  private phase = 0;
  private yaw = 0;
  private visualGap = 0;

  constructor(materials: Materials) {
    this.rig = buildWarden(materials.warden);
    this.glow = materials.wardenUniforms.uGlow;
    this.rig.body.scale.setScalar(0.62);
    this.root.add(this.rig.body);
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
    const r = this.rig;
    r.body.position.y = Math.abs(sw) * 0.14;
    r.body.rotation.set(-0.22, sw * 0.08, sw * 0.06);
    r.legL.rotation.x = sw * 0.75;
    r.legR.rotation.x = -sw * 0.75;
    const reach = sim.alive ? 0 : 1.3;
    r.armL.rotation.set(-sw * 0.8 + reach, 0, -0.15);
    r.armR.rotation.set(sw * 0.8 + reach, 0, 0.15);
    r.elbowL.rotation.x = 0.5 + Math.max(0, -sw) * 0.5 + reach * 0.3;
    r.elbowR.rotation.x = 0.5 + Math.max(0, sw) * 0.5 + reach * 0.3;
    // Ember veins pulse with each heavy step; brighter when it closes in.
    this.glow.value = 0.8 + 0.35 * Math.abs(sw) + pur.closeness * 0.6;
  }
}
