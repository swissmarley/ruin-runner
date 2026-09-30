import * as THREE from 'three';
import { PALETTE } from './Materials';

const SHADOW_EXTENT = 9;

/** Owns the WebGL renderer, scene, main camera, fog and the key lights. */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private pixelRatio = 1;
  private shadows = true;

  constructor(container: HTMLElement) {
    this.gl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.domElement.className = 'game-canvas';
    container.appendChild(this.gl.domElement);

    this.scene.background = new THREE.Color(PALETTE.fog);
    this.scene.fog = new THREE.Fog(PALETTE.fog, 30, 125);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 160);

    this.hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.6);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -SHADOW_EXTENT;
    cam.right = cam.top = SHADOW_EXTENT;
    cam.near = 1;
    cam.far = 40;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target);

    this.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.resize();
  }

  /** Keeps the shadow-casting sun centered on the player. */
  followSun(x: number, z: number): void {
    this.sun.position.set(x + 8, 16, z + 5);
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

  setShadows(enabled: boolean): void {
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

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.gl.setSize(w, h, false);
    this.gl.domElement.style.width = `${w}px`;
    this.gl.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    // Portrait screens get a wider vertical FOV so lanes stay visible.
    this.camera.fov = w < h ? 70 : 58;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.gl.render(this.scene, this.camera);
  }
}
