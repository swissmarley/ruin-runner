import * as THREE from 'three';

const CAPACITY = 480;
const GRAVITY = -9;

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;
  gl_FragColor = vec4(vColor, vAlpha * (1.0 - r * 3.2));
  #include <colorspace_fragment>
}`;

const tmp = new THREE.Color();

/**
 * Pooled particle system (one draw call): coin sparkles, running dust, landing puffs,
 * debris. All buffers are preallocated; emitting and updating never allocate.
 */
export class Effects {
  readonly points: THREE.Points;
  private readonly pos = new Float32Array(CAPACITY * 3);
  private readonly vel = new Float32Array(CAPACITY * 3);
  private readonly color = new Float32Array(CAPACITY * 3);
  private readonly size = new Float32Array(CAPACITY);
  private readonly alpha = new Float32Array(CAPACITY);
  private readonly life = new Float32Array(CAPACITY);
  private readonly maxLife = new Float32Array(CAPACITY);
  private readonly drag = new Float32Array(CAPACITY);
  private readonly gravity = new Float32Array(CAPACITY);
  private next = 0;
  private readonly material: THREE.ShaderMaterial;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geo.setAttribute(
      'aColor',
      new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geo.setAttribute(
      'aSize',
      new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage),
    );
    geo.setAttribute(
      'aAlpha',
      new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage),
    );
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: 300 } },
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  /** Point-size scale follows the drawing-buffer height so particles look the same at any DPR. */
  setViewportHeight(pixels: number): void {
    this.material.uniforms.uScale!.value = pixels * 0.45;
  }

  clear(): void {
    this.life.fill(0);
    this.alpha.fill(0);
    this.markDirty();
  }

  /** Emits `count` particles around (x, y, z). */
  burst(
    x: number,
    y: number,
    z: number,
    count: number,
    hex: number,
    speed: number,
    size: number,
    life: number,
    gravity = 1,
    upward = 0,
  ): void {
    tmp.setHex(hex);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % CAPACITY;
      // Deterministic-enough spread from a golden-angle spiral (no Math.random churn needed).
      const a = (i * 2.39996) % (Math.PI * 2);
      const e = ((i * 0.618034) % 1) * 2 - 1;
      const h = Math.sqrt(1 - e * e);
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = Math.cos(a) * h * speed;
      this.vel[i * 3 + 1] = Math.abs(e) * speed * 0.8 + upward;
      this.vel[i * 3 + 2] = Math.sin(a) * h * speed;
      this.color[i * 3] = tmp.r;
      this.color[i * 3 + 1] = tmp.g;
      this.color[i * 3 + 2] = tmp.b;
      this.size[i] = size * (0.7 + ((i * 0.37) % 0.6));
      this.life[i] = this.maxLife[i] = life * (0.75 + ((i * 0.53) % 0.5));
      this.drag[i] = 2.2;
      this.gravity[i] = gravity;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < CAPACITY; i++) {
      if (this.life[i]! <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] = this.life[i]! - dt;
      const k = Math.max(0, 1 - this.drag[i]! * dt);
      this.vel[i * 3] = this.vel[i * 3]! * k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1]! * k + GRAVITY * this.gravity[i]! * dt;
      this.vel[i * 3 + 2] = this.vel[i * 3 + 2]! * k;
      this.pos[i * 3] = this.pos[i * 3]! + this.vel[i * 3]! * dt;
      this.pos[i * 3 + 1] = this.pos[i * 3 + 1]! + this.vel[i * 3 + 1]! * dt;
      this.pos[i * 3 + 2] = this.pos[i * 3 + 2]! + this.vel[i * 3 + 2]! * dt;
      const t = Math.max(0, this.life[i]! / this.maxLife[i]!);
      this.alpha[i] = t < 0.7 ? t / 0.7 : 1;
    }
    this.markDirty();
  }

  private markDirty(): void {
    const g = this.points.geometry;
    g.getAttribute('position').needsUpdate = true;
    g.getAttribute('aColor').needsUpdate = true;
    g.getAttribute('aSize').needsUpdate = true;
    g.getAttribute('aAlpha').needsUpdate = true;
  }
}
