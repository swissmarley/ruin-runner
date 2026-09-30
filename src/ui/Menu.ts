import { button, el, formatInt, Overlay } from './dom';

export interface MenuActions {
  onPlay(): void;
  onSettings(): void;
}

/** Title screen: Play, Settings and the best score. */
export class Menu extends Overlay {
  private readonly best: HTMLElement;
  private readonly coins: HTMLElement;

  constructor(parent: HTMLElement, actions: MenuActions) {
    super(parent, 'menu');
    const card = el('div', 'card title-card');
    const logo = el('h1', 'logo');
    logo.append(el('span', 'logo-top', 'Ruin'), el('span', 'logo-bottom', 'Runner'));
    const tagline = el('p', 'tagline', 'Flee the Stone Warden through the endless ruins.');
    const play = button('Play', 'primary big', actions.onPlay);
    const settings = button('Settings', 'secondary', actions.onSettings);
    const records = el('div', 'records');
    this.best = el('b', '', '0');
    this.coins = el('b', '', '0');
    const bestBox = el('div', 'record');
    bestBox.append(el('span', '', 'Best'), this.best);
    const coinBox = el('div', 'record');
    coinBox.append(el('span', '', 'Relics'), this.coins);
    records.append(bestBox, coinBox);
    const hint = el('p', 'controls-hint', 'Swipe or use arrows / WASD / Space');
    card.append(logo, tagline, play, settings, records, hint);
    this.root.appendChild(card);
  }

  setRecords(best: number, totalCoins: number): void {
    this.best.textContent = formatInt(best);
    this.coins.textContent = formatInt(totalCoins);
  }
}
