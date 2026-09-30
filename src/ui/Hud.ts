import { POWERUP_DURATION } from '../config';
import type { PowerUpKind } from '../entities/PowerUp';
import { POWERUP_KINDS } from '../entities/PowerUp';
import type { Simulation } from '../sim/Simulation';
import { el, formatInt } from './dom';

const LABEL: Record<PowerUpKind, string> = { magnet: 'Magnet', shield: 'Shield', surge: 'Surge' };

interface Timer {
  root: HTMLElement;
  bar: HTMLElement;
  shown: boolean;
  width: number;
}

/**
 * In-run HUD: distance, score, relics, multiplier, active power-up timers and a
 * thumb-sized pause button. DOM writes happen only when a displayed value changes.
 */
export class Hud {
  readonly root: HTMLDivElement;
  private readonly distance: HTMLElement;
  private readonly score: HTMLElement;
  private readonly coins: HTMLElement;
  private readonly mult: HTMLElement;
  private readonly timers: Record<PowerUpKind, Timer>;
  private last = { distance: -1, score: -1, coins: -1, mult: -1 };

  constructor(parent: HTMLElement, onPause: () => void) {
    this.root = el('div', 'hud hidden');
    const top = el('div', 'hud-top');
    const left = el('div', 'hud-left');
    this.distance = el('div', 'hud-distance', '0 m');
    this.score = el('div', 'hud-score', '0');
    left.append(this.score, this.distance);
    const right = el('div', 'hud-right');
    const coinRow = el('div', 'hud-coins');
    coinRow.append(el('span', 'coin-icon'));
    this.coins = el('span', '', '0');
    coinRow.append(this.coins);
    this.mult = el('div', 'hud-mult', '×1.0');
    right.append(coinRow, this.mult);
    const pause = el('button', 'hud-pause');
    pause.type = 'button';
    pause.setAttribute('aria-label', 'Pause');
    pause.addEventListener('click', (e) => {
      e.stopPropagation();
      onPause();
    });
    pause.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    top.append(left, right, pause);
    const timers = el('div', 'hud-timers');
    this.timers = {} as Record<PowerUpKind, Timer>;
    for (const kind of POWERUP_KINDS) {
      const root = el('div', `timer timer-${kind} hidden`);
      const bar = el('div', 'timer-bar');
      const track = el('div', 'timer-track');
      track.append(bar);
      root.append(el('span', 'timer-label', LABEL[kind]), track);
      timers.append(root);
      this.timers[kind] = { root, bar, shown: false, width: -1 };
    }
    this.root.append(top, timers);
    parent.appendChild(this.root);
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  update(sim: Simulation): void {
    const sc = sim.scoring;
    const distance = Math.floor(sim.distance);
    if (distance !== this.last.distance) {
      this.last.distance = distance;
      this.distance.textContent = `${formatInt(distance)} m`;
    }
    const score = sc.total;
    if (score !== this.last.score) {
      this.last.score = score;
      this.score.textContent = formatInt(score);
    }
    if (sc.coins !== this.last.coins) {
      this.last.coins = sc.coins;
      this.coins.textContent = formatInt(sc.coins);
    }
    const mult = Math.round(sc.multiplier * 10);
    if (mult !== this.last.mult) {
      this.last.mult = mult;
      this.mult.textContent = `×${(mult / 10).toFixed(1)}`;
    }
    for (let i = 0; i < POWERUP_KINDS.length; i++) {
      const kind = POWERUP_KINDS[i]!;
      this.updateTimer(this.timers[kind], sim.powerUps[kind]);
    }
  }

  private updateTimer(t: Timer, remaining: number): void {
    const on = remaining > 0;
    if (on !== t.shown) {
      t.shown = on;
      t.root.classList.toggle('hidden', !on);
    }
    if (!on) return;
    const width = Math.round((remaining / POWERUP_DURATION) * 100);
    if (width !== t.width) {
      t.width = width;
      t.bar.style.transform = `scaleX(${width / 100})`;
    }
  }

  reset(): void {
    this.last = { distance: -1, score: -1, coins: -1, mult: -1 };
  }
}
