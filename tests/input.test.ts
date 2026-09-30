import { describe, expect, it } from 'vitest';
import { DT, INPUT_BUFFER_TIME, JUMP_DURATION } from '../src/config';
import { SwipeDetector } from '../src/input/SwipeDetector';
import { InputBuffer } from '../src/sim/InputBuffer';
import { Simulation } from '../src/sim/Simulation';

describe('SwipeDetector', () => {
  it('fires on touchmove once the finger passes 30 px', () => {
    const s = new SwipeDetector(30);
    s.start(1, 100, 100);
    expect(s.move(1, 120, 100)).toBeNull();
    expect(s.move(1, 131, 102)).toBe('RIGHT');
    // Only one swipe per touch.
    expect(s.move(1, 200, 100)).toBeNull();
    expect(s.end(1, 200, 100)).toBeNull();
  });

  it('uses the dominant axis', () => {
    const s = new SwipeDetector(30);
    s.start(1, 0, 0);
    expect(s.move(1, 25, -40)).toBe('UP');
    s.start(2, 0, 0);
    expect(s.move(2, -45, 30)).toBe('LEFT');
    s.start(3, 0, 0);
    expect(s.move(3, 10, 50)).toBe('DOWN');
  });

  it('can still fire at touchend for very fast flicks', () => {
    const s = new SwipeDetector(30);
    s.start(1, 0, 0);
    expect(s.end(1, 0, 60)).toBe('DOWN');
  });

  it('ignores other touch ids and short taps', () => {
    const s = new SwipeDetector(30);
    s.start(1, 0, 0);
    expect(s.move(2, 100, 0)).toBeNull();
    expect(s.end(1, 10, 5)).toBeNull();
  });
});

describe('InputBuffer', () => {
  it('expires after the buffer lifetime', () => {
    const b = new InputBuffer(0.15);
    b.push('UP');
    b.tick(0.1);
    expect(b.dir).toBe('UP');
    b.tick(0.06);
    expect(b.dir).toBeNull();
  });
});

describe('Simulation input buffering', () => {
  it('applies a jump pressed slightly before landing', () => {
    const sim = new Simulation(1);
    sim.pushInput('UP');
    sim.step(DT);
    expect(sim.player.vertical).toBe('jump');
    // Advance to ~100 ms before landing, then press jump again.
    const ticks = Math.round((JUMP_DURATION - 0.1) / DT) - 1;
    for (let i = 0; i < ticks; i++) sim.step(DT);
    sim.pushInput('UP');
    sim.step(DT);
    expect(sim.controls.buffer.dir).toBe('UP');
    for (let i = 0; i < Math.round(0.12 / DT); i++) sim.step(DT);
    expect(sim.player.vertical).toBe('jump');
    expect(sim.controls.buffer.dir).toBeNull();
  });

  it('drops a jump pressed too early', () => {
    const sim = new Simulation(1);
    sim.pushInput('UP');
    sim.step(DT);
    sim.pushInput('UP');
    const ticks = Math.round((INPUT_BUFFER_TIME + 0.05) / DT);
    for (let i = 0; i < ticks; i++) sim.step(DT);
    expect(sim.controls.buffer.dir).toBeNull();
    for (let i = 0; i < Math.round(JUMP_DURATION / DT); i++) sim.step(DT);
    expect(sim.player.vertical).toBe('run');
  });

  it('moves forward at the starting speed and changes lanes', () => {
    const sim = new Simulation(3);
    sim.pushInput('LEFT');
    for (let i = 0; i < 60; i++) sim.step(DT);
    expect(sim.player.lane).toBe(0);
    expect(sim.s).toBeGreaterThan(7.9);
    expect(sim.s).toBeLessThan(8.3);
  });
});
