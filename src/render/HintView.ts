import * as THREE from 'three';
import type { Simulation } from '../sim/Simulation';
import { WorldPoint, worldAt } from '../world/Track';
import type { HintKey } from '../world/Tutorial';
import { HINT_TEXT } from '../world/Tutorial';

/** Only the nearest upcoming lesson is shown so signs never overlap. */
const SIGNS = 1;
const SHOW_DISTANCE = 60;
const HEIGHT = 3.2;
/** Screen-space size (sizeAttenuation off): ~60 % of a portrait screen's width. */
const SIGN_W = 0.44;
const SIGN_H = 0.11;
const KEYS: readonly HintKey[] = ['jump', 'slide', 'lane', 'turn'];

function makeTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const g = canvas.getContext('2d')!;
  g.fillStyle = 'rgba(27, 20, 16, 0.82)';
  g.strokeStyle = '#f2c14e';
  g.lineWidth = 10;
  g.beginPath();
  g.roundRect(12, 12, 1000, 232, 48);
  g.fill();
  g.stroke();
  g.fillStyle = '#fff6e6';
  g.font = '800 88px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 512, 132, 940);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

/**
 * First-run tutorial prompts, drawn in the world as glowing signs floating above the track
 * ahead of each lesson. Textures are rendered once at start-up (touch or keyboard wording).
 */
export class HintView {
  readonly group = new THREE.Group();
  private readonly materials = new Map<HintKey, THREE.SpriteMaterial>();
  private readonly sprites: THREE.Sprite[] = [];
  private readonly wp = new WorldPoint();

  constructor() {
    const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    for (const key of KEYS) {
      const text = touch ? HINT_TEXT[key].touch : HINT_TEXT[key].keys;
      const mat = new THREE.SpriteMaterial({
        map: makeTexture(text),
        transparent: true,
        depthWrite: false,
        depthTest: false,
        fog: false,
        sizeAttenuation: false,
      });
      this.materials.set(key, mat);
    }
    for (let i = 0; i < SIGNS; i++) {
      const sprite = new THREE.Sprite(this.materials.get('jump')!);
      sprite.scale.set(SIGN_W, SIGN_H, 1);
      sprite.visible = false;
      sprite.renderOrder = 10;
      this.sprites.push(sprite);
      this.group.add(sprite);
    }
  }

  update(sim: Simulation, t: number): void {
    let used = 0;
    for (let i = 0; i < sim.pool.count && used < SIGNS; i++) {
      const seg = sim.pool.at(i);
      for (let k = 0; k < seg.hintCount && used < SIGNS; k++) {
        const hint = seg.hints[k]!;
        const ahead = hint.s - sim.s;
        if (ahead < 3 || ahead > SHOW_DISTANCE) continue;
        if (!worldAt(sim.pool, hint.s, 0, this.wp)) continue;
        const sprite = this.sprites[used++]!;
        const mat = this.materials.get(hint.text as HintKey);
        if (mat) sprite.material = mat;
        sprite.visible = true;
        sprite.position.set(this.wp.x, HEIGHT + Math.sin(t * 2.5) * 0.08, this.wp.z);
        // Fade in from the distance; fade out shortly before the runner reaches the sign.
        const fadeIn = Math.min(1, (SHOW_DISTANCE - ahead) / 12);
        const fadeOut = Math.min(1, (ahead - 3) / 8);
        sprite.material.opacity = Math.max(0, Math.min(fadeIn, fadeOut));
      }
    }
    for (let i = used; i < SIGNS; i++) this.sprites[i]!.visible = false;
  }
}
