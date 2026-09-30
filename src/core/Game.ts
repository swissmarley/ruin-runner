import { AudioManager } from '../audio/AudioManager';
import { DT, MAX_STEPS_PER_FRAME } from '../config';
import { InputManager } from '../input/InputManager';
import { TiltInput } from '../input/TiltInput';
import { GameView } from '../render/GameView';
import { Bot } from '../sim/Bot';
import type { Dir } from '../sim/InputBuffer';
import { Simulation } from '../sim/Simulation';
import type { Settings } from '../storage/SaveData';
import { SaveData } from '../storage/SaveData';
import { Screens } from '../ui/Screens';
import { Feedback } from './Feedback';
import { FixedStepLoop, RafDriver } from './GameLoop';
import { Haptics } from './Haptics';
import { randomSeed } from './Rng';
import type { GameState } from './StateMachine';
import { StateMachine } from './StateMachine';

/** Seconds of death animation before the Game Over card appears. */
const DEATH_DELAY = 1.0;

/** Top-level glue: state machine, fixed-step loop, simulation, view, input, audio and UI. */
export class Game {
  readonly states = new StateMachine();
  readonly sim: Simulation;
  readonly save = new SaveData();
  readonly audio = new AudioManager();
  readonly haptics = new Haptics();
  readonly tilt = new TiltInput();
  private readonly view: GameView;
  private readonly screens: Screens;
  private readonly feedback: Feedback;
  private readonly loop = new FixedStepLoop(DT, MAX_STEPS_PER_FRAME);
  private readonly driver: RafDriver;
  private readonly input: InputManager;
  private readonly bot: Bot;
  /** When true the perfect-play bot drives the runner (attract mode / smoke tests). */
  autopilot = false;
  private deathTimer = 0;
  private tutorialRun = false;

  constructor(container: HTMLElement) {
    this.sim = new Simulation(randomSeed());
    this.bot = new Bot(this.sim);
    this.view = new GameView(container, this.sim);
    this.feedback = new Feedback(this.view, this.audio, this.haptics);
    this.screens = new Screens(
      container,
      {
        play: () => this.play(),
        toMenu: () => this.toMenu(),
        togglePause: () => this.togglePause(),
        changeSettings: (patch) => this.changeSettings(patch),
        replayTutorial: () => this.save.setTutorialDone(false),
      },
      () => this.save.state,
    );
    this.input = new InputManager(container, {
      onDirection: (dir) => this.onDirection(dir),
      onPause: () => this.togglePause(),
      onDebugToggle: () => this.view.toggleDebug(),
      onConfirm: () => this.onConfirm(),
    });
    this.states.onChange((to) => this.onStateChange(to));
    this.driver = new RafDriver((dt) => this.frame(dt));
    this.applySettings(this.save.state.settings);
    // Mobile browsers only allow audio to start inside a user gesture.
    const unlock = (): void => {
      this.audio.unlock();
      if (this.save.state.settings.tilt) void this.tilt.enable();
    };
    for (const type of ['pointerdown', 'touchend', 'keydown']) {
      window.addEventListener(type, unlock, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => this.onVisibility());
  }

  start(): void {
    this.driver.start();
    this.startAttract();
    this.states.go('Menu');
  }

  get state(): GameState {
    return this.states.state;
  }

  /** Starts a fresh player-controlled run (also used for instant Retry). */
  play(seed: number = randomSeed()): void {
    this.autopilot = false;
    this.tutorialRun = !this.save.state.tutorialDone;
    this.resetRun(seed, this.tutorialRun);
    // Lane-free tilt steering only when enabled *and* the device actually reports tilt.
    const tilt = this.save.state.settings.tilt && this.tilt.active;
    this.sim.player.freeLateral = tilt;
    if (tilt) this.tilt.calibrate();
    this.states.go('Playing');
  }

  toMenu(): void {
    this.startAttract();
    this.states.go('Menu');
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

  private changeSettings(patch: Partial<Settings>): void {
    this.save.updateSettings(patch);
    this.applySettings(this.save.state.settings);
    this.audio.play('click');
    if (patch.tilt === true) {
      // Called inside the toggle's click, so iOS can show its motion-permission prompt.
      void this.tilt.enable().then((ok) => {
        if (ok) return;
        this.save.updateSettings({ tilt: false });
        this.screens.refreshSettings();
      });
    } else if (patch.tilt === false) {
      this.tilt.disable();
    }
  }

  private applySettings(s: Settings): void {
    this.audio.setSfxEnabled(s.sound);
    this.audio.setMusicEnabled(s.music);
    this.haptics.enabled = s.haptics;
    this.view.setQuality(s.quality);
  }

  private onVisibility(): void {
    const hidden = document.visibilityState === 'hidden';
    if (hidden && this.states.state === 'Playing' && this.sim.alive) this.states.go('Paused');
    this.audio.setSuspended(hidden);
  }

  private startAttract(): void {
    this.autopilot = true;
    this.tutorialRun = false;
    this.resetRun(randomSeed(), false);
  }

  private resetRun(seed: number, tutorial: boolean): void {
    this.sim.reset(seed, 0, tutorial);
    this.bot.reset();
    this.view.reset();
    this.loop.reset();
    this.screens.resetHud();
    this.deathTimer = 0;
  }

  private onStateChange(to: GameState): void {
    this.screens.onState(to);
    this.input.setEnabled(to === 'Playing');
    this.audio.setMusicMode(to === 'Playing' ? 'run' : 'menu');
  }

  private onConfirm(): void {
    const state = this.states.state;
    if ((state === 'Menu' && !this.screens.settingsOpen) || state === 'GameOver') this.play();
    else if (state === 'Paused') this.togglePause();
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
    const audible = state === 'Playing' && !this.autopilot;
    let alpha = 1;
    if (running) {
      alpha = this.loop.advance(dt, this.stepSim);
      this.feedback.drain(this.sim.events, audible);
      if (!this.sim.alive) this.afterDeath(dt, state);
    }
    if (this.view.draw(running ? dt : 0, alpha)) this.feedback.crumble(audible);
    this.view.frameStats(dt);
    this.audio.update(dt, this.sim.pursuer.closeness, audible && this.sim.alive);
    if (state === 'Playing') {
      if (this.sim.player.freeLateral) this.sim.player.setTiltTarget(this.tilt.target());
      this.screens.updateHud(this.sim);
      if (this.tutorialRun && this.sim.s > this.sim.generator.tutorialEndS) {
        this.tutorialRun = false;
        this.save.setTutorialDone(true);
      }
    }
  }

  private afterDeath(dt: number, state: GameState): void {
    this.deathTimer += dt;
    if (this.deathTimer < DEATH_DELAY) return;
    if (state === 'Menu') {
      this.startAttract();
      return;
    }
    const sc = this.sim.scoring;
    const newBest = this.save.recordRun({
      score: sc.total,
      coins: sc.coins,
      distance: this.sim.distance,
    });
    this.states.go('GameOver');
    this.screens.showGameOver({
      cause: this.sim.deathCause,
      score: sc.total,
      best: this.save.state.highScore,
      newBest,
      coins: sc.coins,
      distance: this.sim.distance,
    });
  }
}
