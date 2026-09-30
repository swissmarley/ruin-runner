import {
  KEEP_BEHIND,
  SEGMENT_POOL_SIZE,
  SPAWN_AHEAD,
  STUMBLE_WINDOW,
  SURGE_GRACE_TIME,
  SURGE_SPEED_MULT,
} from '../config';
import { Player } from '../entities/Player';
import { PowerUpTimers } from '../entities/PowerUp';
import { Pursuer } from '../entities/Pursuer';
import type { CollisionHandler, HitKind } from '../systems/Collision';
import { checkCollisions } from '../systems/Collision';
import { distanceAtTime, speedAt } from '../systems/Difficulty';
import { Scoring } from '../systems/Scoring';
import { nextCorner } from '../systems/Turns';
import { DIR_X, DIR_Z, PathFrame } from '../world/Heading';
import type { Obstacle, Segment } from '../world/Segment';
import { SegmentPool } from '../world/SegmentPool';
import { TrackGenerator } from '../world/TrackGenerator';
import { Controls } from './Controls';
import type { Dir } from './InputBuffer';
import { updatePickups } from './Pickups';
import { SimEvents } from './SimEvents';

export type DeathCause = 'none' | 'missedTurn' | 'wrongTurn' | 'pit' | 'obstacle' | 'caught';

/**
 * The complete game logic, headless and deterministic for a (seed, input sequence) pair.
 * Everything is in track space; `px/pz` are derived world coordinates for rendering.
 */
export class Simulation implements CollisionHandler {
  readonly player = new Player();
  readonly powerUps = new PowerUpTimers();
  readonly pursuer = new Pursuer();
  readonly scoring = new Scoring();
  readonly pool = new SegmentPool(SEGMENT_POOL_SIZE);
  readonly generator: TrackGenerator;
  /** Frame of the straight run the player is currently on. */
  readonly frame = new PathFrame();
  readonly events = new SimEvents();
  readonly controls: Controls;

  seed = 0;
  /** Path distance travelled (meters). */
  s = 0;
  prevS = 0;
  startS = 0;
  speed = 0;
  elapsed = 0;
  tick = 0;
  alive = true;
  deathCause: DeathCause = 'none';

  px = 0;
  pz = 0;
  prevPx = 0;
  prevPz = 0;
  /** Visual offset (old − new world position) produced by the latest turn. */
  turnOffsetX = 0;
  turnOffsetZ = 0;

  /** Elapsed time of the last stumble (-Infinity = none yet). */
  lastStumbleAt = Number.NEGATIVE_INFINITY;
  stumbles = 0;
  /** Seconds of post-surge invulnerability left. */
  graceTime = 0;

  constructor(seed: number) {
    this.generator = new TrackGenerator(seed);
    this.controls = new Controls(this);
    this.reset(seed);
  }

  /** Starts a new run. `startTime` > 0 begins mid-curve (used by tests to probe high speeds). */
  reset(seed: number, startTime = 0): void {
    this.seed = seed >>> 0;
    this.startS = distanceAtTime(startTime);
    this.generator.reset(this.seed, this.startS);
    this.pool.clear();
    this.player.reset();
    this.powerUps.reset();
    this.pursuer.reset();
    this.scoring.reset();
    this.controls.reset();
    this.frame.set(0, 0, 0, this.startS);
    this.events.clear();
    this.s = this.prevS = this.startS;
    this.elapsed = startTime;
    this.tick = 0;
    this.speed = speedAt(startTime);
    this.alive = true;
    this.deathCause = 'none';
    this.lastStumbleAt = Number.NEGATIVE_INFINITY;
    this.stumbles = 0;
    this.graceTime = 0;
    this.turnOffsetX = this.turnOffsetZ = 0;
    this.generator.fill(this.pool, this.s + SPAWN_AHEAD);
    this.updateWorldPosition();
    this.prevPx = this.px;
    this.prevPz = this.pz;
  }

  /** Metres run in this attempt. */
  get distance(): number {
    return this.s - this.startS;
  }

  get invulnerable(): boolean {
    return this.powerUps.surge > 0 || this.graceTime > 0;
  }

  /** True while a second stumble would let the pursuer catch the player. */
  get recentlyStumbled(): boolean {
    return this.elapsed - this.lastStumbleAt <= STUMBLE_WINDOW;
  }

  /** Queues a directional input; it is applied at the start of the next tick. */
  pushInput(dir: Dir): void {
    this.controls.push(dir);
  }

  /** The next corner the player has not turned yet (null if none streamed in). */
  upcomingCorner(): Segment | null {
    return nextCorner(this.pool, this.controls.lastTurnedId);
  }

  step(dt: number): void {
    if (!this.alive) return;
    this.tick++;
    this.elapsed += dt;
    this.speed = speedAt(this.elapsed) * (this.powerUps.surge > 0 ? SURGE_SPEED_MULT : 1);
    this.prevS = this.s;
    this.prevPx = this.px;
    this.prevPz = this.pz;

    this.controls.process(dt);
    if (!this.alive) return;
    const wasAirborne = !this.player.grounded;
    this.player.update(dt);
    if (wasAirborne && this.player.grounded) this.events.push('land');
    this.s += this.speed * dt;
    this.scoring.addDistance(this.speed * dt);
    this.tickPowerUps(dt);
    this.pursuer.update(dt, this.player.x);
    const turned = this.controls.updateTurn(this.powerUps.surge > 0);
    if (!this.alive) return;
    checkCollisions(this.pool, this.player, this.s, this.prevS, this);
    if (!this.alive) return;
    updatePickups(this, dt);
    this.stream();
    this.updateWorldPosition();
    if (turned) {
      // Keep interpolation continuous along the new heading.
      const h = this.frame.heading;
      this.prevPx = this.px - DIR_X[h]! * (this.s - this.prevS);
      this.prevPz = this.pz - DIR_Z[h]! * (this.s - this.prevS);
    }
  }

  die(cause: DeathCause): void {
    if (!this.alive) return;
    this.alive = false;
    this.deathCause = cause;
    this.events.push('death');
  }

  onObstacleHit(o: Obstacle, kind: HitKind): void {
    if (kind === 'pit') {
      // Surge carries the runner across gaps; nothing else saves a fall.
      if (this.powerUps.surge > 0) return;
      this.die('pit');
      return;
    }
    o.hit = true;
    if (this.invulnerable) {
      this.events.push('surgeSmash');
      return;
    }
    if (kind === 'sideHit') this.player.setLane(this.player.previousLane, false);
    if (this.powerUps.shield > 0) {
      this.powerUps.shield = 0;
      this.events.push('shieldBreak');
      return;
    }
    if (kind === 'fatal') this.die('obstacle');
    else this.stumble();
  }

  private stumble(): void {
    if (this.recentlyStumbled) {
      this.pursuer.onCaught();
      this.die('caught');
      return;
    }
    this.lastStumbleAt = this.elapsed;
    this.stumbles++;
    this.pursuer.onStumble();
    this.events.push('stumble');
  }

  private tickPowerUps(dt: number): void {
    const hadSurge = this.powerUps.surge > 0;
    this.powerUps.tick(dt);
    if (hadSurge && this.powerUps.surge <= 0) this.graceTime = SURGE_GRACE_TIME;
    else if (this.graceTime > 0) this.graceTime = Math.max(0, this.graceTime - dt);
  }

  private stream(): void {
    const pool = this.pool;
    while (pool.count > 0 && pool.at(0).endS < this.s - KEEP_BEHIND) pool.releaseOldest();
    this.generator.fill(pool, this.s + SPAWN_AHEAD);
  }

  private updateWorldPosition(): void {
    this.px = this.frame.worldX(this.s, this.player.x);
    this.pz = this.frame.worldZ(this.s, this.player.x);
  }
}
