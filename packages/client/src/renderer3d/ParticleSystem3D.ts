import * as THREE from "three";
import type { ThreeApp } from "./ThreeApp.js";

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  gravity: number;
  scaleDecay: number;
  baseSize: number;
  spin: number;
  angle: number;
}

export interface EmitConfig {
  tint?: number;
  speed?: number;
  spread?: number;
  life?: number;
  gravity?: number;
  scaleDecay?: number;
  dirX?: number;
  dirY?: number;
  dirZ?: number;
  baseScale?: number;
  spin?: number;
}

/**
 * GPU-friendly particle system using THREE.Points.
 * Particles stored in typed arrays, rendered in one draw call.
 */
export class ParticleSystem3D {
  private app: ThreeApp;
  private particles: Particle[];
  private maxParticles: number;
  private points: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;
  private geometry: THREE.BufferGeometry;

  constructor(app: ThreeApp, maxParticles = 800) {
    this.app = app;
    this.maxParticles = maxParticles;
    this.particles = [];
    for (let i = 0; i < maxParticles; i++) {
      this.particles.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        size: 1, color: new THREE.Color(1, 1, 1),
        gravity: 0, scaleDecay: 1, baseSize: 1,
        spin: 0, angle: 0,
      });
    }

    this.positions = new Float32Array(maxParticles * 3);
    this.colors = new Float32Array(maxParticles * 3);
    this.sizes = new Float32Array(maxParticles);
    this.alphas = new Float32Array(maxParticles);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute("size", new THREE.BufferAttribute(this.sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    app.particleGroup.add(this.points);
  }

  /**
   * Emit particles at a world position.
   * worldX, worldZ are game coordinates; yOffset is height.
   */
  emit(
    worldX: number,
    yOffset: number,
    worldZ: number,
    count: number,
    config: EmitConfig = {},
  ): void {
    const {
      tint = 0xffffff,
      speed = 15,
      spread = Math.PI * 2,
      life = 1,
      gravity = 0,
      scaleDecay = 1,
      dirX = 0,
      dirY = 1,
      dirZ = 0,
      baseScale = 1,
      spin = 0,
    } = config;

    const color = new THREE.Color(tint);

    // Base direction angle (from dirX/dirZ)
    const baseAngle = Math.atan2(dirZ, dirX);

    for (let i = 0; i < count; i++) {
      const p = this.findInactive();
      if (!p) break;

      p.active = true;
      p.x = worldX;
      p.y = yOffset;
      p.z = worldZ;

      // Random direction within spread
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const vertAngle = Math.atan2(dirY, 1) + (Math.random() - 0.5) * 0.5;
      const s = speed * (0.5 + Math.random() * 0.5);

      p.vx = Math.cos(angle) * Math.cos(vertAngle) * s;
      p.vy = Math.sin(vertAngle) * s;
      p.vz = Math.sin(angle) * Math.cos(vertAngle) * s;

      p.life = 0;
      p.maxLife = life * (0.7 + Math.random() * 0.6);
      p.gravity = gravity;
      p.scaleDecay = scaleDecay;
      p.baseSize = baseScale;
      p.size = baseScale;
      p.color.copy(color);
      p.spin = spin;
      p.angle = 0;
    }
  }

  /** Update all particles */
  update(dt: number): void {
    let activeCount = 0;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) {
        // Push inactive particles far away
        this.positions[i * 3] = 0;
        this.positions[i * 3 + 1] = -1000;
        this.positions[i * 3 + 2] = 0;
        this.sizes[i] = 0;
        continue;
      }

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.positions[i * 3 + 1] = -1000;
        this.sizes[i] = 0;
        continue;
      }

      // Physics
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Scale decay
      const lifeRatio = p.life / p.maxLife;
      p.size = p.baseSize * (1 - lifeRatio * p.scaleDecay);

      // Write to buffers
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;

      this.colors[i * 3] = p.color.r;
      this.colors[i * 3 + 1] = p.color.g;
      this.colors[i * 3 + 2] = p.color.b;

      this.sizes[i] = Math.max(0, p.size);

      activeCount++;
    }

    // Update GPU buffers
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;

    // Adjust overall opacity based on whether there are active particles
    (this.points.material as THREE.PointsMaterial).opacity = activeCount > 0 ? 0.8 : 0;
  }

  private findInactive(): Particle | null {
    for (const p of this.particles) {
      if (!p.active) return p;
    }
    return null;
  }

  dispose(): void {
    this.app.particleGroup.remove(this.points);
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
