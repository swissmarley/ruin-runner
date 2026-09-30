import { DT, MAX_STEPS_PER_FRAME } from '../config';
import { InputManager } from '../input/InputManager';
import { CameraRig } from '../render/CameraRig';
import { Materials } from '../render/Materials';
import { PlayerView } from '../render/PlayerView';
import { Renderer } from '../render/Renderer';
import { TurnBlend } from '../render/TurnBlend';
import { WorldView } from '../render/WorldView';
import { Bot } from '../sim/Bot';
import type { Dir } from '../sim/InputBuffer';
import { Simulation } from '../sim/Simulation';
import { FixedStepLoop, RafDriver } from './GameLoop';
import { randomSeed } from './Rng';
import { StateMachine } from './StateMachine';

/** Top-level glue: state machine, fixed-step loop, simulation, views and input. */
export class Game {
  readonly states = new StateMachine();
  readonly sim: Simulation;
  private readonly renderer: Renderer;
  private readonly materials = new Materials();
  private readonly world: WorldView;
  private readonly playerView: PlayerView;
  private readonly cameraRig: CameraRig;
  private readonly blend = new TurnBlend();
  private readonly loop = new FixedStepLoop(DT, MAX_STEPS_PER_FRAME);
  private readonly driver: RafDriver;
  private readonly input: InputManager;
  private readonly bot: Bot;
  /** When true the perfect-play bot drives the runner (attract mode / smoke tests). */
  autopilot = false;

  constructor(container: HTMLElement) {
    this.sim = new Simulation(randomSeed());
    this.bot = new Bot(this.sim);
    this.renderer = new Renderer(container);
    this.world = new WorldView(this.materials, this.sim.pool.capacity);
    this.playerView = new PlayerView(this.materials);
    this.cameraRig = new CameraRig(this.renderer.camera);
    this.renderer.scene.add(this.world.group, this.playerView.root);

    this.input = new InputManager(container, {
      onDirection: (dir) => this.onDirection(dir),
      onPause: () => this.togglePause(),
      onDebugToggle: () => {},
    });

    window.addEventListener('resize', () => this.renderer.resize());
    this.driver = new RafDriver((dt) => this.frame(dt));
    this.states.go('Menu');
  }

  start(): void {
    this.driver.start();
    this.newRun();
  }

  newRun(seed: number = randomSeed()): void {
    this.sim.reset(seed);
    this.bot.reset();
    this.world.invalidate();
    this.blend.reset(0);
    this.cameraRig.reset();
    this.playerView.resetPose();
    this.loop.reset();
    this.states.go('Playing');
  }

  togglePause(): void {
    if (this.states.state === 'Playing') this.states.go('Paused');
    else if (this.states.state === 'Paused') this.states.go('Playing');
  }

  /** Test hook: advances `seconds` of game time synchronously in 1/60 s frames. */
  debugAdvance(seconds: number): void {
    const frames = Math.round(seconds * 60);
    for (let i = 0; i < frames; i++) this.frame(1 / 60);
  }

  private onDirection(dir: Dir): void {
    if (this.states.state === 'Playing') this.sim.pushInput(dir);
  }

  private readonly stepSim = (dt: number): void => {
    if (this.autopilot) this.bot.update();
    this.sim.step(dt);
  };

  private frame(dt: number): void {
    this.input.pollGamepads();
    let alpha = 1;
    if (this.states.state === 'Playing') {
      alpha = this.loop.advance(dt, this.stepSim);
      this.drainEvents();
    }
    this.draw(this.states.state === 'Playing' ? dt : 0, alpha);
  }

  private drainEvents(): void {
    const ev = this.sim.events;
    for (let i = 0; i < ev.count; i++) {
      if (ev.types[i] === 'turn') {
        this.blend.start(this.sim.frame.heading, this.sim.turnOffsetX, this.sim.turnOffsetZ);
      }
    }
    ev.clear();
  }

  private draw(dt: number, alpha: number): void {
    const sim = this.sim;
    const p = sim.player;
    this.blend.update(dt);
    const px = sim.prevPx + (sim.px - sim.prevPx) * alpha + this.blend.offsetX;
    const pz = sim.prevPz + (sim.pz - sim.prevPz) * alpha + this.blend.offsetZ;
    const py = p.prevY + (p.y - p.prevY) * alpha;
    const lateral = p.prevX + (p.x - p.prevX) * alpha;

    this.world.update(sim.pool);
    this.playerView.root.position.set(px, py, pz);
    this.playerView.root.rotation.y = this.blend.yaw;
    this.playerView.update(dt, p, sim.speed, sim.alive);
    this.cameraRig.update(dt, px, py, pz, this.blend.yaw, lateral, 0);
    this.renderer.followSun(px, pz);
    this.renderer.render();
  }
}
