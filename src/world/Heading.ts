/**
 * Headings are quarter turns: 0 = −Z (initial forward), 1 = +X, 2 = +Z, 3 = −X.
 * A right turn adds 1, a left turn subtracts 1. The "right" vector of heading h is DIR[h + 1].
 */
export const DIR_X: readonly number[] = [0, 1, 0, -1];
export const DIR_Z: readonly number[] = [-1, 0, 1, 0];

export function turnHeading(heading: number, dir: -1 | 1): number {
  return (heading + dir + 4) & 3;
}

export function rightOf(heading: number): number {
  return (heading + 1) & 3;
}

/** Y-axis rotation that makes a −Z-facing object face along `heading`. */
export function headingYaw(heading: number): number {
  return -heading * (Math.PI / 2);
}

/**
 * A straight coordinate frame on the path: world = origin + dir·(s − startS) + right·x.
 */
export class PathFrame {
  originX = 0;
  originZ = 0;
  heading = 0;
  startS = 0;

  set(originX: number, originZ: number, heading: number, startS: number): void {
    this.originX = originX;
    this.originZ = originZ;
    this.heading = heading;
    this.startS = startS;
  }

  copy(other: PathFrame): void {
    this.set(other.originX, other.originZ, other.heading, other.startS);
  }

  worldX(s: number, x: number): number {
    return (
      this.originX + DIR_X[this.heading]! * (s - this.startS) + DIR_X[rightOf(this.heading)]! * x
    );
  }

  worldZ(s: number, x: number): number {
    return (
      this.originZ + DIR_Z[this.heading]! * (s - this.startS) + DIR_Z[rightOf(this.heading)]! * x
    );
  }
}
