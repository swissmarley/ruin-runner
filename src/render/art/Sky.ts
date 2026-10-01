import * as THREE from 'three';
import { PALETTE } from '../Materials';

/** World-space direction toward the sun: low golden-hour sun behind the runner's right. */
export const SUN_DIR = new THREE.Vector3(0.55, 0.5, 0.42).normalize();

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uDetail;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uHorizonCool;
uniform vec3 uHaze;
uniform float uTime;
varying vec3 vDir;

float ridge(float u, float period, float v, float base, float amp) {
  float n = textureLod(uDetail, vec2(u * period, v), 0.0).r;
  float f = textureLod(uDetail, vec2(u * period * 6.0, v + 0.37), 0.0).g;
  return base + amp * pow(n, 2.2) + amp * 0.18 * f;
}

void main() {
  vec3 d = normalize(vDir);
  float e = d.y;
  float sunDot = max(dot(d, uSunDir), 0.0);

  // Gradient: hazy horizon to deep zenith, warmed toward the sun.
  vec2 flat2 = normalize(d.xz + 1e-5);
  float sunSide = max(dot(flat2, normalize(uSunDir.xz)), 0.0);
  vec3 horizon = mix(uHorizonCool, uHorizon, sunSide * sunSide);
  vec3 col = mix(horizon, uTop, pow(smoothstep(0.0, 0.65, e), 0.6));
  col = mix(col, uHaze, smoothstep(0.08, 0.0, e));
  col += uSunColor * (pow(sunDot, 5.0) * 0.35 + pow(sunDot, 48.0) * 0.9);

  // Soft drifting clouds, lit from the sun side.
  if (e > 0.0) {
    vec2 cuv = d.xz / (e + 0.18) * 0.09 + vec2(uTime * 0.0015, uTime * 0.0006);
    float c = textureLod(uDetail, cuv, 0.0).r * 0.7 + textureLod(uDetail, cuv * 3.1, 0.0).g * 0.3;
    float cover = smoothstep(0.5, 0.78, c) * smoothstep(0.02, 0.3, e);
    vec3 cloud = mix(uHaze * 1.12, vec3(1.0, 0.9, 0.76) * 1.25, pow(sunDot, 2.0) * 0.8 + 0.2);
    col = mix(col, cloud, cover * 0.75);
  }
  // Sun disc (HDR so bloom picks it up).
  col += uSunColor * smoothstep(0.9993, 0.9997, sunDot) * 10.0;

  // Distant jungle ranges, receding into the haze.
  float u = atan(d.z, d.x) / 6.2831853 + 0.5;
  float far = ridge(u, 3.0, 0.21, 0.025, 0.12);
  float near = ridge(u, 5.0, 0.73, 0.005, 0.075);
  vec3 farCol = mix(uHaze, uTop * 0.9 + vec3(0.05, 0.07, 0.04), 0.28);
  vec3 nearCol = mix(uHaze, vec3(0.08, 0.13, 0.07), 0.45);
  float farMask = smoothstep(far + 0.002, far - 0.002, e);
  float nearMask = smoothstep(near + 0.002, near - 0.002, e);
  col = mix(col, mix(uHaze, farCol, smoothstep(-0.02, far, e)), farMask);
  col = mix(col, mix(uHaze, nearCol, smoothstep(-0.02, near, e)), nearMask);

  // Below the horizon: the misty gorge (exactly the fog color, so fogged geometry blends in).
  col = mix(col, uHaze, smoothstep(0.0, -0.02, e));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export interface SkyUniforms {
  [name: string]: { value: unknown };
  uTime: { value: number };
}

/** Creates the sky dome mesh (radius `radius`) sharing `detail` for clouds and ridgelines. */
export function createSky(detail: THREE.Texture, radius: number): THREE.Mesh {
  const color = (hex: number) => new THREE.Color(hex);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uDetail: { value: detail },
      uSunDir: { value: SUN_DIR },
      uSunColor: { value: color(PALETTE.sun) },
      uTop: { value: color(PALETTE.skyTop) },
      uHorizon: { value: color(PALETTE.skyHorizon) },
      uHorizonCool: { value: color(PALETTE.skyHorizonCool) },
      uHaze: { value: color(PALETTE.fog) },
      uTime: { value: 0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

/** Prefiltered environment map of the sky for PBR reflections and ambient light. */
export function createEnvironmentMap(
  renderer: THREE.WebGLRenderer,
  detail: THREE.Texture,
): THREE.Texture {
  const scene = new THREE.Scene();
  const sky = createSky(detail, 50);
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.02, 0.1, 200);
  pmrem.dispose();
  sky.geometry.dispose();
  (sky.material as THREE.Material).dispose();
  return target.texture;
}
