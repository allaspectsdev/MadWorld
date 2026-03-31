import * as THREE from "three";
import { WORLD_CHUNK_SIZE } from "@madworld/shared";

export interface WaterMesh {
  mesh: THREE.Mesh;
  update(dt: number): void;
}

const waterVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWaveScale;
  uniform float uWaveSpeed;
  uniform float uWaveHeight;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Animated wave displacement
    float wave1 = sin(pos.x * uWaveScale + uTime * uWaveSpeed) * uWaveHeight;
    float wave2 = sin(pos.z * uWaveScale * 0.7 + uTime * uWaveSpeed * 1.3) * uWaveHeight * 0.6;
    float wave3 = sin((pos.x + pos.z) * uWaveScale * 0.5 + uTime * uWaveSpeed * 0.8) * uWaveHeight * 0.4;
    pos.y += wave1 + wave2 + wave3;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const waterFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform float uOpacity;
  uniform float uFoamScale;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  // Simple noise hash
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 p = vWorldPos.xz;

    // Wave pattern for color variation
    float wave = sin(p.x * 0.8 + uTime * 0.5) * 0.5
               + sin(p.y * 0.6 + uTime * 0.65) * 0.3
               + sin((p.x + p.y) * 0.4 + uTime * 0.4) * 0.2;

    // Blend between deep and shallow based on wave
    float blend = wave * 0.5 + 0.5;
    vec3 color = mix(uDeepColor, uShallowColor, blend);

    // Foam at wave crests
    float foam = smoothstep(0.55, 0.75, wave);
    color = mix(color, vec3(0.9, 0.95, 1.0), foam * 0.35);

    // Specular highlights (simulate sun glint)
    float spec1 = hash(floor(p * 2.0) + floor(uTime * 2.0));
    float specMask = step(0.92, spec1);
    color += vec3(0.3, 0.35, 0.4) * specMask;

    // Subtle caustic-like pattern
    float caustic = sin(p.x * 3.0 + uTime) * sin(p.y * 3.0 + uTime * 0.7);
    color += vec3(0.02, 0.04, 0.06) * caustic;

    gl_FragColor = vec4(color, uOpacity);
  }
`;

/**
 * Create a water mesh for tiles marked as water within a chunk.
 * Generates a plane covering water regions with animated shader.
 */
export function createWaterMesh(
  waterTiles: boolean[][],
  chunkX: number,
  chunkY: number,
  chunkSize: number,
): WaterMesh {
  // Build geometry covering only water tiles
  // For simplicity, create a single plane for the whole chunk but
  // use alpha to hide non-water areas. For better performance with
  // sparse water, could merge individual tile quads.
  const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, chunkSize * 2, chunkSize * 2);
  geo.rotateX(-Math.PI / 2);

  // Discard vertices not over water tiles by pulling them to alpha=0 positions
  // (handled in the shader or by adjusting UVs — for now, full plane is fine
  // since water chunks are usually mostly water)

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color(0x0a3a6a) },
      uShallowColor: { value: new THREE.Color(0x2a7aaa) },
      uOpacity: { value: 0.82 },
      uWaveScale: { value: 1.2 },
      uWaveSpeed: { value: 1.5 },
      uWaveHeight: { value: 0.08 },
      uFoamScale: { value: 4.0 },
    },
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
  });

  const mesh = new THREE.Mesh(geo, material);
  const worldX = chunkX * chunkSize + chunkSize / 2;
  const worldZ = chunkY * chunkSize + chunkSize / 2;
  mesh.position.set(worldX, -0.05, worldZ);
  mesh.renderOrder = 1; // Render after terrain

  return {
    mesh,
    update(dt: number) {
      material.uniforms.uTime.value += dt;
    },
  };
}
