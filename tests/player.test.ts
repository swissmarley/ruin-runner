import { describe, expect, it } from 'vitest';
import {
  DT,
  JUMP_DURATION,
  JUMP_HEIGHT,
  LANE_CHANGE_TIME,
  LANE_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_SLIDE_HEIGHT,
  SLIDE_DURATION,
} from '../src/config';
import { Player, jumpHeightAt, laneToX } from '../src/entities/Player';

function run(p: Player, seconds: number): void {
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i < ticks; i++) p.update(DT);
}

describe('lane logic', () => {
  it('starts centered', () => {
    const p = new Player();
    expect(p.lane).toBe(1);
    expect(p.x).toBe(0);
  });

  it('maps lanes to lateral offsets', () => {
    expect(laneToX(0)).toBeCloseTo(-LANE_WIDTH);
    expect(laneToX(1)).toBe(0);
    expect(laneToX(2)).toBeCloseTo(LANE_WIDTH);
  });

  it('changes lanes with an eased transition that completes in ~120 ms', () => {
    const p = new Player();
    expect(p.changeLane(1)).toBe(true);
    p.update(DT);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(LANE_WIDTH);
    // Ease-out: the first tick covers more than a linear share of the distance.
    expect(p.x / LANE_WIDTH).toBeGreaterThan(DT / LANE_CHANGE_TIME);
    run(p, LANE_CHANGE_TIME);
    expect(p.x).toBeCloseTo(LANE_WIDTH);
    expect(p.isChangingLane).toBe(false);
  });

  it('refuses to leave the track at either edge', () => {
    const p = new Player();
    expect(p.changeLane(-1)).toBe(true);
    expect(p.changeLane(-1)).toBe(false);
    expect(p.lane).toBe(0);
    p.reset();
    expect(p.changeLane(1)).toBe(true);
    expect(p.changeLane(1)).toBe(false);
    expect(p.lane).toBe(2);
  });

  it('can redirect mid-transition without snapping', () => {
    const p = new Player();
    p.changeLane(1);
    p.update(DT);
    const mid = p.x;
    p.changeLane(-1);
    p.update(DT);
    expect(p.x).toBeLessThan(mid);
    expect(p.x).toBeGreaterThan(0);
    run(p, LANE_CHANGE_TIME);
    expect(p.x).toBeCloseTo(0);
  });

  it('setLane(instant) snaps and remembers the lane for bounce-back', () => {
    const p = new Player();
    p.changeLane(1);
    expect(p.previousLane).toBe(1);
    p.setLane(0, true);
    expect(p.x).toBeCloseTo(-LANE_WIDTH);
    expect(p.isChangingLane).toBe(false);
  });
});

describe('jump timing', () => {
  it('follows a parabola peaking at JUMP_HEIGHT mid-jump', () => {
    expect(jumpHeightAt(0)).toBe(0);
    expect(jumpHeightAt(JUMP_DURATION / 2)).toBeCloseTo(JUMP_HEIGHT);
    expect(jumpHeightAt(JUMP_DURATION)).toBe(0);
  });

  it('lasts exactly JUMP_DURATION and lands grounded', () => {
    const p = new Player();
    expect(p.jump()).toBe(true);
    expect(p.grounded).toBe(false);
    const ticks = Math.round(JUMP_DURATION / DT);
    for (let i = 0; i < ticks - 1; i++) {
      p.update(DT);
      expect(p.vertical).toBe('jump');
    }
    p.update(DT);
    expect(p.vertical).toBe('run');
    expect(p.y).toBe(0);
    expect(p.grounded).toBe(true);
  });

  it('cannot double-jump', () => {
    const p = new Player();
    p.jump();
    p.update(DT);
    expect(p.jump()).toBe(false);
  });

  it('can jump out of a slide', () => {
    const p = new Player();
    p.slide();
    p.update(DT);
    expect(p.jump()).toBe(true);
    expect(p.vertical).toBe('jump');
  });
});

describe('slide timing', () => {
  it('lasts exactly SLIDE_DURATION with a lowered collider', () => {
    const p = new Player();
    p.slide();
    expect(p.colliderHeight).toBe(PLAYER_SLIDE_HEIGHT);
    const ticks = Math.round(SLIDE_DURATION / DT);
    for (let i = 0; i < ticks - 1; i++) p.update(DT);
    expect(p.vertical).toBe('slide');
    p.update(DT);
    expect(p.vertical).toBe('run');
    expect(p.colliderHeight).toBe(PLAYER_HEIGHT);
  });

  it('fast-falls when a slide cancels a jump', () => {
    const p = new Player();
    p.jump();
    run(p, JUMP_DURATION / 2);
    expect(p.y).toBeGreaterThan(1);
    p.slide();
    expect(p.vertical).toBe('slide');
    // Reaches the floor far quicker than the remaining half-jump would.
    run(p, 0.1);
    expect(p.y).toBe(0);
    expect(p.grounded).toBe(true);
  });

  it('refuses a jump while still fast-falling', () => {
    const p = new Player();
    p.jump();
    run(p, JUMP_DURATION / 2);
    p.slide();
    p.update(DT);
    expect(p.y).toBeGreaterThan(0);
    expect(p.jump()).toBe(false);
  });
});
