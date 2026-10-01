import * as THREE from 'three';

const W = 512;
const H = 256;

/** Atlas regions (u ranges) used by the vegetation geometry. */
export const FERN_U0 = 0;
export const FERN_U1 = 0.5;
export const LEAF_U0 = 0.5;
export const LEAF_U1 = 1;
/** A column of solid stem color in the middle of the fern frond. */
export const STEM_U = 0.25;

function fern(g: CanvasRenderingContext2D): void {
  const cx = W * 0.25;
  const top = 6;
  const bottom = H - 4;
  const len = bottom - top;
  // Leaflets from base to tip, both sides, angled toward the tip.
  for (let i = 0; i < 30; i++) {
    const t = i / 29;
    const y = bottom - t * len;
    const size =
      Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.04)), 0.6) * 108 * (1 - t * 0.4);
    for (const side of [-1, 1]) {
      g.save();
      g.translate(cx + side * 2, y);
      g.rotate(side * (Math.PI / 2 - 0.45));
      const grad = g.createLinearGradient(0, 0, 0, -size);
      grad.addColorStop(0, '#2f5a1e');
      grad.addColorStop(0.7, '#5c8d2c');
      grad.addColorStop(1, '#8ab040');
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(0, -size / 2, Math.max(3, size * 0.2), size / 2, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(30, 50, 15, 0.6)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -size * 0.9);
      g.stroke();
      g.restore();
    }
  }
  g.strokeStyle = '#4a5a22';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(cx, bottom + 4);
  g.lineTo(cx, top);
  g.stroke();
}

function broadLeaf(g: CanvasRenderingContext2D): void {
  const cx = W * 0.75;
  const top = 8;
  const bottom = H - 8;
  const w = W * 0.22;
  const grad = g.createLinearGradient(cx - w, 0, cx + w, 0);
  grad.addColorStop(0, '#2c5a1c');
  grad.addColorStop(0.5, '#4f8a2a');
  grad.addColorStop(1, '#2c5a1c');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(cx, bottom);
  g.bezierCurveTo(cx - w * 1.1, bottom - 40, cx - w, top + 60, cx, top);
  g.bezierCurveTo(cx + w, top + 60, cx + w * 1.1, bottom - 40, cx, bottom);
  g.fill();
  g.strokeStyle = 'rgba(190, 220, 120, 0.55)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx, bottom);
  g.lineTo(cx, top + 10);
  g.stroke();
  g.lineWidth = 1.5;
  for (let i = 1; i < 9; i++) {
    const y = bottom - (i / 9) * (bottom - top) * 0.9;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx, y);
      g.quadraticCurveTo(cx + side * w * 0.4, y - 10, cx + side * w * 0.75, y - 28);
      g.stroke();
    }
  }
}

/**
 * Hand-painted (procedurally drawn) foliage atlas: left half a fern frond, right half a
 * broad tropical leaf. Alpha-tested, so leaf edges stay crisp at any distance.
 */
export function createLeafTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  fern(g);
  broadLeaf(g);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.flipY = true;
  return tex;
}
