import { describe, expect, it } from 'vitest';
import {
  COIN_POINTS,
  DT,
  MULT_MAX,
  PURSUER_FAR_GAP,
  PURSUER_NEAR_GAP,
  PURSUER_START_GAP,
  STUMBLE_WINDOW,
} from '../src/config';
import { Pursuer } from '../src/entities/Pursuer';
import {
  cornerChanceAt,
  difficultyAt,
  patternChanceAt,
  restSlotsAt,
  tierAt,
} from '../src/systems/Difficulty';
import { multiplierFor, Scoring } from '../src/systems/Scoring';

describe('Scoring', () => {
  it('scores distance at 1× with no coins', () => {
    const sc = new Scoring();
    sc.addDistance(100);
    expect(sc.total).toBe(100);
    expect(sc.multiplier).toBe(1);
  });

  it('adds flat points per coin and raises the multiplier every 20 coins', () => {
    const sc = new Scoring();
    for (let i = 0; i < 20; i++) sc.addCoin();
    expect(sc.coins).toBe(20);
    expect(sc.total).toBe(20 * COIN_POINTS);
    expect(sc.multiplier).toBeCloseTo(1.1);
    sc.addDistance(100);
    expect(sc.total).toBe(20 * COIN_POINTS + 110);
  });

  it('caps the multiplier', () => {
    expect(multiplierFor(0)).toBe(1);
    expect(multiplierFor(19)).toBe(1);
    expect(multiplierFor(40)).toBeCloseTo(1.2);
    expect(multiplierFor(1_000_000)).toBe(MULT_MAX);
  });

  it('resets between runs', () => {
    const sc = new Scoring();
    sc.addCoin();
    sc.addDistance(10);
    sc.reset();
    expect([sc.total, sc.coins, sc.distance]).toEqual([0, 0, 0]);
  });
});

describe('Pursuer', () => {
  const run = (p: Pursuer, seconds: number) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) p.update(DT, 0);
  };

  it('starts close then falls back out of frame', () => {
    const p = new Pursuer();
    expect(p.gap).toBe(PURSUER_START_GAP);
    expect(p.closeness).toBeGreaterThan(0.8);
    run(p, 5);
    expect(p.gap).toBeCloseTo(PURSUER_FAR_GAP);
    expect(p.closeness).toBe(0);
  });

  it('lunges in on a stumble and stays close for the stumble window', () => {
    const p = new Pursuer();
    run(p, 5);
    p.onStumble();
    run(p, 0.5);
    expect(p.gap).toBeLessThan(PURSUER_NEAR_GAP + 0.3);
    run(p, STUMBLE_WINDOW - 1);
    expect(p.closeness).toBeGreaterThan(0.6);
    run(p, 6);
    expect(p.gap).toBeCloseTo(PURSUER_FAR_GAP);
  });

  it('closes to grabbing distance when it catches the runner', () => {
    const p = new Pursuer();
    p.onCaught();
    run(p, 1);
    expect(p.gap).toBeLessThan(1);
    expect(p.caught).toBe(true);
  });

  it('follows the runner laterally with lag', () => {
    const p = new Pursuer();
    p.update(DT, 2.2);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(2.2);
  });
});

describe('Difficulty ramp', () => {
  it('unlocks pattern tiers progressively', () => {
    const tiers = [0, 30, 60, 120, 180].map((t) => tierAt(difficultyAt(t)));
    expect(tiers).toEqual([0, 1, 1, 2, 3]);
  });

  it('tightens spacing but never below one slot of rest', () => {
    expect(restSlotsAt(0)).toBeGreaterThan(restSlotsAt(1));
    expect(restSlotsAt(1)).toBeGreaterThanOrEqual(1);
  });

  it('adds more corners and patterns as it gets harder', () => {
    expect(cornerChanceAt(1)).toBeGreaterThan(cornerChanceAt(0));
    expect(patternChanceAt(1)).toBeGreaterThan(patternChanceAt(0));
    expect(patternChanceAt(1)).toBeLessThanOrEqual(1);
  });
});
