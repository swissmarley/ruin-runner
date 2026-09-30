import * as THREE from 'three';
import { mergeParts, part } from './Geometry';
import { PALETTE } from './Materials';

/** A relic coin: a thick octagonal disc with a raised rim, standing upright. */
export function coinGeometry(): THREE.BufferGeometry {
  const disc = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 10);
  const boss = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 6);
  const g = mergeParts([
    part(disc, PALETTE.gold, { rx: Math.PI / 2 }),
    part(boss, PALETTE.goldDark, { rx: Math.PI / 2 }),
  ]);
  disc.dispose();
  boss.dispose();
  return g;
}

export function magnetGeometry(): THREE.BufferGeometry {
  const arc = new THREE.TorusGeometry(0.3, 0.1, 5, 10, Math.PI);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const g = mergeParts([
    part(arc, 0xe0413a, { rz: Math.PI }),
    part(box, 0xdfe6ea, { x: -0.3, y: 0.08, sx: 0.2, sy: 0.18, sz: 0.2 }),
    part(box, 0xdfe6ea, { x: 0.3, y: 0.08, sx: 0.2, sy: 0.18, sz: 0.2 }),
  ]);
  arc.dispose();
  box.dispose();
  return g;
}

export function shieldGeometry(): THREE.BufferGeometry {
  const gem = new THREE.OctahedronGeometry(0.34, 0);
  const ring = new THREE.TorusGeometry(0.42, 0.05, 4, 12);
  const g = mergeParts([part(gem, 0x4fb3ff, { sy: 1.25 }), part(ring, 0xbfe6ff, {})]);
  gem.dispose();
  ring.dispose();
  return g;
}

export function surgeGeometry(): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  // A chunky zig-zag bolt.
  const g = mergeParts([
    part(box, 0xffd23f, { x: 0.06, y: 0.2, rz: -0.5, sx: 0.16, sy: 0.4, sz: 0.12 }),
    part(box, 0xffb020, { y: 0, sx: 0.34, sy: 0.12, sz: 0.12 }),
    part(box, 0xffd23f, { x: -0.06, y: -0.2, rz: -0.5, sx: 0.16, sy: 0.4, sz: 0.12 }),
  ]);
  box.dispose();
  return g;
}

/**
 * Adds a per-instance spin around the local Y axis in the vertex shader (phase derived
 * from the instance position), so thousands of coins spin with zero CPU cost.
 */
export function addInstanceSpin(
  material: THREE.Material,
  time: { value: number },
  rate: number,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float spinA = uTime * ${rate.toFixed(2)} + (instanceMatrix[3].x + instanceMatrix[3].z) * 0.35;
        float spinC = cos(spinA);
        float spinS = sin(spinA);
        transformed.xz = mat2(spinC, -spinS, spinS, spinC) * transformed.xz;
      #endif`,
    );
  };
  material.customProgramCacheKey = () => `spin-${rate}`;
}
