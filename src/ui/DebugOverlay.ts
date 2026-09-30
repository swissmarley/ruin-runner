import { el } from './dom';

export interface DebugStats {
  calls: number;
  triangles: number;
  segments: number;
  speed: number;
  seed: number;
  quality: string;
  pixelRatio: number;
}

/**
 * Developer overlay (toggle: backtick or a three-finger tap): FPS, frame time, draw calls,
 * triangles, active segments, speed, seed and current quality. Refreshes 4× per second.
 */
export class DebugOverlay {
  readonly root: HTMLPreElement;
  private visible = false;
  private acc = 0;
  private frames = 0;
  private worst = 0;

  constructor(parent: HTMLElement) {
    this.root = el('pre', 'debug-overlay hidden');
    parent.appendChild(this.root);
  }

  get shown(): boolean {
    return this.visible;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.classList.toggle('hidden', !this.visible);
  }

  /** Call every frame with the real frame time; `stats` is only read when refreshing. */
  tick(dt: number, stats: () => DebugStats): void {
    if (!this.visible) return;
    this.acc += dt;
    this.frames++;
    this.worst = Math.max(this.worst, dt);
    if (this.acc < 0.25) return;
    const s = stats();
    const fps = this.frames / this.acc;
    this.root.textContent =
      `FPS ${fps.toFixed(0)}  worst ${(this.worst * 1000).toFixed(1)} ms\n` +
      `draw calls ${s.calls}  tris ${(s.triangles / 1000).toFixed(1)}k\n` +
      `segments ${s.segments}  speed ${s.speed.toFixed(1)} m/s\n` +
      `quality ${s.quality} @${s.pixelRatio.toFixed(2)}x  seed ${s.seed}`;
    this.acc = 0;
    this.frames = 0;
    this.worst = 0;
  }
}
