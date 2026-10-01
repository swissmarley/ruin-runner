import * as THREE from 'three';
import { lathe, mergeParts, part, roundedBox } from './Geometry';
import { PALETTE } from './Materials';

/** Eight-rayed sun emblem, extruded with a soft bevel (embossed on both faces of a coin). */
function sunEmblem(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const rays = 8;
  for (let i = 0; i <= rays * 2; i++) {
    const a = (i / (rays * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 0.2 : 0.11;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 1,
  });
  g.translate(0, 0, -0.01);
  return g;
}

/** A relic coin: minted disc with a raised rim and an embossed sun on both faces, upright. */
export function coinGeometry(): THREE.BufferGeometry {
  // Profile (radius, height) around Y: rim, recessed field, rim again.
  const body = lathe(
    [
      0, -0.035, 0.27, -0.035, 0.31, -0.05, 0.345, -0.03, 0.345, 0.03, 0.31, 0.05, 0.27, 0.035, 0,
      0.035,
    ],
    22,
  );
  const emblem = sunEmblem();
  const g = mergeParts([
    part(body, PALETTE.gold, { rx: Math.PI / 2 }),
    part(emblem, PALETTE.gold, { z: -0.035 }),
    part(emblem, PALETTE.gold, { z: 0.035, ry: Math.PI }),
  ]);
  body.dispose();
  emblem.dispose();
  return g;
}

export function magnetGeometry(): THREE.BufferGeometry {
  const arc = new THREE.TorusGeometry(0.28, 0.1, 12, 24, Math.PI);
  const tip = roundedBox(0.2, 0.18, 0.2, 0.05);
  const g = mergeParts([
    part(arc, 0xe0413a, { rz: Math.PI }),
    part(tip, 0xdfe6ea, { x: -0.28, y: 0.08 }),
    part(tip, 0xdfe6ea, { x: 0.28, y: 0.08 }),
  ]);
  arc.dispose();
  tip.dispose();
  return g;
}

export function shieldGeometry(): THREE.BufferGeometry {
  const gem = new THREE.OctahedronGeometry(0.32, 0);
  const ring = new THREE.TorusGeometry(0.44, 0.04, 8, 32);
  const g = mergeParts([
    part(gem, 0x4fb3ff, { sy: 1.3, facet: true }),
    part(ring, 0xbfe6ff, {}),
    part(ring, 0xbfe6ff, { ry: Math.PI / 2, sx: 0.9, sy: 0.9, sz: 0.9 }),
  ]);
  gem.dispose();
  ring.dispose();
  return g;
}

export function surgeGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const pts = [0.08, 0.42, -0.2, -0.02, -0.02, -0.02, -0.1, -0.42, 0.2, 0.06, 0.02, 0.06];
  shape.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) shape.lineTo(pts[i]!, pts[i + 1]!);
  const bolt = new THREE.ExtrudeGeometry(shape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  bolt.translate(0, 0, -0.04);
  const g = mergeParts([part(bolt, 0xffd23f, {})]);
  bolt.dispose();
  return g;
}

/**
 * Adds a per-instance spin around the local Y axis in the vertex shader (phase derived
 * from the instance position), so thousands of coins spin with zero CPU cost. Normals spin
 * too, so reflections glint as the coin turns.
 */
export function addInstanceSpin(
  material: THREE.Material,
  time: { value: number },
  rate: number,
): void {
  const spin = /* glsl */ `
    #ifdef USE_INSTANCING
      float spinA = uTime * ${rate.toFixed(2)} + (instanceMatrix[3].x + instanceMatrix[3].z) * 0.35;
      mat2 spinM = mat2(cos(spinA), -sin(spinA), sin(spinA), cos(spinA));
    #else
      mat2 spinM = mat2(1.0);
    #endif`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>\n${spin}\nobjectNormal.xz = spinM * objectNormal.xz;`,
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed.xz = spinM * transformed.xz;',
      );
  };
  material.customProgramCacheKey = () => `spin-${rate}`;
}
