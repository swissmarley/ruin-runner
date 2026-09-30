/** A relic coin placed in track space. Pooled per segment; never allocated during play. */
export class Coin {
  s = 0;
  x = 0;
  y = 0;
  collected = false;
  /** True once a magnet has grabbed it; it then homes in on the player. */
  attracted = false;

  set(s: number, x: number, y: number): void {
    this.s = s;
    this.x = x;
    this.y = y;
    this.collected = false;
    this.attracted = false;
  }
}
