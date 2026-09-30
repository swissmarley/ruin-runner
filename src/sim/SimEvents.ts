export type SimEventType =
  | 'jump'
  | 'slide'
  | 'lane'
  | 'turn'
  | 'land'
  | 'bump'
  | 'stumble'
  | 'death'
  | 'coin'
  | 'powerup'
  | 'shieldBreak'
  | 'crumble'
  | 'surgeSmash';

const CAPACITY = 64;

/**
 * Per-tick event queue from the simulation to presentation (audio, effects, HUD).
 * Preallocated; `push` never allocates. The consumer drains and clears it each frame.
 */
export class SimEvents {
  readonly types: SimEventType[] = new Array<SimEventType>(CAPACITY).fill('jump');
  readonly values = new Float64Array(CAPACITY);
  count = 0;

  push(type: SimEventType, value = 0): void {
    if (this.count >= CAPACITY) return;
    this.types[this.count] = type;
    this.values[this.count] = value;
    this.count++;
  }

  clear(): void {
    this.count = 0;
  }
}
