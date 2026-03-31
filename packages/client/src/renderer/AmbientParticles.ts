import type { ParticleSystem } from "./ParticleSystem.js";
import { cartToIso } from "@madworld/shared";

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

  // Firefly accumulator (separate from main timer for higher frequency)
  private fireflyTimer = 0;
  // Daytime mote timer
  private moteTimer = 0;

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
        this.nextRainCheck = 5;
      }
    } else {
      this.nextRainCheck -= dt;
      if (this.nextRainCheck <= 0) {
        if (Math.random() < 0.3) {
          this.isRaining = true;
          this.rainTimer = 30 + Math.random() * 30;
        }
        this.nextRainCheck = 10;
      }
    }
  }

  update(dt: number, playerX = 0, playerY = 0): void {
    this.updateRain(dt);

    // Fireflies and motes run on their own timers (higher frequency than zone particles)
    this.fireflyTimer += dt;
    this.moteTimer += dt;

    // Fireflies at night — much more frequent and atmospheric
    if (this.isNight && this.fireflyTimer > 0.15) {
      this.fireflyTimer = 0;
      // Spawn 1-2 fireflies near player
      if (Math.random() < 0.35) {
        const ffX = playerX + (Math.random() - 0.5) * 16;
        const ffY = playerY + (Math.random() - 0.5) * 16;
        const ffIso = cartToIso(ffX, ffY);
        this.particles.emit(ffIso.x, ffIso.y, 1, {
          texType: "glow", tint: 0xffee44,
          speed: 4 + Math.random() * 4,
          spread: Math.PI * 2, life: 2.5 + Math.random() * 2,
          gravity: -2 - Math.random() * 2,
          baseScale: 0.4 + Math.random() * 0.3,
          scaleDecay: 0.3,
        });
      }
      // Occasional distant firefly (blue-green, further away)
      if (Math.random() < 0.15) {
        const ffX = playerX + (Math.random() - 0.5) * 30;
        const ffY = playerY + (Math.random() - 0.5) * 30;
        const ffIso = cartToIso(ffX, ffY);
        this.particles.emit(ffIso.x, ffIso.y, 1, {
          texType: "glow", tint: 0x88ffaa,
          speed: 3, spread: Math.PI * 2, life: 3.5,
          gravity: -1, baseScale: 0.3, scaleDecay: 0.2,
        });
      }
    }

    // Daytime floating dust motes / pollen (gentle, drifting)
    if (!this.isNight && this.moteTimer > 0.3 && this.zoneType !== "dungeon") {
      this.moteTimer = 0;
      if (Math.random() < 0.25) {
        const mx = this.cameraX + Math.random() * this.screenW;
        const my = this.cameraY + Math.random() * this.screenH;
        const isForest = this.zoneType === "forest";
        this.particles.emit(mx, my, 1, {
          texType: "glow",
          tint: isForest ? 0xddffaa : 0xffffee,
          speed: 3 + Math.random() * 3,
          spread: Math.PI * 2,
          life: 4 + Math.random() * 3,
          gravity: -1,
          baseScale: 0.25 + Math.random() * 0.15,
          scaleDecay: 0.15,
        });
      }
    }

    if (this.zoneType === "default" && !this.isNight) return;

    this.timer += dt;
    if (this.timer < 0.4) return;
    this.timer = 0;

    // Determine particle count based on zone type and rain
    let count: number;
    if (this.isRaining) {
      count = 6 + Math.floor(Math.random() * 4); // 6-9 (more rain)
    } else if (this.zoneType === "dungeon") {
      count = 2 + Math.floor(Math.random() * 2);
    } else {
      count = 1 + Math.floor(Math.random() * 2);
    }

    for (let i = 0; i < count; i++) {
      const px = this.cameraX + Math.random() * this.screenW;
      const py = this.cameraY + Math.random() * this.screenH * 0.3;

      // Rain particles override forest particles during rain
      if (this.isRaining) {
        // Rain drops
        this.particles.emit(px, py, 1, {
          texType: "trail",
          tint: 0xaabbdd,
          speed: 220,
          spread: 0.08,
          life: 0.35,
          gravity: 120,
          dirX: 0.15,
          dirY: 1,
          baseScale: 0.3,
        });

        // Rain splashes on ground (lower on screen)
        if (Math.random() < 0.3) {
          const splashX = this.cameraX + Math.random() * this.screenW;
          const splashY = this.cameraY + this.screenH * (0.4 + Math.random() * 0.5);
          this.particles.emit(splashX, splashY, 3, {
            tint: 0xbbccee,
            speed: 20,
            spread: Math.PI,
            life: 0.2,
            gravity: 60,
            dirY: -1,
            baseScale: 0.25,
          });
        }
        continue;
      }

      switch (this.zoneType) {
        case "forest":
          // Falling leaves — varied colors and gentle sway
          this.particles.emit(px, py, 1, {
            texType: Math.random() > 0.7 ? "spark" : "circle",
            tint: [0x6a9a4a, 0x8b6914, 0xaa7722, 0x5a8a3a][Math.floor(Math.random() * 4)],
            speed: 12 + Math.random() * 8,
            spread: 0.5,
            life: 3.5,
            gravity: 6,
            dirX: 0.4 + Math.sin(Date.now() * 0.001) * 0.3,
            dirY: 1,
            baseScale: 0.5 + Math.random() * 0.3,
            spin: 2,
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
          // Slow drifting fog wisps
          this.particles.emit(
            this.cameraX + Math.random() * this.screenW,
            this.cameraY + Math.random() * this.screenH,
            1,
            {
              texType: "glow",
              tint: 0x8888aa,
              speed: 2 + Math.random() * 2,
              spread: Math.PI * 2,
              life: 6,
              gravity: 0,
              baseScale: 0.8 + Math.random() * 0.4,
              scaleDecay: 0.1,
            },
          );
          // Occasional eerie spark
          if (Math.random() < 0.1) {
            this.particles.emit(
              this.cameraX + Math.random() * this.screenW,
              this.cameraY + Math.random() * this.screenH,
              1,
              {
                texType: "spark",
                tint: 0x6644aa,
                speed: 8,
                spread: Math.PI * 2,
                life: 1.5,
                gravity: -5,
                baseScale: 0.4,
                spin: 3,
              },
            );
          }
          break;
        case "snow":
          // Snowflakes with wind sway
          this.particles.emit(
            this.cameraX + Math.random() * this.screenW,
            this.cameraY + Math.random() * this.screenH * 0.2,
            1,
            {
              texType: "glow",
              tint: 0xeeeeff,
              speed: 12 + Math.random() * 8,
              spread: 0.4,
              life: 5,
              gravity: 10,
              dirX: 0.3 + Math.sin(Date.now() * 0.0008) * 0.4,
              dirY: 1,
              baseScale: 0.3 + Math.random() * 0.25,
              spin: 1,
            },
          );
          break;
        case "sandstorm":
          for (let j = 0; j < 3; j++) {
            this.particles.emit(
              this.cameraX,
              this.cameraY + Math.random() * this.screenH,
              1,
              {
                tint: 0xc2a860,
                speed: 80 + Math.random() * 40,
                spread: 0.15,
                life: 1.5,
                gravity: 0,
                dirX: 1,
                dirY: 0.1,
                baseScale: 0.4 + Math.random() * 0.3,
              },
            );
          }
          break;
      }
    }

    // Torch/campfire ember particles (more frequent, with sparks)
    for (const light of this.zoneLights) {
      if (Math.random() < 0.08) {
        const lightIso = cartToIso(light.x, light.y);
        // Main ember
        this.particles.emit(lightIso.x, lightIso.y, 1, {
          texType: "circle", tint: light.color ?? 0xff8844,
          speed: 18 + Math.random() * 12, spread: Math.PI * 0.3, life: 0.7,
          gravity: -35, dirY: -1, baseScale: 0.5,
        });
        // Occasional spark
        if (Math.random() < 0.3) {
          this.particles.emit(lightIso.x, lightIso.y, 1, {
            texType: "spark", tint: 0xffcc44,
            speed: 30, spread: Math.PI * 0.5, life: 0.4,
            gravity: -50, dirY: -1, baseScale: 0.3, spin: 5,
          });
        }
      }
    }
  }
}
