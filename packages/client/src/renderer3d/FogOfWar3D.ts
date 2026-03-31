import * as THREE from "three";
import { WORLD_CHUNK_SIZE } from "@madworld/shared";
import type { ThreeApp } from "./ThreeApp.js";

/**
 * Fog of war using a DataTexture mask. Each texel represents one chunk:
 * black (0) = undiscovered, white (255) = discovered. Bilinear filtering
 * gives soft edges at discovery boundaries.
 *
 * Rendered as a large semi-transparent dark plane above the terrain.
 */
export class FogOfWar3D {
  private app: ThreeApp;
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private maskTexture: THREE.DataTexture;
  private maskData: Uint8Array;

  // Fog covers a large area around the player
  // Map size in chunks for the mask texture
  private static readonly MASK_SIZE = 64; // 64x64 chunks
  private static readonly HALF_MASK = 32;

  // Offset: which chunk is at texel (0,0)
  private originCX = 0;
  private originCZ = 0;

  private discovered = new Set<string>();

  constructor(app: ThreeApp) {
    this.app = app;

    const ms = FogOfWar3D.MASK_SIZE;
    this.maskData = new Uint8Array(ms * ms * 4); // RGBA
    // Initialize all black (undiscovered)
    for (let i = 0; i < ms * ms; i++) {
      this.maskData[i * 4] = 0;
      this.maskData[i * 4 + 1] = 0;
      this.maskData[i * 4 + 2] = 0;
      this.maskData[i * 4 + 3] = 255; // full fog
    }

    this.maskTexture = new THREE.DataTexture(
      this.maskData, ms, ms,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    this.maskTexture.magFilter = THREE.LinearFilter;
    this.maskTexture.minFilter = THREE.LinearFilter;
    this.maskTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.maskTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.maskTexture.needsUpdate = true;

    // Fog plane shader
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uMask: { value: this.maskTexture },
        uFogColor: { value: new THREE.Color(0x0a0a1a) },
        uOriginX: { value: 0 },
        uOriginZ: { value: 0 },
        uChunkSize: { value: WORLD_CHUNK_SIZE },
        uMaskSize: { value: ms },
      },
      vertexShader: /* glsl */ `
        varying vec2 vWorldXZ;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldXZ = worldPos.xz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMask;
        uniform vec3 uFogColor;
        uniform float uOriginX;
        uniform float uOriginZ;
        uniform float uChunkSize;
        uniform float uMaskSize;

        varying vec2 vWorldXZ;

        void main() {
          // Convert world position to chunk coordinates
          vec2 chunkCoord = floor(vWorldXZ / uChunkSize);
          // Convert to UV in mask texture
          vec2 uv = (chunkCoord - vec2(uOriginX, uOriginZ) + 0.5) / uMaskSize;

          // Sample mask (alpha channel = fog amount, 0=discovered, 1=fog)
          float fogAmount = texture2D(uMask, uv).a;

          // Smooth edges
          gl_FragColor = vec4(uFogColor, fogAmount * 0.85);
        }
      `,
    });

    // Large plane covering the world
    const worldSize = ms * WORLD_CHUNK_SIZE;
    const geo = new THREE.PlaneGeometry(worldSize, worldSize);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = 5; // Above terrain and entities
    this.mesh.renderOrder = 100;
    this.mesh.visible = false; // Disabled by default — enable via enableFog()
    // Don't add to scene by default — fog is opt-in
    // this.app.fogGroup.add(this.mesh);
  }

  /** Enable fog of war rendering (for admin toggle) */
  enableFog(enabled: boolean): void {
    if (enabled && !this.mesh.parent) {
      this.app.fogGroup.add(this.mesh);
      this.mesh.visible = true;
      this.rebuildMask();
    } else if (!enabled) {
      this.mesh.visible = false;
      if (this.mesh.parent) this.app.fogGroup.remove(this.mesh);
    }
  }

  /** Set the center of the fog mask (player chunk position) */
  setCenter(worldX: number, worldZ: number): void {
    const cx = Math.floor(worldX / WORLD_CHUNK_SIZE);
    const cz = Math.floor(worldZ / WORLD_CHUNK_SIZE);
    const ms = FogOfWar3D.MASK_SIZE;
    const hm = FogOfWar3D.HALF_MASK;

    this.originCX = cx - hm;
    this.originCZ = cz - hm;

    this.material.uniforms.uOriginX.value = this.originCX;
    this.material.uniforms.uOriginZ.value = this.originCZ;

    // Re-center the mesh
    this.mesh.position.x = (this.originCX + hm) * WORLD_CHUNK_SIZE;
    this.mesh.position.z = (this.originCZ + hm) * WORLD_CHUNK_SIZE;

    // Rebuild mask from discovered set
    this.rebuildMask();
  }

  /** Mark a chunk as discovered */
  discoverChunk(cx: number, cz: number): void {
    this.discovered.add(`${cx},${cz}`);
    this.setMaskTexel(cx, cz, 0); // 0 alpha = no fog
  }

  /** Bulk load discovered chunks (e.g. on login) */
  loadDiscoveries(chunks: Array<{ cx: number; cy: number }>): void {
    for (const c of chunks) {
      this.discovered.add(`${c.cx},${c.cy}`);
    }
    this.rebuildMask();
    // Show fog only once we have discovery data
    if (chunks.length > 0) this.mesh.visible = true;
  }

  private rebuildMask(): void {
    const ms = FogOfWar3D.MASK_SIZE;
    // Reset all to fog
    for (let i = 0; i < ms * ms; i++) {
      this.maskData[i * 4 + 3] = 255;
    }
    // Punch holes for discovered
    for (const key of this.discovered) {
      const [cx, cz] = key.split(",").map(Number);
      this.setMaskTexel(cx, cz, 0);
    }
    this.maskTexture.needsUpdate = true;
  }

  private setMaskTexel(cx: number, cz: number, alpha: number): void {
    const ms = FogOfWar3D.MASK_SIZE;
    const tx = cx - this.originCX;
    const tz = cz - this.originCZ;
    if (tx < 0 || tx >= ms || tz < 0 || tz >= ms) return;

    const idx = (tz * ms + tx) * 4;
    this.maskData[idx + 3] = alpha;
    this.maskTexture.needsUpdate = true;
  }

  dispose(): void {
    this.app.fogGroup.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.maskTexture.dispose();
  }
}
