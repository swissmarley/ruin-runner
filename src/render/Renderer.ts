import * as THREE from 'three';
import { createEnvironmentMap, SUN_DIR } from './art/Sky';
import { PALETTE } from './Materials';
import { PostFX } from './PostFX';

const SHADOW_EXTENT = 10;
const SUN_DISTANCE = 30;

/** Owns the WebGL renderer, scene, main camera, fog, key lights and the post chain. */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private readonly post: PostFX;
  private postEnabled = true;
  private pixelRatio = 1;
  private shadows = true;
  /** Called with the drawing-buffer height after every resize. */
  onResize: ((bufferHeight: number) => void) | null = null;

  constructor(container: HTMLElement, detail: THREE.Texture) {
    this.gl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 0.95;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.domElement.className = 'game-canvas';
    container.appendChild(this.gl.domElement);

    this.scene.background = new THREE.Color(PALETTE.fog);
    this.scene.fog = new THREE.Fog(PALETTE.fog, 30, 125);
    this.scene.environment = createEnvironmentMap(this.gl, detail);
    this.scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 160);

    this.hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 0.35);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(PALETTE.sun, 3.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -SHADOW_EXTENT;
    cam.right = cam.top = SHADOW_EXTENT;
    cam.near = 1;
    cam.far = SUN_DISTANCE * 2.2;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.post = new PostFX(this.gl, this.scene, this.camera);
    this.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.resize();
  }

  /** Keeps the shadow-casting sun centered a little ahead of the player. */
  followSun(x: number, z: number): void {
    this.sun.position.set(
      x + SUN_DIR.x * SUN_DISTANCE,
      SUN_DIR.y * SUN_DISTANCE,
      z + SUN_DIR.z * SUN_DISTANCE,
    );
    this.sun.target.position.set(x, 0, z);
  }

  setPixelRatio(ratio: number): void {
    this.pixelRatio = Math.max(0.5, Math.min(ratio, 2));
    this.gl.setPixelRatio(this.pixelRatio);
    this.resize();
  }

  getPixelRatio(): number {
    return this.pixelRatio;
  }

  /** Bloom + grading (medium/high). Low renders straight to the screen with tone mapping. */
  setPostProcessing(enabled: boolean): void {
    this.postEnabled = enabled;
  }

  setShadows(enabled: boolean, mapSize = 1024): void {
    if (enabled && this.sun.shadow.mapSize.x !== mapSize) {
      this.sun.shadow.mapSize.set(mapSize, mapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    if (enabled === this.shadows) return;
    this.shadows = enabled;
    this.sun.castShadow = enabled;
    this.gl.shadowMap.enabled = enabled;
    // Materials must recompile when the shadow map toggles.
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) m.needsUpdate = true;
      }
    });
  }

  get shadowsEnabled(): boolean {
    return this.shadows;
  }

  setFogFar(far: number): void {
    const fog = this.scene.fog as THREE.Fog;
    fog.far = far;
    fog.near = far * 0.24;
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.gl.setSize(w, h, false);
    this.gl.domElement.style.width = `${w}px`;
    this.gl.domElement.style.height = `${h}px`;
    this.post.setSize(w, h, this.pixelRatio);
    this.camera.aspect = w / h;
    // Portrait screens get a wider vertical FOV so lanes stay visible.
    this.camera.fov = w < h ? 70 : 58;
    this.camera.updateProjectionMatrix();
    this.onResize?.(this.gl.domElement.height);
  }

  render(): void {
    if (this.postEnabled) this.post.render();
    else this.gl.render(this.scene, this.camera);
  }
}
