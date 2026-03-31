import * as THREE from "three";
import type { ThreeApp } from "./ThreeApp.js";

interface Telegraph {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  timer: number;
  duration: number;
  maxRadius: number;
}

const telegraphVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const telegraphFragmentShader = /* glsl */ `
  uniform float uProgress;
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center) * 2.0;

    // Outer ring
    float ring = smoothstep(0.9, 0.95, dist) * smoothstep(1.0, 0.95, dist);

    // Inner warning ring
    float innerRing = smoothstep(0.55, 0.6, dist) * smoothstep(0.65, 0.6, dist) * 0.3;

    // Fill (pulsing)
    float fill = (1.0 - dist) * 0.12 * (0.5 + 0.5 * sin(uProgress * 12.0));

    // Crosshatch lines
    float cross = 0.0;
    float lineWidth = 0.02;
    float cx = abs(center.x);
    float cy = abs(center.y);
    // Diagonals
    if (abs(cx - cy) < lineWidth && dist < 0.9) cross = 0.08;
    if (abs(cx + cy - 0.5) < lineWidth && dist < 0.9) cross = 0.06;

    float alpha = (ring * 0.6 + innerRing + fill + cross) * uAlpha;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/**
 * Renders ability telegraph indicators as ground-plane circles.
 * Replaces PixiJS TelegraphRenderer.
 */
export class TelegraphRenderer3D {
  private app: ThreeApp;
  private telegraphs: Telegraph[] = [];

  constructor(app: ThreeApp) {
    this.app = app;
  }

  /** Add a telegraph at a world position */
  add(
    worldX: number,
    worldZ: number,
    radius: number,
    duration: number,
    color = 0xff0000,
  ): void {
    const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
    geo.rotateX(-Math.PI / 2);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uProgress: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uAlpha: { value: 1 },
      },
      vertexShader: telegraphVertexShader,
      fragmentShader: telegraphFragmentShader,
    });

    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(worldX, 0.05, worldZ);
    mesh.renderOrder = 2;
    this.app.overlayGroup.add(mesh);

    this.telegraphs.push({
      mesh,
      material,
      timer: 0,
      duration,
      maxRadius: radius,
    });
  }

  /** Update all active telegraphs */
  update(dt: number): void {
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.timer += dt;

      if (t.timer >= t.duration) {
        this.app.overlayGroup.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.material.dispose();
        this.telegraphs.splice(i, 1);
        continue;
      }

      const progress = t.timer / t.duration;
      t.material.uniforms.uProgress.value = progress;

      // Expand radius over time
      const scale = progress;
      t.mesh.scale.set(scale, 1, scale);

      // Fade out in last 20%
      const fadeStart = 0.8;
      if (progress > fadeStart) {
        t.material.uniforms.uAlpha.value = 1 - (progress - fadeStart) / (1 - fadeStart);
      }
    }
  }

  dispose(): void {
    for (const t of this.telegraphs) {
      this.app.overlayGroup.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.material.dispose();
    }
    this.telegraphs = [];
  }
}
