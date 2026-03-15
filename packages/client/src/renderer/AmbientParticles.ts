import type { ParticleSystem } from "./ParticleSystem.js";
import { TILE_SIZE } from "@madworld/shared";

export class AmbientParticles {
  private particles: ParticleSystem;
  private timer = 0;
  private zoneType: "forest" | "sand" | "dungeon" | "default" = "default";
  private cameraX = 0;
  private cameraY = 0;
  private screenW = 800;
  private screenH = 600;

  constructor(particles: ParticleSystem) {
    this.particles = particles;
  }

  setZoneType(type: "forest" | "sand" | "dungeon" | "default"): void {
    this.zoneType = type;
  }

  setCamera(x: number, y: number, w: number, h: number): void {
    this.cameraX = x;
    this.cameraY = y;
    this.screenW = w;
    this.screenH = h;
  }

  update(dt: number): void {
    if (this.zoneType === "default") return;

    this.timer += dt;
    if (this.timer < 0.4) return;
    this.timer = 0;

    // Spawn 1-2 particles per tick within the viewport
    const count = 1 + Math.floor(Math.random() * 2);

    for (let i = 0; i < count; i++) {
      const px = this.cameraX + Math.random() * this.screenW;
      const py = this.cameraY + Math.random() * this.screenH * 0.3; // top third

      switch (this.zoneType) {
        case "forest":
          this.particles.emit(px, py, 1, {
            tint: Math.random() > 0.5 ? 0x6a9a4a : 0x8b6914,
            speed: 15,
            spread: 0.5,
            life: 3,
            gravity: 8,
            dirX: 0.5,
            dirY: 1,
            baseScale: 0.7,
          });
          break;
        case "sand":
          this.particles.emit(px, py + this.screenH * 0.5, 1, {
            tint: 0xc2b280,
            speed: 25,
            spread: 0.3,
            life: 2,
            gravity: 0,
            dirX: 1,
            dirY: 0,
            baseScale: 0.5,
          });
          break;
        case "dungeon":
          this.particles.emit(
            this.cameraX + Math.random() * this.screenW,
            this.cameraY + Math.random() * this.screenH,
            1,
            {
              texType: "glow",
              tint: 0xaaaaaa,
              speed: 5,
              spread: Math.PI * 2,
              life: 4,
              gravity: 0,
              baseScale: 0.3,
            },
          );
          break;
      }
    }
  }
}
