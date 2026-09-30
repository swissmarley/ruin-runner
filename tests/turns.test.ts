import { describe, expect, it } from 'vitest';
import { DT } from '../src/config';
import { Simulation } from '../src/sim/Simulation';
import { turnWindowEnd, turnWindowStart } from '../src/systems/Turns';
import type { Segment } from '../src/world/Segment';
import { advance, advanceUntil, emptyTrack } from './helpers';

function setup(seed = 5): { sim: Simulation; corner: Segment } {
  const sim = new Simulation(seed);
  emptyTrack(sim);
  const corner = sim.upcomingCorner();
  if (!corner) throw new Error('expected a corner within the spawn horizon');
  return { sim, corner };
}

const dirOf = (c: Segment) => (c.turnDir < 0 ? 'LEFT' : 'RIGHT');
const wrongOf = (c: Segment) => (c.turnDir < 0 ? 'RIGHT' : 'LEFT');

describe('turns', () => {
  it('turns when swiping the right way inside the window', () => {
    const { sim, corner } = setup();
    const heading = sim.frame.heading;
    advanceUntil(sim, () => sim.s >= turnWindowStart(corner, sim.speed) + 1);
    sim.pushInput(dirOf(corner));
    advanceUntil(sim, () => sim.controls.lastTurnedId === corner.id, 5);
    expect(sim.alive).toBe(true);
    expect(sim.frame.heading).toBe(corner.exitHeading);
    expect(sim.frame.heading).not.toBe(heading);
    expect(sim.player.lane).toBe(1);
  });

  it('turns at the pivot even if the swipe came early in the window', () => {
    const { sim, corner } = setup();
    advanceUntil(sim, () => sim.s >= turnWindowStart(corner, sim.speed));
    sim.pushInput(dirOf(corner));
    sim.step(DT);
    expect(sim.controls.queuedTurnId).toBe(corner.id);
    expect(sim.controls.lastTurnedId).not.toBe(corner.id);
    advanceUntil(sim, () => sim.s >= corner.pivotS);
    sim.step(DT);
    expect(sim.controls.lastTurnedId).toBe(corner.id);
  });

  it('buffers a turn swiped just before the window opens', () => {
    const { sim, corner } = setup();
    advanceUntil(sim, () => sim.s >= turnWindowStart(corner, sim.speed) - sim.speed * 0.08);
    sim.pushInput(dirOf(corner));
    sim.step(DT);
    expect(sim.player.lane).toBe(1); // not consumed as a lane change
    advance(sim, 0.2);
    expect(sim.controls.queuedTurnId === corner.id || sim.controls.lastTurnedId === corner.id).toBe(
      true,
    );
  });

  it('ends the run when the player never turns', () => {
    const { sim, corner } = setup();
    advanceUntil(sim, () => !sim.alive, 60);
    expect(sim.alive).toBe(false);
    expect(sim.deathCause).toBe('missedTurn');
    expect(sim.s).toBeGreaterThan(corner.pivotS);
    expect(sim.s).toBeLessThanOrEqual(turnWindowEnd(corner) + sim.speed * DT);
  });

  it('ends the run on a wrong-way swipe inside the corner', () => {
    const { sim, corner } = setup();
    advanceUntil(sim, () => sim.s >= corner.startS + 0.5);
    sim.pushInput(wrongOf(corner));
    sim.step(DT);
    expect(sim.alive).toBe(false);
    expect(sim.deathCause).toBe('wrongTurn');
  });

  it('treats lateral swipes far from corners as lane changes', () => {
    const { sim } = setup();
    sim.pushInput('LEFT');
    sim.step(DT);
    expect(sim.player.lane).toBe(0);
    expect(sim.alive).toBe(true);
  });

  it('emits a visual offset so the renderer can blend the turn', () => {
    const { sim, corner } = setup();
    advanceUntil(sim, () => sim.s >= corner.startS);
    sim.pushInput(dirOf(corner));
    advanceUntil(sim, () => !sim.alive || sim.controls.lastTurnedId === corner.id, 3);
    expect(sim.controls.lastTurnedId).toBe(corner.id);
    expect(Number.isFinite(sim.turnOffsetX)).toBe(true);
    expect(Number.isFinite(sim.turnOffsetZ)).toBe(true);
  });
});
