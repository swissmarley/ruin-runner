import * as THREE from 'three';
import { createDetailTexture } from './art/DetailTexture';
import type { SurfaceUniforms } from './art/Surface';
import { applySurface } from './art/Surface';

/** Art palette: sun-warmed sandstone and gold against a hazy, green jungle gorge. */
export const PALETTE = {
  fog: 0x86a096,
  skyTop: 0x2c6cb8,
  skyHorizon: 0xf3cf96,
  skyHorizonCool: 0xc9dde0,
  sun: 0xffd6a0,
  hemiSky: 0xbfd6ea,
  hemiGround: 0x4a3a28,
  stone: 0xbba585,
  stoneDark: 0x8a7a62,
  stoneLight: 0xd8c6a4,
  moss: 0x5f7f3a,
  mossDark: 0x3f5a2a,
  vine: 0x3f7a35,
  wood: 0x7a5432,
  torchFlame: 0xffa040,
  gold: 0xf2c14e,
  goldDark: 0xb5832a,
  iron: 0x3c3a38,
  abyss: 0x1c2326,
  foliage: 0x3d6b2c,
  foliageLight: 0x6b9440,
} as const;

function uniforms(detail: THREE.Texture, moss: number, glow = 1): SurfaceUniforms {
  return {
    uDetail: { value: detail },
    uMoss: { value: moss },
    uGlow: { value: glow },
    uDepthFog: { value: 1 / 26 },
  };
}

function surface(
  u: SurfaceUniforms,
  objectSpace: boolean,
  vertexColors: boolean,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors, roughness: 0.85, metalness: 0 });
  applySurface(mat, u, objectSpace);
  return mat;
}

/** Shared materials, created once. Every solid surface runs the procedural PBR shader. */
export class Materials {
  readonly detail = createDetailTexture();
  /** Merged ruins, obstacles and props (vertex colors + per-vertex surface kind). */
  readonly stone = surface(uniforms(this.detail, 0.5), false, true);
  /** Instanced track slabs and curbs (instance colors only, sparser moss underfoot). */
  readonly track = surface(uniforms(this.detail, 0.15), false, false);
  /** The explorer: pattern pinned to each limb so cloth and leather don't swim. */
  readonly character = surface(uniforms(this.detail, 0), true, true);
  /** Stone Warden: object-space runestone with animated ember veins. */
  readonly wardenUniforms = uniforms(this.detail, 0.7, 1);
  readonly warden = surface(this.wardenUniforms, true, true);
  readonly flame = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });

  dispose(): void {
    this.detail.dispose();
    this.stone.dispose();
    this.track.dispose();
    this.character.dispose();
    this.warden.dispose();
    this.flame.dispose();
  }
}
