import { DT, MAX_STEPS_PER_FRAME } from '../config';
import { InputManager } from '../input/InputManager';
import { GameView } from '../render/GameView';
import { Bot } from '../sim/Bot';
import type { Dir } from '../sim/InputBuffer';
import { Simulation } from '../sim/Simulation';
import { GameOver } from '../ui/GameOver';
import { Hud } from '../ui/Hud';
import { Menu } from '../ui/Menu';
import { Pause } from '../ui/Pause';
import { FixedStepLoop, RafDriver } from './GameLoop';
import { randomSeed } from './Rng';
import type { GameState } from './StateMachine';
import { StateMachine } from './StateMachine';

/** Seconds of death animation before the Game Over card appears. */
const DEATH_DELAY = 1.0;

/** Top-level glue: state machine, fixed-step loop, simulation, view, input and UI. */
export class Game {
  readonly states = new StateMachine();
  readonly sim: Simulation;
  private readonly view: GameView;
  private readonly loop = new FixedStepLoop(DT, MAX_STEPS_PER_FRAME);
  private readonly driver: RafDriver;
  private readonly input: InputManager;
  private readonly bot: Bot;
  private readonly menu: Menu;
  private readonly gameOver: GameOver;
  private readonly hud: Hud;
  private readonly pause: Pause;
  /** When true the perfect-play bot drives the runner (attract mode / smoke tests). */
  autopilot = false;
  private deathTimer = 0;
  private best = 0;

  constructor(container: HTMLElement) {
    this.sim = new Simulation(randomSeed());
    this.bot = new Bot(this.sim);
    this.view = new GameView(container, this.sim);
    const ui = document.createElement('div');
    ui.className = 'ui-layer';
    container.appendChild(ui);
    this.menu = new Menu(ui, {
      onPlay: () => this.play(),
      onSettings: () => {},
    });
    this.hud = new Hud(ui, () => this.togglePause());
    this.pause = new Pause(ui, {
      onResume: () => this.togglePause(),
      onMenu: () => this.toMenu(),
    });
    this.gameOver = new GameOver(ui, {
      onRetry: () => this.play(),
      onMenu: () => this.toMenu(),
    });
    this.input = new InputManager(container, {
      onDirection: (dir) => this.onDirection(dir),
      onPause: () => this.togglePause(),
      onDebugToggle: () => {},
    });
    this.states.onChange((to, from) => this.onStateChange(to, from));
    this.driver = new RafDriver((dt) => this.frame(dt));
  }

  start(): void {
    this.driver.start();
    this.startAttract();
    this.states.go('Menu');
  }

  /** Starts a fresh player-controlled run (also used for instant Retry). */
  play(seed: number = randomSeed()): void {
    this.autopilot = false;
    this.resetRun(seed);
    this.states.go('Playing');
  }

  toMenu(): void {
    this.startAttract();
    this.states.go('Menu');
  }

  get state(): GameState {
    return this.states.state;
  }

  togglePause(): void {
    if (this.states.state === 'Playing' && this.sim.alive) this.states.go('Paused');
    else if (this.states.state === 'Paused') this.states.go('Playing');
  }

  /** Test hook: advances `seconds` of game time synchronously in 1/60 s frames. */
  debugAdvance(seconds: number): void {
    const frames = Math.round(seconds * 60);
    for (let i = 0; i < frames; i++) this.frame(1 / 60);
  }

  private startAttract(): void {
    this.autopilot = true;
    this.resetRun(randomSeed());
  }

  private resetRun(seed: number): void {
    this.sim.reset(seed);
    this.bot.reset();
    this.view.reset();
    this.loop.reset();
    this.hud.reset();
    this.deathTimer = 0;
  }

  private onStateChange(to: GameState, _from: GameState): void {
    this.menu.root.classList.toggle('hidden', to !== 'Menu');
    if (to !== 'GameOver') this.gameOver.hide();
    this.pause.root.classList.toggle('hidden', to !== 'Paused');
    if (to === 'Playing' || to === 'Paused') this.hud.show();
    else this.hud.hide();
    this.input.setEnabled(to === 'Playing');
    if (to === 'Menu') this.menu.setRecords(this.best, 0);
  }

  private onDirection(dir: Dir): void {
    if (this.states.state === 'Playing' && !this.autopilot) this.sim.pushInput(dir);
  }

  private readonly stepSim = (dt: number): void => {
    if (this.autopilot) this.bot.update();
    this.sim.step(dt);
  };

  private frame(dt: number): void {
    this.input.pollGamepads();
    const state = this.states.state;
    const running = state === 'Playing' || state === 'Menu';
    let alpha = 1;
    if (running) {
      alpha = this.loop.advance(dt, this.stepSim);
      this.drainEvents();
      if (!this.sim.alive) this.afterDeath(dt, state);
    }
    this.view.draw(running ? dt : 0, alpha);
    if (state === 'Playing') this.hud.update(this.sim);
  }

  private afterDeath(dt: number, state: GameState): void {
    this.deathTimer += dt;
    if (this.deathTimer < DEATH_DELAY) return;
    if (state === 'Menu') {
      this.startAttract();
      return;
    }
    const score = this.sim.scoring.total;
    const newBest = score > this.best;
    this.best = Math.max(this.best, score);
    this.states.go('GameOver');
    this.gameOver.present({
      cause: this.sim.deathCause,
      score,
      best: this.best,
      newBest,
      coins: this.sim.scoring.coins,
      distance: this.sim.distance,
    });
  }

  private drainEvents(): void {
    const ev = this.sim.events;
    for (let i = 0; i < ev.count; i++) this.view.onEvent(ev.types[i]!);
    ev.clear();
  }
}
