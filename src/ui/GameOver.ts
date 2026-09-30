import type { DeathCause } from '../sim/Simulation';
import { button, el, formatInt, Overlay } from './dom';

const CAUSE_TEXT: Record<DeathCause, string> = {
  none: 'Run over',
  missedTurn: 'You ran into the wall',
  wrongTurn: 'Wrong way!',
  pit: 'You fell into the depths',
  obstacle: 'You crashed',
  caught: 'The Stone Warden caught you',
};

export interface GameOverStats {
  cause: DeathCause;
  score: number;
  best: number;
  newBest: boolean;
  coins: number;
  distance: number;
}

export interface GameOverActions {
  onRetry(): void;
  onMenu(): void;
}

/** End-of-run summary with instant Retry and Menu. */
export class GameOver extends Overlay {
  private readonly title: HTMLHeadingElement;
  private readonly score: HTMLElement;
  private readonly best: HTMLElement;
  private readonly coins: HTMLElement;
  private readonly distance: HTMLElement;
  private readonly badge: HTMLElement;
  private readonly retry: HTMLButtonElement;

  constructor(parent: HTMLElement, actions: GameOverActions) {
    super(parent, 'gameover');
    const card = el('div', 'card');
    this.title = el('h2', 'go-title');
    this.badge = el('div', 'badge hidden', 'New best!');
    const stats = el('div', 'stats');
    this.score = this.stat(stats, 'Score');
    this.best = this.stat(stats, 'Best');
    this.coins = this.stat(stats, 'Relics');
    this.distance = this.stat(stats, 'Distance');
    this.retry = button('Retry', 'primary', actions.onRetry);
    const menu = button('Menu', 'secondary', actions.onMenu);
    const buttons = el('div', 'buttons');
    buttons.append(this.retry, menu);
    card.append(this.title, this.badge, stats, buttons);
    this.root.appendChild(card);
  }

  private stat(parent: HTMLElement, label: string): HTMLElement {
    const box = el('div', 'stat');
    const value = el('b', '', '0');
    box.append(el('span', '', label), value);
    parent.appendChild(box);
    return value;
  }

  present(s: GameOverStats): void {
    this.title.textContent = CAUSE_TEXT[s.cause];
    this.score.textContent = formatInt(s.score);
    this.best.textContent = formatInt(s.best);
    this.coins.textContent = `+${formatInt(s.coins)}`;
    this.distance.textContent = `${formatInt(s.distance)} m`;
    this.badge.classList.toggle('hidden', !s.newBest);
    this.show();
    this.retry.focus({ preventScroll: true });
  }
}
