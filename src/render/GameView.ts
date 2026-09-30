import { CRUMBLE_GAP_LENGTH } from '../config';
import type { Simulation } from '../sim/Simulation';
import type { SimEventType } from '../sim/SimEvents';
import type { QualitySetting } from '../storage/SaveData';
import { DebugOverlay } from '../ui/DebugOverlay';
import { segmentAt, WorldPoint, worldAt } from '../world/Track';
import { CameraRig } from './CameraRig';
import { CollectiblesView } from './CollectiblesView';
import { CrumbleView } from './CrumbleView';
import { DecorView } from './DecorView';
import { Effects } from './Effects';
import { Environment } from './Environment';
import { HintView } from './HintView';
import { Materials } from './Materials';
import { ObstacleView } from './ObstacleView';
import { PlayerView } from './PlayerView';
import { PursuerView } from './PursuerView';
import { AdaptiveQuality } from './AdaptiveQuality';
import type { QualityLevel } from './Quality';
import { applyQuality, initialLevel } from './Quality';
import { Renderer } from './Renderer';
import { TurnBlend } from './TurnBlend';
import { WorldView } from './WorldView';

const DUST = 0xb09a7c;
const DEBRIS = 0x6d5d4b;
const POWERUP_COLORS = [0xe0413a, 0x4fb3ff, 0xffd23f];
const STEP_DUST_INTERVAL = 0.14;

/** Everything visual: owns the renderer and all views, and draws one interpolated frame. */
export class GameView {
  readonly renderer: Renderer;
  private readonly materials = new Materials();
  private readonly environment = new Environment();
  private readonly world: WorldView;
  private readonly decor: DecorView;
  private readonly obstacles: ObstacleView;
  private readonly crumble: CrumbleView;
  private readonly playerView: PlayerView;
  private readonly pursuerView: PursuerView;
  private readonly collectibles: CollectiblesView;
  private readonly effects = new Effects();
  private readonly hints = new HintView();
  private readonly debug: DebugOverlay;
  private quality: QualityLevel = 'high';
  private readonly adaptive = new AdaptiveQuality('high');
  /** True when the player chose "Auto" quality (the adaptive controller may change it). */
  autoQuality = true;
  private readonly cameraRig: CameraRig;
  private readonly blend = new TurnBlend();
  private readonly wp = new WorldPoint();
  private deathTime = 0;
  private dustTimer = 0;
  private clock = 0;
  private px = 0;
  private py = 0;
  private pz = 0;

  constructor(
    container: HTMLElement,
    private readonly sim: Simulation,
  ) {
    this.renderer = new Renderer(container);
    const slots = sim.pool.capacity;
    this.world = new WorldView(this.materials, slots);
    this.decor = new DecorView(this.materials, slots);
    this.obstacles = new ObstacleView(this.materials, slots);
    this.crumble = new CrumbleView(this.materials);
    this.playerView = new PlayerView(this.materials);
    this.pursuerView = new PursuerView(this.materials);
    this.collectibles = new CollectiblesView(slots);
    this.cameraRig = new CameraRig(this.renderer.camera);
    this.renderer.scene.add(
      this.environment.group,
      this.world.group,
      this.decor.group,
      this.obstacles.group,
      this.crumble.mesh,
      this.collectibles.group,
      this.playerView.root,
      this.pursuerView.root,
      this.effects.points,
      this.hints.group,
    );
    this.debug = new DebugOverlay(container);
    this.renderer.onResize = (h) => this.effects.setViewportHeight(h);
    this.effects.setViewportHeight(this.renderer.gl.domElement.height);
    window.addEventListener('resize', () => this.renderer.resize());
  }

  setQuality(setting: QualitySetting): void {
    this.autoQuality = setting === 'auto';
    const level = initialLevel(setting);
    this.adaptive.reset(level);
    this.setQualityLevel(level);
  }

  setQualityLevel(level: QualityLevel, pixelScale = 1): void {
    this.quality = level;
    applyQuality(this.renderer, level, pixelScale);
  }

  get qualityLevel(): QualityLevel {
    return this.quality;
  }

  toggleDebug(): void {
    this.debug.toggle();
  }

  /** Call after `sim.reset()` so every view rebuilds from the new track. */
  reset(): void {
    this.world.invalidate();
    this.decor.invalidate();
    this.obstacles.invalidate();
    this.crumble.reset();
    this.collectibles.invalidate();
    this.effects.clear();
    this.pursuerView.reset(this.sim);
    this.blend.reset(this.sim.frame.heading);
    this.cameraRig.reset();
    this.playerView.resetPose();
    this.deathTime = 0;
  }

  /** Reacts to one simulation event (visual side only). */
  onEvent(type: SimEventType, value: number): void {
    const sim = this.sim;
    const fx = this.effects;
    const { px, py, pz } = this;
    switch (type) {
      case 'turn':
        this.blend.start(sim.frame.heading, sim.turnOffsetX, sim.turnOffsetZ);
        break;
      case 'jump':
        fx.burst(px, py + 0.05, pz, 6, DUST, 1.6, 0.5, 0.4, 0.2);
        break;
      case 'land':
        fx.burst(px, 0.05, pz, 10, DUST, 2.4, 0.6, 0.5, 0.2);
        break;
      case 'slide':
        fx.burst(px, 0.1, pz, 8, DUST, 2, 0.55, 0.45, 0.2);
        break;
      case 'stumble':
        this.playerView.stumble();
        this.cameraRig.addShake(0.18);
        fx.burst(px, 0.4, pz, 14, DEBRIS, 3.5, 0.45, 0.7, 1.2, 1.5);
        break;
      case 'shieldBreak':
        this.playerView.stumble();
        this.cameraRig.addShake(0.12);
        fx.burst(px, py + 1, pz, 22, 0x8fd3ff, 5, 0.4, 0.5, 0.3);
        break;
      case 'surgeSmash':
        this.cameraRig.addShake(0.1);
        fx.burst(px, py + 0.8, pz, 16, DEBRIS, 6, 0.5, 0.6, 1.3, 2);
        fx.burst(px, py + 0.8, pz, 8, 0xffd23f, 4, 0.35, 0.35, 0.2);
        break;
      case 'powerup':
        fx.burst(px, py + 1, pz, 24, POWERUP_COLORS[value] ?? 0xffffff, 4, 0.45, 0.6, 0.1, 1);
        break;
      case 'death':
        this.cameraRig.addShake(sim.deathCause === 'pit' ? 0.05 : 0.3);
        if (sim.deathCause !== 'pit') fx.burst(px, 0.8, pz, 18, DEBRIS, 4, 0.5, 0.9, 1.2, 2);
        break;
      default:
        break;
    }
  }

  private readonly onCoinCollected = (x: number, y: number, z: number): void => {
    this.effects.burst(x, y, z, 7, 0xffe07a, 2.6, 0.32, 0.35, 0.1, 0.5);
  };

  /** Returns true if the crumbling bridge started collapsing this frame. */
  draw(dt: number, alpha: number): boolean {
    const sim = this.sim;
    const p = sim.player;
    this.blend.update(dt);
    if (!sim.alive) this.deathTime += dt;

    const px = sim.prevPx + (sim.px - sim.prevPx) * alpha + this.blend.offsetX;
    const pz = sim.prevPz + (sim.pz - sim.prevPz) * alpha + this.blend.offsetZ;
    let py = p.prevY + (p.y - p.prevY) * alpha;
    if (!sim.alive && sim.deathCause === 'pit') py -= 0.5 * 18 * this.deathTime * this.deathTime;
    const lateral = p.prevX + (p.x - p.prevX) * alpha;
    this.px = px;
    this.py = py;
    this.pz = pz;

    this.world.update(sim.pool);
    this.decor.update(dt, sim.pool);
    this.obstacles.update(sim.pool);
    const crumbled = this.crumble.update(dt, sim);
    if (crumbled) this.crumbleDebris();
    this.playerView.root.position.set(px, py, pz);
    this.playerView.root.rotation.y = this.blend.yaw;
    this.playerView.update(dt, p, sim.speed, sim.alive || sim.deathCause === 'pit');
    this.collectibles.update(dt, sim, this.onCoinCollected);
    const runnerS = sim.prevS + (sim.s - sim.prevS) * alpha;
    this.pursuerView.update(dt, sim, alpha, runnerS);
    this.runningDust(dt);
    this.effects.update(dt);
    this.clock += dt;
    this.hints.update(sim, this.clock);

    const camY = sim.alive ? py : Math.max(py, -1.5);
    this.cameraRig.update(dt, px, camY, pz, this.blend.yaw, lateral, sim.pursuer.closeness);
    const cam = this.renderer.camera.position;
    this.environment.follow(cam.x, cam.z);
    this.renderer.followSun(px, pz);
    this.renderer.render();
    return crumbled;
  }

  /** Per-frame bookkeeping with the real frame time: adaptive quality and debug overlay. */
  frameStats(realDt: number): void {
    if (this.autoQuality && this.adaptive.sample(realDt)) {
      const st = this.adaptive.state;
      this.setQualityLevel(st.level, st.pixelScale);
    }
    this.debug.tick(realDt, this.debugStats);
  }

  private readonly debugStats = () => {
    const info = this.renderer.gl.info.render;
    return {
      calls: info.calls,
      triangles: info.triangles,
      segments: this.sim.pool.count,
      speed: this.sim.speed,
      seed: this.sim.seed,
      quality: this.autoQuality
        ? `auto:${this.quality} (${(this.adaptive.averageFrameTime * 1000).toFixed(1)} ms)`
        : this.quality,
      pixelRatio: this.renderer.getPixelRatio(),
    };
  };

  private runningDust(dt: number): void {
    const p = this.sim.player;
    if (!this.sim.alive || !p.grounded || dt === 0) return;
    this.dustTimer -= dt;
    if (this.dustTimer > 0) return;
    this.dustTimer = STEP_DUST_INTERVAL;
    this.effects.burst(this.px, 0.05, this.pz, 2, DUST, 0.9, 0.4, 0.35, 0.1, 0.6);
  }

  private crumbleDebris(): void {
    const sim = this.sim;
    const seg = segmentAt(sim.pool, sim.s + 16);
    if (!seg || seg.kind !== 'bridge') return;
    if (!worldAt(sim.pool, seg.crumbleS + CRUMBLE_GAP_LENGTH / 2, 0, this.wp)) return;
    this.effects.burst(this.wp.x, 0, this.wp.z, 30, DEBRIS, 4, 0.55, 1.4, 1.5, 1);
    this.effects.burst(this.wp.x, 0, this.wp.z, 20, DUST, 3, 0.8, 1.0, 0.3, 1);
  }
}
