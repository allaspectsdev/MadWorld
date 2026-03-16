import type { ParticleSystem } from "./ParticleSystem.js";
import { TILE_SIZE } from "@madworld/shared";

export class AmbientParticles {
  private particles: ParticleSystem;
  private timer = 0;
  private zoneType: "forest" | "sand" | "dungeon" | "default" | "snow" | "sandstorm" = "default";
  onLightning: (() => void) | null = null;
  isNight = false;
  zoneLights: { x: number; y: number; radius: number; color: number }[] = [];
  private lightningTimer = 0;
  private cameraX = 0;
  private cameraY = 0;
  private screenW = 800;
  private screenH = 600;

  // Rain state
  private isRaining = false;
  private rainTimer = 0;
  private nextRainCheck = 0;

  constructor(particles: ParticleSystem) {
    this.particles = particles;
  }

  setZoneType(type: "forest" | "sand" | "dungeon" | "default" | "snow" | "sandstorm"): void {
    this.zoneType = type;
    // Reset rain when zone changes
    this.isRaining = false;
    this.rainTimer = 0;
    this.nextRainCheck = 0;
  }

  setCamera(x: number, y: number, w: number, h: number): void {
    this.cameraX = x;
    this.cameraY = y;
    this.screenW = w;
    this.screenH = h;
  }

  private updateRain(dt: number): void {
    if (this.zoneType !== "forest") {
      this.isRaining = false;
      return;
    }

    if (this.isRaining) {
      this.rainTimer -= dt;

      // Lightning during rain
      this.lightningTimer += dt;
      if (this.lightningTimer > 8 + Math.random() * 15) {
        this.lightningTimer = 0;
        this.onLightning?.();
      }

      if (this.rainTimer <= 0) {
        this.isRaining = false;
        this.nextRainCheck = 5; // Wait 5s before next rain check
      }
    } else {
      this.nextRainCheck -= dt;
      if (this.nextRainCheck <= 0) {
        // 30% chance to start rain
        if (Math.random() < 0.3) {
          this.isRaining = true;
          this.rainTimer = 30 + Math.random() * 30; // 30-60 seconds
        }
        this.nextRainCheck = 10; // Check again in 10s if not raining
      }
    }
  }

  update(dt: number, playerX = 0, playerY = 0): void {
    if (this.zoneType === "default") return;

    this.updateRain(dt);

    this.timer += dt;
    if (this.timer < 0.4) return;
    this.timer = 0;

    // Determine particle count based on zone type and rain
    let count: number;
    if (this.isRaining) {
      count = 4 + Math.floor(Math.random() * 3); // 4-6
    } else if (this.zoneType === "dungeon") {
      count = 2 + Math.floor(Math.random() * 2); // 2-3 (fog enhancement)
    } else {
      count = 1 + Math.floor(Math.random() * 2); // 1-2
    }

    for (let i = 0; i < count; i++) {
      const px = this.cameraX + Math.random() * this.screenW;
      const py = this.cameraY + Math.random() * this.screenH * 0.3; // top third

      // Rain particles override forest particles during rain
      if (this.isRaining) {
        this.particles.emit(px, py, 1, {
          tint: 0xaabbdd,
          speed: 200,
          spread: 0.1,
          life: 0.4,
          gravity: 150,
          dirX: 0.2,
          dirY: 1,
          baseScale: 0.3,
        });
        continue;
      }

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
              speed: 3,
              spread: Math.PI * 2,
              life: 6,
              gravity: 0,
              baseScale: 0.8,
            },
          );
          break;
        case "snow":
          this.particles.emit(
            this.cameraX + Math.random() * this.screenW,
            this.cameraY + Math.random() * this.screenH * 0.2,
            1,
            {
              texType: "glow",
              tint: 0xeeeeff,
              speed: 15,
              spread: 0.4,
              life: 4,
              gravity: 12,
              dirX: 0.3 + Math.sin(this.timer * 2 * Math.PI) * 0.2,
              dirY: 1,
              baseScale: 0.4,
            },
          );
          break;
        case "sandstorm":
          for (let j = 0; j < 2; j++) {
            this.particles.emit(
              this.cameraX,
              this.cameraY + Math.random() * this.screenH,
              1,
              {
                tint: 0xc2a860,
                speed: 80,
                spread: 0.2,
                life: 1.5,
                gravity: 0,
                dirX: 1,
                dirY: 0.1,
                baseScale: 0.6,
              },
            );
          }
          break;
      }
    }

    // Fireflies at night
    if (this.isNight) {
      if (Math.random() < 0.02) {
        const fx = (playerX + (Math.random() - 0.5) * 20) * TILE_SIZE;
        const fy = (playerY + (Math.random() - 0.5) * 20) * TILE_SIZE;
        this.particles.emit(fx, fy, 1, {
          texType: "glow", tint: 0xffee44,
          speed: 5, spread: Math.PI * 2, life: 3.0,
          gravity: -3, baseScale: 0.6, scaleDecay: 0.3,
        });
      }
    }

    // Torch/campfire ember particles
    for (const light of this.zoneLights) {
      if (Math.random() < 0.05) {
        this.particles.emit(light.x * TILE_SIZE, light.y * TILE_SIZE, 1, {
          texType: "circle", tint: light.color ?? 0xff8844,
          speed: 20, spread: Math.PI * 0.3, life: 0.6,
          gravity: -40, dirY: -1, baseScale: 0.5,
        });
      }
    }
  }
}
