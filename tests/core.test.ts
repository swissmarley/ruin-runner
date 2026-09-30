import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import { FixedStepLoop } from '../src/core/GameLoop';
import { StateMachine } from '../src/core/StateMachine';

describe('FixedStepLoop', () => {
  it('runs whole steps and returns the leftover as alpha', () => {
    const loop = new FixedStepLoop(1 / 60, 5);
    let steps = 0;
    const alpha = loop.advance(2.5 / 60, () => steps++);
    expect(steps).toBe(2);
    expect(alpha).toBeCloseTo(0.5);
  });

  it('accumulates sub-step frames', () => {
    const loop = new FixedStepLoop(1 / 60, 5);
    let steps = 0;
    for (let i = 0; i < 4; i++) loop.advance(1 / 240, () => steps++);
    expect(steps).toBe(1);
  });

  it('caps steps per frame and drops the backlog', () => {
    const loop = new FixedStepLoop(1 / 60, 5);
    let steps = 0;
    loop.advance(1, () => steps++);
    expect(steps).toBe(5);
    steps = 0;
    loop.advance(0, () => steps++);
    expect(steps).toBe(0);
  });

  it('is deterministic in total steps regardless of frame slicing', () => {
    const a = new FixedStepLoop(1 / 60, 10);
    const b = new FixedStepLoop(1 / 60, 10);
    let sa = 0;
    let sb = 0;
    for (let i = 0; i < 60; i++) a.advance(1 / 60, () => sa++);
    for (let i = 0; i < 40; i++) b.advance(1 / 40, () => sb++);
    expect(Math.abs(sa - sb)).toBeLessThanOrEqual(1);
  });
});

describe('StateMachine', () => {
  it('follows Boot → Menu → Playing → Paused → Playing → GameOver → Menu', () => {
    const sm = new StateMachine();
    const seen: string[] = [];
    sm.onChange((to) => seen.push(to));
    expect(sm.go('Menu')).toBe(true);
    expect(sm.go('Playing')).toBe(true);
    expect(sm.go('Paused')).toBe(true);
    expect(sm.go('Playing')).toBe(true);
    expect(sm.go('GameOver')).toBe(true);
    expect(sm.go('Menu')).toBe(true);
    expect(seen).toEqual(['Menu', 'Playing', 'Paused', 'Playing', 'GameOver', 'Menu']);
  });

  it('rejects invalid transitions', () => {
    const sm = new StateMachine();
    expect(sm.go('Playing')).toBe(false);
    expect(sm.state).toBe('Boot');
    sm.go('Menu');
    expect(sm.go('GameOver')).toBe(false);
    expect(sm.go('Paused')).toBe(false);
  });

  it('allows instant retry from GameOver', () => {
    const sm = new StateMachine();
    sm.go('Menu');
    sm.go('Playing');
    sm.go('GameOver');
    expect(sm.go('Playing')).toBe(true);
  });
});

describe('EventBus', () => {
  it('delivers payloads and supports unsubscribe', () => {
    const bus = new EventBus<{ score: number }>();
    const got: number[] = [];
    const off = bus.on('score', (v) => got.push(v));
    bus.emit('score', 1);
    off();
    bus.emit('score', 2);
    expect(got).toEqual([1]);
  });
});
