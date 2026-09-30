import type { GameState } from '../core/StateMachine';
import type { Simulation } from '../sim/Simulation';
import type { SaveState, Settings as SettingsState } from '../storage/SaveData';
import type { GameOverStats } from './GameOver';
import { GameOver } from './GameOver';
import { Hud } from './Hud';
import { Menu } from './Menu';
import { Pause } from './Pause';
import { Settings } from './Settings';

export interface ScreenActions {
  play(): void;
  toMenu(): void;
  togglePause(): void;
  changeSettings(patch: Partial<SettingsState>): void;
  replayTutorial(): void;
}

/** Owns every DOM overlay and shows the right ones for each game state. */
export class Screens {
  readonly root: HTMLDivElement;
  private readonly menu: Menu;
  private readonly hud: Hud;
  private readonly pause: Pause;
  private readonly gameOver: GameOver;
  private readonly settings: Settings;
  private state: GameState = 'Boot';

  constructor(
    parent: HTMLElement,
    actions: ScreenActions,
    private readonly save: () => SaveState,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'ui-layer';
    parent.appendChild(this.root);
    this.menu = new Menu(this.root, {
      onPlay: actions.play,
      onSettings: () => this.openSettings(),
    });
    this.hud = new Hud(this.root, actions.togglePause);
    this.pause = new Pause(this.root, { onResume: actions.togglePause, onMenu: actions.toMenu });
    this.gameOver = new GameOver(this.root, { onRetry: actions.play, onMenu: actions.toMenu });
    this.settings = new Settings(this.root, {
      onChange: (patch) => {
        actions.changeSettings(patch);
        this.settings.render(this.save().settings);
      },
      onReplayTutorial: actions.replayTutorial,
      onBack: () => this.closeSettings(),
    });
  }

  /** Re-syncs the settings controls (e.g. after an async permission was refused). */
  refreshSettings(): void {
    this.settings.render(this.save().settings);
  }

  get settingsOpen(): boolean {
    return this.settings.visible;
  }

  onState(to: GameState): void {
    this.state = to;
    const save = this.save();
    this.settings.hide();
    this.menu.root.classList.toggle('hidden', to !== 'Menu');
    this.pause.root.classList.toggle('hidden', to !== 'Paused');
    if (to !== 'GameOver') this.gameOver.hide();
    if (to === 'Playing' || to === 'Paused') this.hud.show();
    else this.hud.hide();
    if (to === 'Menu') this.menu.setRecords(save.highScore, save.totalCoins);
  }

  showGameOver(stats: GameOverStats): void {
    this.gameOver.present(stats);
  }

  resetHud(): void {
    this.hud.reset();
  }

  updateHud(sim: Simulation): void {
    this.hud.update(sim);
  }

  private openSettings(): void {
    if (this.state !== 'Menu') return;
    this.menu.hide();
    this.settings.open(this.save().settings);
  }

  private closeSettings(): void {
    this.settings.hide();
    if (this.state === 'Menu') this.menu.show();
  }
}
