import * as THREE from 'three';
import { PALETTE } from './Materials';

/**
 * Sky and depths: a gradient sky dome (cool zenith → warm, hazy horizon), a warm sun disc,
 * and a misty abyss plane far below the walkway. Everything follows the camera so it is
 * effectively at infinity.
 */
export class Environment {
  readonly group = new THREE.Group();
  private readonly sky: THREE.Mesh;
  private readonly abyss: THREE.Mesh;

  constructor() {
    const skyGeo = new THREE.SphereGeometry(140, 16, 10);
    const colors = new Float32Array(skyGeo.getAttribute('position').count * 3);
    const pos = skyGeo.getAttribute('position');
    const top = new THREE.Color(PALETTE.skyTop);
    const horizon = new THREE.Color(PALETTE.skyHorizon);
    const warm = new THREE.Color(0xe8b27a);
    const low = new THREE.Color(PALETTE.fog);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 140;
      if (y > 0.05) c.copy(horizon).lerp(top, Math.min(1, (y - 0.05) / 0.6));
      else c.copy(low).lerp(horizon, Math.max(0, (y + 0.3) / 0.35));
      // A warm band just above the horizon, strongest toward the sun.
      const x = pos.getX(i) / 140;
      const band = Math.max(0, 1 - Math.abs(y - 0.08) / 0.12) * Math.max(0, 0.4 + x * 0.6);
      c.lerp(warm, band * 0.6);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.sky = new THREE.Mesh(
      skyGeo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
      }),
    );
    this.sky.renderOrder = -10;

    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(7, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffe2b0,
        fog: false,
        transparent: true,
        opacity: 0.85,
      }),
    );
    sun.position.set(110, 22, 60);
    sun.lookAt(0, 0, 0);
    this.sky.add(sun);

    this.abyss = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshLambertMaterial({ color: PALETTE.abyss }),
    );
    this.abyss.rotation.x = -Math.PI / 2;
    this.abyss.position.y = -28;
    this.group.add(this.sky, this.abyss);
  }

  /** Keeps the sky and abyss centered on the camera. */
  follow(x: number, z: number): void {
    this.sky.position.set(x, 0, z);
    this.abyss.position.x = x;
    this.abyss.position.z = z;
  }
}
