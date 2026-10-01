import { describe, expect, it } from 'vitest';
import {
  approach,
  blendPose,
  createPose,
  J,
  JOINTS,
  jumpPose,
  runPose,
  slidePose,
} from '../src/render/character/Pose';

describe('explorer poses', () => {
  it('run cycle alternates legs and swings arms against them', () => {
    const p = createPose();
    runPose(p, Math.PI / 2);
    expect(p[J.thL]).toBeGreaterThan(0.8);
    expect(p[J.thR]).toBeLessThan(-0.4);
    expect(p[J.shLX]).toBeLessThan(0);
    expect(p[J.shRX]).toBeGreaterThan(0);
  });

  it('run cycle is periodic and finite', () => {
    const a = createPose();
    const b = createPose();
    for (let phase = 0; phase < Math.PI * 2; phase += 0.1) {
      runPose(a, phase);
      runPose(b, phase + Math.PI * 2);
      for (let i = 0; i < JOINTS; i++) {
        expect(Number.isFinite(a[i])).toBe(true);
        expect(a[i]).toBeCloseTo(b[i]!, 4);
      }
    }
  });

  it('swing leg tucks the knee, stance leg stays nearly straight', () => {
    const p = createPose();
    runPose(p, -0.35);
    expect(p[J.knL]).toBeLessThan(-1.5);
    runPose(p, Math.PI);
    expect(p[J.knL]).toBeGreaterThan(-0.4);
  });

  it('slide drops the body low and leans back; jump drives a knee up', () => {
    const p = createPose();
    slidePose(p, 0);
    expect(p[J.bodyY]).toBeLessThan(-0.5);
    expect(p[J.hipsRX]! + p[J.spineRX]!).toBeGreaterThan(0.9);
    jumpPose(p, 1);
    expect(p[J.thL]).toBeGreaterThan(1);
    expect(p[J.knL]).toBeLessThan(-1.2);
  });

  it('blends joint by joint and approaches targets frame-rate independently', () => {
    const a = createPose();
    const b = createPose().fill(2);
    const out = createPose();
    blendPose(out, a, b, 0.25);
    expect(out[J.elL]).toBeCloseTo(0.5);
    let x = 0;
    for (let i = 0; i < 60; i++) x = approach(x, 1, 10, 1 / 60);
    let y = 0;
    for (let i = 0; i < 30; i++) y = approach(y, 1, 10, 1 / 30);
    expect(x).toBeCloseTo(y, 6);
  });
});
