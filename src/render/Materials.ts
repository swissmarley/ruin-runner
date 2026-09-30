import * as THREE from 'three';

/** Art palette: warm sandstone and torchlight against cool, misty jungle shade. */
export const PALETTE = {
  fog: 0x5d6f73,
  skyTop: 0x2c3e4f,
  skyHorizon: 0x9aa89a,
  sun: 0xffc98a,
  hemiSky: 0x8fb4d8,
  hemiGround: 0x5a4030,
  stone: 0xb49a78,
  stoneDark: 0x7d6a55,
  stoneLight: 0xcdb592,
  moss: 0x5f7f3a,
  mossDark: 0x3f5a2a,
  vine: 0x3f7a35,
  wood: 0x6b4a2b,
  torchFlame: 0xffa040,
  gold: 0xf2c14e,
  goldDark: 0xb5832a,
  abyss: 0x1c2326,
  foliage: 0x2f5a35,
  foliageLight: 0x4d7a3c,
} as const;

/** Shared materials, created once. Flat-shaded Lambert keeps mobile fragment cost low. */
export class Materials {
  readonly vertexColored = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  readonly instanced = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  readonly instancedVertex = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });
  readonly flame = new THREE.MeshBasicMaterial({ color: PALETTE.torchFlame, fog: false });
  readonly gold = new THREE.MeshLambertMaterial({
    color: PALETTE.gold,
    emissive: 0x6a4a10,
    flatShading: true,
  });
  readonly glow = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });

  dispose(): void {
    this.vertexColored.dispose();
    this.instanced.dispose();
    this.instancedVertex.dispose();
    this.flame.dispose();
    this.gold.dispose();
    this.glow.dispose();
  }
}
