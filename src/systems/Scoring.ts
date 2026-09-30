import { COIN_POINTS, COINS_PER_MULT_STEP, MULT_MAX, MULT_STEP } from '../config';

/**
 * Score = distance × multiplier + coin points. The multiplier grows by `MULT_STEP` for every
 * `COINS_PER_MULT_STEP` relic coins collected this run (capped at `MULT_MAX`).
 */
export class Scoring {
  score = 0;
  coins = 0;
  distance = 0;

  reset(): void {
    this.score = 0;
    this.coins = 0;
    this.distance = 0;
  }

  get multiplier(): number {
    return multiplierFor(this.coins);
  }

  addDistance(meters: number): void {
    this.distance += meters;
    this.score += meters * this.multiplier;
  }

  addCoin(): void {
    this.coins++;
    this.score += COIN_POINTS;
  }

  /** Final integer score. */
  get total(): number {
    return Math.floor(this.score);
  }
}

export function multiplierFor(coins: number): number {
  const steps = Math.floor(coins / COINS_PER_MULT_STEP);
  return Math.min(MULT_MAX, 1 + steps * MULT_STEP);
}
