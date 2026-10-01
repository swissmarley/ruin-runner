import * as THREE from 'three';
import { createSky } from './art/Sky';
import { PALETTE } from './Materials';

const MIST_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const MIST_FRAG = /* glsl */ `
uniform sampler2D uDetail;
uniform vec3 uColor;
uniform vec3 uCam;
uniform float uTime;
uniform float uOpacity;
uniform float uScale;
varying vec3 vWorld;
void main() {
  vec2 uv = vWorld.xz * uScale + vec2(uTime * 0.006, uTime * 0.0025);
  float n = texture2D(uDetail, uv).r * 0.6 + texture2D(uDetail, uv * 2.7 + 0.31).a * 0.4;
  float a = smoothstep(0.45, 0.85, n) * uOpacity;
  a *= smoothstep(170.0, 70.0, length(vWorld.xz - uCam.xz));
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

const MOTE_VERT = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime;
uniform vec3 uCenter;
uniform float uScale;
varying float vAlpha;
void main() {
  const float BOX = 26.0;
  vec3 drift = vec3(sin(uTime * 0.31 + aSeed.y * 9.0), uTime * 0.12, cos(uTime * 0.23 + aSeed.x * 7.0));
  vec3 p = aSeed * BOX + drift;
  p = mod(p - uCenter + BOX * 0.5, BOX) - BOX * 0.5 + uCenter;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  vAlpha = (0.45 + 0.55 * sin(uTime * 2.0 + aSeed.z * 30.0))
    * smoothstep(26.0, 8.0, depth) * smoothstep(2.5, 5.0, depth);
  gl_PointSize = min(uScale * (0.6 + aSeed.z) / depth, uScale * 0.12);
  gl_Position = projectionMatrix * mv;
}`;

const MOTE_FRAG = /* glsl */ `
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.25, 0.0, dot(d, d)) * vAlpha;
  gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * 1.6, a);
}`;

const MOTES = 140;

/**
 * Sky dome (gradient, sun, clouds, distant ranges), drifting mist layers in the gorge and
 * sunlit dust motes around the camera. Everything follows the camera.
 */
export class Environment {
  readonly group = new THREE.Group();
  private readonly sky: THREE.Mesh;
  private readonly mists: THREE.Mesh[] = [];
  private readonly mistUniforms: { uTime: { value: number }; uCam: { value: THREE.Vector3 } }[] =
    [];
  private readonly motes: THREE.Points;
  private readonly moteUniforms = {
    uTime: { value: 0 },
    uCenter: { value: new THREE.Vector3() },
    uScale: { value: 300 },
  };
  private time = 0;

  constructor(detail: THREE.Texture) {
    this.sky = createSky(detail, 140);
    this.group.add(this.sky);

    const haze = new THREE.Color(PALETTE.fog);
    const layers = [
      { y: -7, opacity: 0.4, scale: 0.016, tint: 1.1 },
      { y: -14, opacity: 0.65, scale: 0.011, tint: 1.03 },
    ];
    for (const l of layers) {
      const u = {
        uDetail: { value: detail },
        uColor: { value: haze.clone().multiplyScalar(l.tint) },
        uCam: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uOpacity: { value: l.opacity },
        uScale: { value: l.scale },
      };
      const mist = new THREE.Mesh(
        new THREE.PlaneGeometry(360, 360),
        new THREE.ShaderMaterial({
          vertexShader: MIST_VERT,
          fragmentShader: MIST_FRAG,
          uniforms: u,
          transparent: true,
          depthWrite: false,
          fog: false,
        }),
      );
      mist.rotation.x = -Math.PI / 2;
      mist.position.y = l.y;
      mist.frustumCulled = false;
      this.mists.push(mist);
      this.mistUniforms.push(u);
      this.group.add(mist);
    }

    const seeds = new Float32Array(MOTES * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.abs(seeds[i]!);
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
    moteGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    this.motes = new THREE.Points(
      moteGeo,
      new THREE.ShaderMaterial({
        vertexShader: MOTE_VERT,
        fragmentShader: MOTE_FRAG,
        uniforms: this.moteUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.motes.frustumCulled = false;
    this.group.add(this.motes);
  }

  setViewportHeight(px: number): void {
    this.moteUniforms.uScale.value = px * 0.05;
  }

  /** Keeps the sky, mist and motes centered on the camera. */
  follow(dt: number, x: number, y: number, z: number): void {
    this.time += dt;
    this.sky.position.set(x, y, z);
    (this.sky.material as THREE.ShaderMaterial).uniforms.uTime!.value = this.time;
    for (let i = 0; i < this.mists.length; i++) {
      this.mists[i]!.position.x = x;
      this.mists[i]!.position.z = z;
      this.mistUniforms[i]!.uTime.value = this.time;
      this.mistUniforms[i]!.uCam.value.set(x, y, z);
    }
    this.moteUniforms.uTime.value = this.time;
    this.moteUniforms.uCenter.value.set(x, y, z);
  }
}
