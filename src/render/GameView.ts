import type { Simulation } from '../sim/Simulation';
import type { SimEventType } from '../sim/SimEvents';
import { CameraRig } from './CameraRig';
import { CollectiblesView } from './CollectiblesView';
import { CrumbleView } from './CrumbleView';
import { Materials } from './Materials';
import { ObstacleView } from './ObstacleView';
import { PlayerView } from './PlayerView';
import { PursuerView } from './PursuerView';
import { Renderer } from './Renderer';
import { TurnBlend } from './TurnBlend';
import { WorldView } from './WorldView';

/** Everything visual: owns the renderer and all views, and draws one interpolated frame. */
export class GameView {
  readonly renderer: Renderer;
  private readonly materials = new Materials();
  private readonly world: WorldView;
  private readonly obstacles: ObstacleView;
  private readonly crumble: CrumbleView;
  private readonly playerView: PlayerView;
  private readonly pursuerView: PursuerView;
  private readonly collectibles: CollectiblesView;
  private readonly cameraRig: CameraRig;
  private readonly blend = new TurnBlend();
  private deathTime = 0;

  constructor(
    container: HTMLElement,
    private readonly sim: Simulation,
  ) {
    this.renderer = new Renderer(container);
    const slots = sim.pool.capacity;
    this.world = new WorldView(this.materials, slots);
    this.obstacles = new ObstacleView(this.materials, slots);
    this.crumble = new CrumbleView(this.materials);
    this.playerView = new PlayerView(this.materials);
    this.pursuerView = new PursuerView(this.materials);
    this.collectibles = new CollectiblesView(slots);
    this.cameraRig = new CameraRig(this.renderer.camera);
    this.renderer.scene.add(
      this.world.group,
      this.obstacles.group,
      this.crumble.mesh,
      this.collectibles.group,
      this.playerView.root,
      this.pursuerView.root,
    );
    window.addEventListener('resize', () => this.renderer.resize());
  }

  /** Call after `sim.reset()` so every view rebuilds from the new track. */
  reset(): void {
    this.world.invalidate();
    this.obstacles.invalidate();
    this.crumble.reset();
    this.collectibles.invalidate();
    this.pursuerView.reset(this.sim);
    this.blend.reset(this.sim.frame.heading);
    this.cameraRig.reset();
    this.playerView.resetPose();
    this.deathTime = 0;
  }

  /** Reacts to one simulation event (visual side only). */
  onEvent(type: SimEventType): void {
    const sim = this.sim;
    switch (type) {
      case 'turn':
        this.blend.start(sim.frame.heading, sim.turnOffsetX, sim.turnOffsetZ);
        break;
      case 'stumble':
      case 'shieldBreak':
        this.playerView.stumble();
        this.cameraRig.addShake(0.18);
        break;
      case 'death':
        this.cameraRig.addShake(sim.deathCause === 'pit' ? 0.05 : 0.3);
        break;
      default:
        break;
    }
  }

  /** Hook for coin-collect effects (particles are added in the art pass). */
  private readonly onCoinCollected = (_x: number, _y: number, _z: number): void => {};

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

    this.world.update(sim.pool);
    this.obstacles.update(sim.pool);
    const crumbled = this.crumble.update(dt, sim);
    this.playerView.root.position.set(px, py, pz);
    this.playerView.root.rotation.y = this.blend.yaw;
    this.playerView.update(dt, p, sim.speed, sim.alive || sim.deathCause === 'pit');
    this.collectibles.update(dt, sim, this.onCoinCollected);
    const runnerS = sim.prevS + (sim.s - sim.prevS) * alpha;
    this.pursuerView.update(dt, sim, alpha, runnerS);
    const camY = sim.alive ? py : Math.max(py, -1.5);
    const closeness = sim.pursuer.closeness;
    this.cameraRig.update(dt, px, camY, pz, this.blend.yaw, lateral, closeness);
    this.renderer.followSun(px, pz);
    this.renderer.render();
    return crumbled;
  }
}
