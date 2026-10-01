import type * as THREE from 'three';

/**
 * Surface kinds, stored per vertex in the `surf` attribute. One shader handles all of them so
 * merged meshes (stone + wood + gold in one draw call) still get per-part materials.
 */
export const SURF = {
  stone: 0,
  masonry: 1,
  drum: 2,
  wood: 3,
  iron: 4,
  gold: 5,
  leaf: 6,
  cloth: 7,
  skin: 8,
  leather: 9,
  glow: 10,
  runestone: 11,
  bark: 12,
} as const;

export type SurfKind = (typeof SURF)[keyof typeof SURF];

export interface SurfaceUniforms {
  [name: string]: { value: unknown };
  uDetail: { value: THREE.Texture };
  /** 0 = clean stone, 1 = heavily overgrown. */
  uMoss: { value: number };
  /** Emissive multiplier for glow / rune veins (animated for the Warden). */
  uGlow: { value: number };
  /** Height fog density below the walkway (1 / meters to full fog). */
  uDepthFog: { value: number };
}

const VERT_PARS = /* glsl */ `
attribute float surf;
varying float vSurf;
varying vec3 vSurfPos;
varying vec3 vSurfNrm;
`;

const VERT_MAIN = /* glsl */ `
vSurf = surf;
#ifdef SURF_OBJECT
  vSurfPos = transformed;
  vSurfNrm = objectNormal;
#else
  vec4 sWp = vec4(transformed, 1.0);
  vec3 sWn = objectNormal;
  #ifdef USE_INSTANCING
    sWp = instanceMatrix * sWp;
    sWn = mat3(instanceMatrix) * sWn;
  #endif
  vSurfPos = (modelMatrix * sWp).xyz;
  vSurfNrm = mat3(modelMatrix) * sWn;
#endif
`;

const FRAG_PARS = /* glsl */ `
uniform sampler2D uDetail;
uniform float uMoss;
uniform float uGlow;
uniform float uDepthFog;
varying float vSurf;
varying vec3 vSurfPos;
varying vec3 vSurfNrm;

float sIs(float id) { return step(abs(vSurf - id), 0.5); }

vec4 sTri(vec3 p, vec3 w) {
  return texture2D(uDetail, p.zy) * w.x + texture2D(uDetail, p.xz) * w.y
    + texture2D(uDetail, p.xy) * w.z;
}

// Running-bond masonry: x = distance to the nearest joint (m), y = per-block random.
vec2 sMasonry(vec2 p, vec2 size) {
  vec2 q = p / size;
  q.x += fract(floor(q.y) * 0.5);
  vec2 cell = floor(q);
  vec2 f = fract(q);
  vec2 e = min(f, 1.0 - f) * size;
  return vec2(min(e.x, e.y), fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453));
}

// Bump mapping from a height field in meters (screen-space derivatives, scale invariant).
vec3 sPerturb(vec3 pos, vec3 n, float h, float faceDir) {
  vec3 dpx = dFdx(pos);
  vec3 dpy = dFdy(pos);
  float lx = max(length(dpx), 1e-6);
  float ly = max(length(dpy), 1e-6);
  vec3 sx = dpx / lx;
  vec3 sy = dpy / ly;
  vec2 dh = vec2(dFdx(h) / lx, dFdy(h) / ly);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * n - grad);
}
`;

const FRAG_SURFACE = /* glsl */ `
vec3 sN = normalize(vSurfNrm);
vec3 sP = vSurfPos;
vec3 sW = pow(abs(sN), vec3(4.0));
sW /= dot(sW, vec3(1.0));
vec4 dMac = sTri(sP * 0.11, sW);
vec4 dMic = sTri(sP * 0.6, sW);
vec4 dFin = sTri(sP * 2.3, sW);

float isMason = sIs(1.0);
float isDrum = sIs(2.0);
float isRune = sIs(11.0);
float isStone = sIs(0.0) + isMason + isDrum + isRune;
float isWood = sIs(3.0);
float isIron = sIs(4.0);
float isGold = sIs(5.0);
float isLeaf = sIs(6.0);
float isCloth = sIs(7.0);
float isSkin = sIs(8.0);
float isLeather = sIs(9.0);
float isGlow = sIs(10.0);
float isBark = sIs(12.0);

// Joints: masonry blocks on the dominant face, horizontal bands on column drums.
bool sTop = abs(sN.y) > 0.7;
vec2 mUv = sTop ? sP.xz : (abs(sN.x) > abs(sN.z) ? sP.zy : sP.xy);
vec2 mSize = sTop ? vec2(1.25, 0.85) : vec2(1.1, 0.52);
vec2 mas = sMasonry(mUv + (dMac.r - 0.5) * 0.18, mSize);
float drumF = fract(sP.y / 0.95 + dMac.r * 0.05);
float drumD = min(drumF, 1.0 - drumF) * 0.95;
float jd = mix(mix(9.0, mas.x, isMason), drumD, isDrum);
float jaa = fwidth(jd) + 0.012;
float joint = 1.0 - smoothstep(0.022, 0.022 + jaa, jd);
float bevel = smoothstep(0.0, 0.08, jd);

float crackMask = smoothstep(0.55, 0.75, dMac.a + 0.12 * isRune) * (1.0 - joint);
float crackW = fwidth(dMac.b) * 1.5;
float crack = (1.0 - smoothstep(0.012, 0.012 + crackW + 0.02, dMac.b)) * crackMask;
float veinW = fwidth(dMac.b) + 0.015;
float vein = (1.0 - smoothstep(0.01, 0.01 + veinW, dMac.b)) * smoothstep(0.3, 0.55, dMic.a)
  + (1.0 - smoothstep(0.01, 0.03, dMic.b)) * smoothstep(0.7, 0.85, dMac.a) * 0.6;

vec3 sA = diffuseColor.rgb;
float sH = 0.0;
float sRough = 0.85;
float sMetal = 0.0;
vec3 sEmit = vec3(0.0);

// Stone family.
float sTint = (0.7 + 0.6 * dMac.r) * (0.84 + 0.32 * dMic.g) * (1.0 + 0.22 * (mas.y - 0.5) * isMason);
vec3 aStone = sA * sTint * (1.0 - 0.6 * joint) * (1.0 - 0.45 * crack);
float hStone = bevel * 0.022 + (dMic.g - 0.5) * 0.014 + (dFin.g - 0.5) * 0.005 - crack * 0.012;

// Wood / bark: streaky grain with knots.
float grain = dFin.g * 0.6 + dMic.r * 0.4;
float knot = 1.0 - smoothstep(0.02, 0.1, dFin.b);
vec3 aWood = sA * (0.62 + 0.62 * grain) * (1.0 - 0.35 * knot);
float hWood = (grain - 0.5) * 0.012 - knot * 0.006;

vec3 aLeaf = sA * (0.55 + 0.75 * dMic.g) * (0.82 + 0.36 * dMac.r);
vec3 aSoft = sA * (0.86 + 0.26 * dFin.g) * (0.92 + 0.16 * dMac.r);
vec3 aLeather = sA * (0.78 + 0.38 * dMic.g) * (0.9 + 0.2 * dMac.r);
vec3 rust = vec3(0.16, 0.06, 0.02);
float rustAmt = smoothstep(0.55, 0.75, dMac.a) * isIron;

sA = aStone * isStone + aWood * (isWood + isBark) + aLeaf * isLeaf
  + aSoft * (isCloth + isSkin) + aLeather * isLeather
  + sA * (0.75 + 0.45 * dMic.g) * isIron + sA * (0.88 + 0.24 * dMic.g) * isGold
  + sA * 0.25 * isGlow;
sA = mix(sA, rust, rustAmt);
sH = hStone * isStone + hWood * isWood + (grain - 0.5) * 0.05 * isBark
  + (dMic.g * 0.03 + dFin.g * 0.015) * isLeaf + (dFin.g - 0.5) * 0.003 * isLeather;
sRough = (0.8 + 0.15 * dMic.r) * isStone + 0.72 * isWood + 0.92 * isBark + 0.72 * isLeaf
  + 0.92 * isCloth + 0.5 * isSkin + (0.5 + 0.2 * dMic.r) * isLeather
  + mix(0.42, 0.85, rustAmt) * isIron + (0.22 + 0.15 * dMic.r) * isGold + 0.6 * isGlow;
sMetal = mix(0.85, 0.1, rustAmt) * isIron + isGold;

// Moss grows on upward faces, in joints and cracks.
float mossScore = dMac.a * 0.8 + dMic.g * 0.2 + max(sN.y, 0.0) * 0.18 + joint * 0.14 + crack * 0.25;
float mossT = 1.0 - uMoss * 0.45;
float moss = smoothstep(mossT - 0.05, mossT + 0.05, mossScore) * (isStone + isBark) * step(0.01, uMoss);
vec3 mossCol = mix(vec3(0.03, 0.06, 0.012), vec3(0.13, 0.21, 0.035), dFin.g * (1.0 - 0.6 * joint));
sA = mix(sA, mossCol, moss);
sH += moss * (0.012 + dFin.g * 0.01);
sRough = mix(sRough, 0.95, moss);

// Emission: plain glow parts and the Warden's ember veins.
sEmit = diffuseColor.rgb * uGlow * 3.0 * isGlow
  + vec3(1.0, 0.36, 0.07) * uGlow * vein * isRune * (0.6 + 0.4 * dMac.r);
sA *= 1.0 - 0.7 * vein * isRune;
sEmit += sA * 0.04 * isSkin;

#ifndef SURF_OBJECT
  // Stonework sinking into the jungle depths gets darker and damper.
  float sDeep = clamp(-sP.y * 0.035, 0.0, 0.65);
  sA *= 1.0 - sDeep * 0.55;
#endif
diffuseColor.rgb = sA;
`;

const FRAG_DEPTH_FOG = /* glsl */ `
#include <fog_fragment>
#if defined( USE_FOG ) && !defined( SURF_OBJECT )
  float sFog = clamp(-vSurfPos.y * uDepthFog, 0.0, 1.0);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, sFog * (2.0 - sFog) * 0.94);
#endif
`;

/**
 * Patches a MeshStandardMaterial with the procedural surface shader: tri-planar detail,
 * masonry joints, cracks, moss, bump mapping and per-kind roughness/metalness/emission.
 * `objectSpace` pins the pattern to the mesh (for animated characters).
 */
export function applySurface(
  material: THREE.MeshStandardMaterial,
  uniforms: SurfaceUniforms,
  objectSpace: boolean,
): void {
  if (objectSpace) material.defines = { ...material.defines, SURF_OBJECT: '' };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_SURFACE}`)
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = sRough;',
      )
      .replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor = sMetal;',
      )
      .replace(
        '#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\nnormal = sPerturb(-vViewPosition, normal, sH, faceDirection);',
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += sEmit;',
      )
      .replace('#include <fog_fragment>', FRAG_DEPTH_FOG);
  };
  material.customProgramCacheKey = () => (objectSpace ? 'surf-object' : 'surf-world');
}
