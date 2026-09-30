import { renderMusicLoop } from './Music';
import type { SfxContext, SfxName } from './Sfx';
import { makeNoise, playSfx } from './Sfx';

export type MusicMode = 'menu' | 'run' | 'off';

/** Seconds between the Warden's footfalls at full chase. */
const STEP_INTERVAL = 0.42;

/**
 * Web Audio front-end: lazy context creation on the first user gesture (mobile autoplay
 * rules), SFX/music buses with independent toggles, the looping music bed, and the Warden's
 * growl + footsteps whose loudness follows how close it is.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private sfx: SfxContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private growlGain: GainNode | null = null;
  private musicStarted = false;
  private sfxOn = true;
  private musicOn = true;
  private mode: MusicMode = 'menu';
  private stepTimer = 0;
  private coinStreak = 0;
  private coinTimer = 0;

  /** Must be called from a user-gesture handler; safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) this.create();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  setSfxEnabled(on: boolean): void {
    this.sfxOn = on;
    this.applyGains();
  }

  setMusicEnabled(on: boolean): void {
    this.musicOn = on;
    this.applyGains();
  }

  setMusicMode(mode: MusicMode): void {
    this.mode = mode;
    this.applyGains();
  }

  /** Pause/resume the whole audio graph (e.g. page hidden). */
  setSuspended(suspended: boolean): void {
    if (!this.ctx) return;
    if (suspended) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  play(name: SfxName, param = 0): void {
    if (!this.sfx || !this.sfxOn || !this.ready) return;
    if (name === 'coin') {
      this.coinStreak = this.coinTimer > 0 ? this.coinStreak + 1 : 0;
      this.coinTimer = 0.35;
      param = this.coinStreak;
    }
    playSfx(this.sfx, name, this.ctx!.currentTime + 0.005, param);
  }

  /**
   * Per-frame update: Warden growl volume and footsteps from `closeness` (0–1).
   * `chasing` is false outside of an active run.
   */
  update(dt: number, closeness: number, chasing: boolean): void {
    this.coinTimer = Math.max(0, this.coinTimer - dt);
    if (!this.ctx || !this.growlGain || !this.ready) return;
    const level = chasing && this.sfxOn ? closeness * closeness : 0;
    this.growlGain.gain.setTargetAtTime(level * 0.22, this.ctx.currentTime, 0.12);
    if (level <= 0.02) return;
    this.stepTimer -= dt;
    if (this.stepTimer <= 0) {
      this.stepTimer = STEP_INTERVAL;
      playSfx(this.sfx!, 'step', this.ctx.currentTime + 0.01, 0.1 + level * 0.6);
    }
  }

  private create(): void {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicBus.connect(this.musicFilter).connect(this.master);
    this.sfx = { ctx, out: this.sfxBus, noise: makeNoise(ctx, 1) };
    this.createGrowl(ctx);
    this.applyGains();
    void this.startMusic();
  }

  private createGrowl(ctx: AudioContext): void {
    this.growlGain = ctx.createGain();
    this.growlGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.Q.value = 4;
    const trem = ctx.createGain();
    trem.gain.value = 0.7;
    for (const f of [48, 51.5, 97]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(filter);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = ctx.createGain();
    depth.gain.value = 0.3;
    lfo.connect(depth).connect(trem.gain);
    lfo.start();
    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.35;
    const sweepDepth = ctx.createGain();
    sweepDepth.gain.value = 120;
    sweep.connect(sweepDepth).connect(filter.frequency);
    sweep.start();
    filter.connect(trem).connect(this.growlGain).connect(this.sfxBus!);
  }

  private async startMusic(): Promise<void> {
    if (this.musicStarted || !this.ctx || !this.musicBus) return;
    this.musicStarted = true;
    try {
      const buffer = await renderMusicLoop();
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(this.musicBus);
      src.start();
    } catch (err) {
      console.warn('Music unavailable:', err);
    }
  }

  private applyGains(): void {
    if (!this.ctx || !this.sfxBus || !this.musicBus || !this.musicFilter) return;
    const now = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.sfxOn ? 1 : 0, now, 0.05);
    const music = this.musicOn && this.mode !== 'off' ? (this.mode === 'menu' ? 0.55 : 0.4) : 0;
    this.musicBus.gain.setTargetAtTime(music, now, 0.3);
    this.musicFilter.frequency.setTargetAtTime(this.mode === 'menu' ? 1100 : 9000, now, 0.4);
  }
}
