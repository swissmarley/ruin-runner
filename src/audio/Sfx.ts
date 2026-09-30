/**
 * Procedural one-shot sound effects. Each recipe builds a tiny, self-disposing node graph
 * scheduled at `t`. Noise comes from one shared pre-generated buffer.
 */

export type SfxName =
  | 'coin'
  | 'jump'
  | 'slide'
  | 'land'
  | 'lane'
  | 'turn'
  | 'stumble'
  | 'death'
  | 'powerup'
  | 'shieldBreak'
  | 'crumble'
  | 'smash'
  | 'step'
  | 'click';

export interface SfxContext {
  ctx: BaseAudioContext;
  out: AudioNode;
  noise: AudioBuffer;
}

export function makeNoise(ctx: BaseAudioContext, seconds = 1): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 0x1234567;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 4294967296) * 2 - 1;
  }
  return buf;
}

function env(g: AudioParam, t: number, peak: number, attack: number, decay: number): void {
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(peak, t + attack);
  g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(
  c: SfxContext,
  t: number,
  type: OscillatorType,
  f0: number,
  f1: number,
  peak: number,
  attack: number,
  decay: number,
): void {
  const o = c.ctx.createOscillator();
  const g = c.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + decay);
  env(g.gain, t, peak, attack, decay);
  o.connect(g).connect(c.out);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

function noise(
  c: SfxContext,
  t: number,
  type: BiquadFilterType,
  f0: number,
  f1: number,
  q: number,
  peak: number,
  attack: number,
  decay: number,
): void {
  const src = c.ctx.createBufferSource();
  src.buffer = c.noise;
  const f = c.ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + decay);
  const g = c.ctx.createGain();
  env(g.gain, t, peak, attack, decay);
  src.connect(f).connect(g).connect(c.out);
  const offset = (t * 7.31) % 0.5;
  src.start(t, offset);
  src.stop(t + attack + decay + 0.05);
}

/** Plays `name`; `param` tweaks some recipes (e.g. coin pitch climbs with a streak). */
export function playSfx(c: SfxContext, name: SfxName, t: number, param = 0): void {
  switch (name) {
    case 'coin': {
      const step = Math.min(param, 8);
      const base = 1320 * Math.pow(2, step / 24);
      tone(c, t, 'sine', base, base, 0.18, 0.003, 0.07);
      tone(c, t + 0.055, 'sine', base * 1.5, base * 1.5, 0.16, 0.003, 0.14);
      break;
    }
    case 'jump':
      noise(c, t, 'bandpass', 500, 2200, 1.5, 0.25, 0.01, 0.16);
      tone(c, t, 'triangle', 180, 320, 0.12, 0.005, 0.12);
      break;
    case 'slide':
      noise(c, t, 'bandpass', 1800, 400, 1.2, 0.28, 0.02, 0.35);
      break;
    case 'land':
      tone(c, t, 'sine', 120, 50, 0.3, 0.003, 0.12);
      noise(c, t, 'lowpass', 900, 200, 0.7, 0.12, 0.003, 0.1);
      break;
    case 'lane':
      noise(c, t, 'highpass', 2500, 1200, 0.8, 0.08, 0.005, 0.07);
      break;
    case 'turn':
      noise(c, t, 'bandpass', 700, 1600, 2, 0.2, 0.02, 0.2);
      break;
    case 'stumble':
      tone(c, t, 'sine', 90, 40, 0.5, 0.003, 0.25);
      noise(c, t, 'lowpass', 2200, 300, 0.9, 0.35, 0.003, 0.22);
      break;
    case 'death':
      tone(c, t, 'sawtooth', 300, 60, 0.18, 0.01, 0.8);
      noise(c, t, 'lowpass', 1800, 120, 0.8, 0.4, 0.005, 0.7);
      break;
    case 'powerup':
      for (let i = 0; i < 4; i++)
        tone(
          c,
          t + i * 0.06,
          'triangle',
          523 * Math.pow(1.26, i),
          523 * Math.pow(1.26, i),
          0.14,
          0.005,
          0.18,
        );
      break;
    case 'shieldBreak':
      noise(c, t, 'highpass', 5000, 2500, 0.6, 0.3, 0.002, 0.3);
      tone(c, t, 'sine', 1900, 900, 0.15, 0.002, 0.3);
      break;
    case 'crumble':
      noise(c, t, 'lowpass', 600, 80, 0.7, 0.45, 0.05, 1.1);
      tone(c, t + 0.05, 'sine', 70, 35, 0.3, 0.02, 0.8);
      break;
    case 'smash':
      noise(c, t, 'lowpass', 3000, 400, 0.8, 0.35, 0.002, 0.25);
      tone(c, t, 'square', 140, 60, 0.08, 0.002, 0.15);
      break;
    case 'step':
      tone(c, t, 'sine', 70, 32, Math.max(0.0002, param), 0.004, 0.22);
      noise(c, t, 'lowpass', 400, 90, 0.6, Math.max(0.0002, param * 0.6), 0.004, 0.18);
      break;
    case 'click':
      tone(c, t, 'triangle', 900, 700, 0.08, 0.002, 0.05);
      break;
  }
}
