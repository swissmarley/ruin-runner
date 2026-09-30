import { Rng } from '../core/Rng';
import { makeNoise } from './Sfx';

const BPM = 96;
const BARS = 8;
const BEATS = BARS * 4;
const SAMPLE_RATE = 32000;
/** D minor pentatonic across two octaves (Hz). */
const SCALE = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0, 523.25];

function pluck(
  ctx: OfflineAudioContext,
  out: AudioNode,
  t: number,
  freq: number,
  vel: number,
): void {
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o2.type = 'triangle';
  o.frequency.value = freq;
  o2.frequency.value = freq * 2.01;
  const g2 = ctx.createGain();
  g2.gain.value = 0.25;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  o.connect(g);
  o2.connect(g2).connect(g);
  g.connect(out);
  o.start(t);
  o2.start(t);
  o.stop(t + 1);
  o2.stop(t + 1);
}

function drum(ctx: OfflineAudioContext, out: AudioNode, t: number, f0: number, vel: number): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + 0.25);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.4);
}

function shaker(
  ctx: OfflineAudioContext,
  out: AudioNode,
  noiseBuf: AudioBuffer,
  t: number,
  vel: number,
): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  src.connect(f).connect(g).connect(out);
  src.start(t, (t * 3.7) % 0.5);
  src.stop(t + 0.1);
}

/**
 * Renders a seamless 8-bar ambient loop (drone, pentatonic plucks, hand drums, shaker)
 * offline once at startup, so playback is a single looping buffer with no scheduling.
 */
export async function renderMusicLoop(): Promise<AudioBuffer> {
  const beat = 60 / BPM;
  const length = BEATS * beat;
  const ctx = new OfflineAudioContext(2, Math.ceil(length * SAMPLE_RATE), SAMPLE_RATE);
  const bus = ctx.createGain();
  bus.gain.value = 0.6;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = beat * 0.75;
  const fb = ctx.createGain();
  fb.gain.value = 0.3;
  const wet = ctx.createGain();
  wet.gain.value = 0.25;
  bus.connect(ctx.destination);
  bus.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(wet).connect(ctx.destination);

  // Drone: D + A with a slow swell, continuous across the loop boundary.
  for (const [f, v] of [
    [73.42, 0.14],
    [110, 0.08],
  ] as const) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = v;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1 / (beat * 8);
    const lg = ctx.createGain();
    lg.gain.value = v * 0.5;
    lfo.connect(lg).connect(g.gain);
    o.connect(g).connect(bus);
    o.start(0);
    lfo.start(0);
  }

  const rng = new Rng(0x5eed);
  const noiseBuf = makeNoise(ctx, 1);
  let note = 4;
  for (let b = 0; b < BEATS; b++) {
    const t = b * beat;
    const bar = Math.floor(b / 4);
    const inBar = b % 4;
    if (inBar === 0 || inBar === 2) drum(ctx, bus, t, 110, 0.5);
    if (inBar === 1 && bar % 2 === 1) drum(ctx, bus, t + beat * 0.5, 160, 0.3);
    if (inBar === 3) drum(ctx, bus, t + beat * 0.5, 140, 0.25);
    for (let e = 0; e < 2; e++)
      shaker(ctx, bus, noiseBuf, t + e * beat * 0.5, e === 0 ? 0.05 : 0.09);
    // Melody: a gentle random walk over the scale, resting now and then.
    if (rng.chance(0.7)) {
      note = Math.max(0, Math.min(SCALE.length - 1, note + rng.int(-2, 2)));
      pluck(ctx, bus, t, SCALE[note]!, 0.12);
    }
    if (rng.chance(0.3)) pluck(ctx, bus, t + beat * 0.5, SCALE[Math.max(0, note - 2)]!, 0.07);
  }
  return ctx.startRendering();
}
