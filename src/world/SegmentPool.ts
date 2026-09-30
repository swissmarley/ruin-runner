import { Segment } from './Segment';

/**
 * Fixed-capacity ring buffer of segments, ordered from oldest (behind the player)
 * to newest (furthest ahead). Slots are reused forever; nothing is allocated after construction.
 */
export class SegmentPool {
  readonly slots: Segment[] = [];
  private head = 0;
  private size = 0;

  constructor(readonly capacity: number) {
    for (let i = 0; i < capacity; i++) this.slots.push(new Segment(i));
  }

  get count(): number {
    return this.size;
  }

  get isFull(): boolean {
    return this.size >= this.capacity;
  }

  /** i-th active segment counting from the oldest. */
  at(i: number): Segment {
    return this.slots[(this.head + i) % this.capacity]!;
  }

  get newest(): Segment | null {
    return this.size === 0 ? null : this.at(this.size - 1);
  }

  /** Claims the next slot at the tail. Callers must check `isFull` first. */
  acquire(): Segment {
    if (this.isFull) throw new Error('SegmentPool exhausted');
    const seg = this.slots[(this.head + this.size) % this.capacity]!;
    this.size++;
    return seg;
  }

  releaseOldest(): void {
    if (this.size === 0) return;
    this.head = (this.head + 1) % this.capacity;
    this.size--;
  }

  clear(): void {
    this.head = 0;
    this.size = 0;
    for (const s of this.slots) s.id = -1;
  }

  /** Index (from oldest) of the segment containing path distance `s`, or -1. */
  indexAt(s: number): number {
    for (let i = 0; i < this.size; i++) {
      const seg = this.at(i);
      if (s >= seg.startS && s < seg.endS) return i;
    }
    return -1;
  }
}
