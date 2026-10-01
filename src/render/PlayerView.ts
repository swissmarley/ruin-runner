import type * as THREE from 'three';
import { DT } from '../config';
import type { Player } from '../entities/Player';
import type { ExplorerRig } from './character/ExplorerModel';
import { buildExplorer } from './character/ExplorerModel';
import type { Pose } from './character/Pose';
import {
  approach,
  blendPose,
  createPose,
  fallenPose,
  J,
  jumpPose,
  runPose,
  slidePose,
} from './character/Pose';
import type { Materials } from './Materials';

/**
 * The explorer: a jointed rig driven by blended procedural poses (run cycle, leap, power
 * slide, collapse), with banking on lane changes and a fluttering scarf.
 */
export class PlayerView {
  readonly root: THREE.Group;
  private readonly rig: ExplorerRig;
  private readonly run = createPose();
  private readonly air = createPose();
  private readonly slide = createPose();
  private readonly fallen = createPose();
  private readonly pose = createPose();
  private phase = 0;
  private time = 0;
  private stumbleTime = 0;
  private wAir = 0;
  private wSlide = 0;
  private wDead = 0;
  private rise = 1;
  private bank = 0;

  constructor(materials: Materials) {
    this.rig = buildExplorer(materials.character);
    this.root = this.rig.root;
    fallenPose(this.fallen);
  }

  stumble(): void {
    this.stumbleTime = 0.45;
  }

  /** Poses the rig for the current frame. `alive` false plays the collapse. */
  update(dt: number, player: Player, speed: number, alive: boolean): void {
    this.time += dt;
    this.phase += dt * (2.0 + speed * 0.085) * Math.PI * 2;
    this.stumbleTime = Math.max(0, this.stumbleTime - dt);

    const airborne = player.vertical === 'jump' || player.y > 0.05;
    const sliding = !airborne && player.vertical === 'slide';
    const vy = player.y - player.prevY;
    this.rise = approach(this.rise, vy > 0 ? 1 : 0, 10, dt);
    this.wAir = approach(this.wAir, airborne ? 1 : 0, airborne ? 22 : 16, dt);
    this.wSlide = approach(this.wSlide, sliding ? 1 : 0, 20, dt);
    this.wDead = approach(this.wDead, alive ? 0 : 1, 7, dt);
    const vx = (player.x - player.prevX) / DT;
    this.bank = approach(this.bank, Math.max(-0.3, Math.min(0.3, -vx * 0.03)), 14, dt);

    runPose(this.run, this.phase);
    jumpPose(this.air, this.rise);
    slidePose(this.slide, this.time);
    const p = this.pose;
    blendPose(p, this.run, this.air, this.wAir);
    blendPose(p, p, this.slide, this.wSlide);
    blendPose(p, p, this.fallen, this.wDead);
    if (this.stumbleTime > 0) {
      const w = Math.sin(this.stumbleTime * 40) * this.stumbleTime;
      p[J.spineRZ] = p[J.spineRZ]! + w * 0.6;
      p[J.spineRX] = p[J.spineRX]! - this.stumbleTime * 0.6;
      p[J.headRX] = p[J.headRX]! + w * 0.5;
    }
    p[J.bodyRZ] = p[J.bodyRZ]! + this.bank * (1 - this.wDead);
    this.apply(p);
  }

  private apply(p: Pose): void {
    const r = this.rig;
    r.body.position.y = p[J.bodyY]!;
    r.body.rotation.set(p[J.bodyRX]!, 0, p[J.bodyRZ]!);
    r.hips.rotation.set(p[J.hipsRX]!, p[J.hipsRY]!, p[J.hipsRZ]!);
    r.spine.rotation.set(p[J.spineRX]!, p[J.spineRY]!, p[J.spineRZ]!);
    r.head.rotation.set(p[J.headRX]!, p[J.headRY]!, 0);
    r.shoulderL.rotation.set(p[J.shLX]!, 0, p[J.shLZ]!);
    r.shoulderR.rotation.set(p[J.shRX]!, 0, p[J.shRZ]!);
    r.elbowL.rotation.x = p[J.elL]!;
    r.elbowR.rotation.x = p[J.elR]!;
    r.thighL.rotation.set(p[J.thL]!, 0, p[J.thLZ]!);
    r.thighR.rotation.set(p[J.thR]!, 0, p[J.thRZ]!);
    r.kneeL.rotation.x = p[J.knL]!;
    r.kneeR.rotation.x = p[J.knR]!;
    r.ankleL.rotation.x = p[J.anL]!;
    r.ankleR.rotation.x = p[J.anR]!;
    // Scarf streams behind, flapping in the wind.
    const t = this.time;
    r.scarf1.rotation.set(-0.3 + Math.sin(t * 17) * 0.15, Math.sin(t * 7) * 0.25, 0);
    r.scarf2.rotation.set(0.25 + Math.sin(t * 17 - 1.2) * 0.35, Math.sin(t * 9 - 0.6) * 0.3, 0);
  }

  resetPose(): void {
    this.stumbleTime = 0;
    this.wAir = 0;
    this.wSlide = 0;
    this.wDead = 0;
    this.bank = 0;
  }
}
