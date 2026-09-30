import { INPUT_BUFFER_TIME } from '../config';

export type Dir = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';

/**
 * Holds a single input for a short time so that inputs made slightly too early
 * (e.g. jumping just before landing) still count.
 */
export class InputBuffer {
  dir: Dir | null = null;
  age = 0;

  constructor(readonly lifetime: number = INPUT_BUFFER_TIME) {}

  push(dir: Dir): void {
    this.dir = dir;
    this.age = 0;
  }

  consume(): void {
    this.dir = null;
    this.age = 0;
  }

  /** Ages the buffered input and drops it once it expires. */
  tick(dt: number): void {
    if (this.dir === null) return;
    this.age += dt;
    if (this.age > this.lifetime) this.consume();
  }
}
