/**
 * Joint-angle poses for the explorer (pure math, no Three.js). Angles in radians; positive X
 * rotation swings a hanging limb forward (−Z) and tips the torso back. Poses are flat
 * Float32Arrays so blending never allocates.
 */
export const J = {
  bodyY: 0,
  bodyRX: 1,
  bodyRZ: 2,
  hipsRX: 3,
  hipsRY: 4,
  hipsRZ: 5,
  spineRX: 6,
  spineRY: 7,
  spineRZ: 8,
  headRX: 9,
  headRY: 10,
  shLX: 11,
  shLZ: 12,
  elL: 13,
  shRX: 14,
  shRZ: 15,
  elR: 16,
  thL: 17,
  knL: 18,
  anL: 19,
  thR: 20,
  knR: 21,
  anR: 22,
  thLZ: 23,
  thRZ: 24,
} as const;

export const JOINTS = 25;
export type Pose = Float32Array;

export function createPose(): Pose {
  return new Float32Array(JOINTS);
}

/** One leg of the run cycle: writes thigh, knee and ankle for phase `p`. */
function runLeg(out: Pose, p: number, th: number, kn: number, an: number): void {
  const s = Math.sin(p);
  const swing = Math.max(0, Math.cos(p + 0.35));
  const thigh = 0.22 + 0.8 * s;
  const knee = -(0.22 + 1.6 * Math.pow(swing, 1.4));
  // Foot roughly flat in stance, toe down through the swing, heel first at contact.
  const footPitch = 0.25 * s - 0.4 * swing;
  out[th] = thigh;
  out[kn] = knee;
  out[an] = footPitch - thigh - knee;
}

/** Running stride at phase `phase` (one full cycle = left + right step). */
export function runPose(out: Pose, phase: number): void {
  out.fill(0);
  const s = Math.sin(phase);
  runLeg(out, phase, J.thL, J.knL, J.anL);
  runLeg(out, phase + Math.PI, J.thR, J.knR, J.anR);
  out[J.bodyY] = 0.05 * Math.cos(2 * (phase - 0.35)) - 0.02;
  out[J.hipsRX] = -0.06;
  out[J.hipsRY] = -0.18 * s;
  out[J.hipsRZ] = 0.04 * s;
  out[J.spineRX] = -0.2 + 0.035 * Math.cos(2 * phase);
  out[J.spineRY] = 0.32 * s;
  out[J.headRX] = 0.2;
  out[J.headRY] = -0.13 * s;
  out[J.shLX] = -0.05 - 0.75 * s;
  out[J.shRX] = -0.05 + 0.75 * s;
  out[J.shLZ] = -0.12;
  out[J.shRZ] = 0.12;
  out[J.elL] = 1.3 - 0.35 * s;
  out[J.elR] = 1.3 + 0.35 * s;
  out[J.thLZ] = -0.03;
  out[J.thRZ] = 0.03;
}

/** Airborne: `rise` = 1 going up (knee drive), 0 coming down (legs reaching for the ground). */
export function jumpPose(out: Pose, rise: number): void {
  out.fill(0);
  const f = 1 - rise;
  out[J.hipsRX] = -0.1;
  out[J.spineRX] = -0.12 - 0.08 * rise;
  out[J.headRX] = 0.15;
  out[J.thL] = 1.25 * rise + 0.75 * f;
  out[J.knL] = -1.55 * rise - 0.75 * f;
  out[J.anL] = -0.3;
  out[J.thR] = -0.5 * rise + 0.25 * f;
  out[J.knR] = -1.35 * rise - 0.95 * f;
  out[J.anR] = -0.45;
  out[J.shLX] = -0.7 * rise + 1.0 * f;
  out[J.shLZ] = -0.2 - 0.5 * f;
  out[J.elL] = 0.7;
  out[J.shRX] = 1.7 * rise + 1.0 * f;
  out[J.shRZ] = 0.2 + 0.5 * f;
  out[J.elR] = 0.6 + 0.3 * rise;
}

/** Feet-first power slide, leaning back under the beam (head stays below ~0.9 m). */
export function slidePose(out: Pose, t: number): void {
  out.fill(0);
  out[J.bodyY] = -0.6;
  out[J.hipsRX] = 0.55;
  out[J.spineRX] = 0.5 + 0.03 * Math.sin(t * 30);
  out[J.spineRY] = -0.15;
  out[J.headRX] = -0.8;
  out[J.thL] = 0.62;
  out[J.knL] = -0.05;
  out[J.anL] = 0.35;
  out[J.thR] = -0.3;
  out[J.knR] = -2.2;
  out[J.anR] = -0.5;
  out[J.thRZ] = 0.15;
  out[J.shLX] = -1.6;
  out[J.shLZ] = -0.35;
  out[J.elL] = 0.2;
  out[J.shRX] = 1.1;
  out[J.shRZ] = 0.45;
  out[J.elR] = 0.9;
}

/** Collapsed face-down after a fatal hit. */
export function fallenPose(out: Pose): void {
  out.fill(0);
  out[J.bodyRX] = -1.48;
  out[J.bodyY] = 0.02;
  out[J.headRX] = 0.6;
  out[J.headRY] = 0.5;
  out[J.shLX] = 2.6;
  out[J.shLZ] = -0.4;
  out[J.elL] = 0.5;
  out[J.shRX] = 2.3;
  out[J.shRZ] = 0.5;
  out[J.elR] = 0.9;
  out[J.knL] = -0.4;
  out[J.thR] = 0.15;
  out[J.knR] = -0.9;
}

/** out = a + (b − a) · w, joint by joint. */
export function blendPose(out: Pose, a: Pose, b: Pose, w: number): void {
  for (let i = 0; i < JOINTS; i++) out[i] = a[i]! + (b[i]! - a[i]!) * w;
}

/** Moves `value` toward `target` with time constant `rate` (1/s), frame-rate independent. */
export function approach(value: number, target: number, rate: number, dt: number): number {
  return value + (target - value) * (1 - Math.exp(-rate * dt));
}
