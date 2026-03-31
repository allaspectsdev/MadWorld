import type { ParticleSystem3D } from "./ParticleSystem3D.js";

export type ZoneType = "forest" | "sand" | "dungeon" | "default" | "snow" | "sandstorm";

/**
 * Zone-specific ambient particle effects: fireflies, dust motes,
 * rain, leaves, snow, embers. Wraps ParticleSystem3D.
 */
export class AmbientParticles3D {
  private particles: ParticleSystem3D;
  private zoneType: ZoneType = "default";
  private timer = 0;
  private fireflyTimer = 0;
  private dustTimer = 0;
  private zoneTimer = 0;
  private rainTimer = 0;
  private isRaining = false;
  private rainDuration = 0;
  private rainCheckTimer = 0;
  private isNight = false;
  private playerX = 0;
  private playerZ = 0;

  // Zone lights (torches, campfires) for ember effects
  private zoneLights: Array<{ x: number; z: number }> = [];

  constructor(particles: ParticleSystem3D) {
    this.particles = particles;
  }

  setZone(type: ZoneType): void {
    this.zoneType = type;
    this.isRaining = false;
  }

  setNight(isNight: boolean): void {
    this.isNight = isNight;
  }

  setPlayerPosition(x: number, z: number): void {
    this.playerX = x;
    this.playerZ = z;
  }

  setZoneLights(lights: Array<{ x: number; z: number }>): void {
    this.zoneLights = lights;
  }

  update(dt: number): void {
    this.timer += dt;

    // Fireflies (night only)
    if (this.isNight) {
      this.fireflyTimer += dt;
      if (this.fireflyTimer > 0.15) {
        this.fireflyTimer = 0;
        if (Math.random() < 0.35) {
          const count = 1 + Math.floor(Math.random() * 2);
          const offX = (Math.random() - 0.5) * 32;
          const offZ = (Math.random() - 0.5) * 32;
          this.particles.emit(
            this.playerX + offX, 0.5 + Math.random() * 1.5, this.playerZ + offZ,
            count,
            {
              tint: 0xffee44,
              speed: 2,
              spread: Math.PI * 2,
              life: 3,
              gravity: -1,
              scaleDecay: 0.5,
              baseScale: 0.8,
            },
          );
        }
      }
    }

    // Dust motes (daytime, not dungeon)
    if (!this.isNight && this.zoneType !== "dungeon") {
      this.dustTimer += dt;
      if (this.dustTimer > 0.3) {
        this.dustTimer = 0;
        if (Math.random() < 0.25) {
          const offX = (Math.random() - 0.5) * 20;
          const offZ = (Math.random() - 0.5) * 20;
          const tint = this.zoneType === "forest" ? 0xddffaa : 0xffffee;
          this.particles.emit(
            this.playerX + offX, 1 + Math.random() * 2, this.playerZ + offZ,
            1,
            {
              tint,
              speed: 1.5,
              spread: Math.PI * 2,
              life: 5,
              gravity: -0.3,
              scaleDecay: 0.3,
              baseScale: 0.4,
            },
          );
        }
      }
    }

    // Zone-specific particles
    this.zoneTimer += dt;
    if (this.zoneTimer > 0.4) {
      this.zoneTimer = 0;
      this.emitZoneParticles();
    }

    // Rain (forest zones, sporadic)
    if (this.zoneType === "forest") {
      this.updateRain(dt);
    }

    // Torch/campfire embers
    this.updateEmbers(dt);
  }

  private emitZoneParticles(): void {
    const count = 1 + Math.floor(Math.random() * 2);
    const offX = (Math.random() - 0.5) * 24;
    const offZ = (Math.random() - 0.5) * 24;

    switch (this.zoneType) {
      case "forest":
        // Falling leaves
        this.particles.emit(
          this.playerX + offX, 3 + Math.random() * 2, this.playerZ + offZ,
          count,
          {
            tint: [0x886633, 0xaa7744, 0x664422, 0x997755][Math.floor(Math.random() * 4)],
            speed: 3,
            spread: Math.PI,
            life: 3.5,
            gravity: 2,
            scaleDecay: 0.3,
            baseScale: 0.5,
            spin: 2,
          },
        );
        break;

      case "sand":
        // Horizontal dust drift
        this.particles.emit(
          this.playerX + offX, 0.3, this.playerZ + offZ,
          count,
          {
            tint: 0xccbb88,
            speed: 8,
            spread: 0.4,
            life: 2,
            gravity: 0,
            scaleDecay: 0.5,
            dirX: 1, dirY: 0, dirZ: 0.3,
            baseScale: 0.6,
          },
        );
        break;

      case "dungeon":
        // Slow fog wisps
        this.particles.emit(
          this.playerX + offX, 0.2 + Math.random() * 0.5, this.playerZ + offZ,
          1,
          {
            tint: 0x667788,
            speed: 1,
            spread: Math.PI * 2,
            life: 6,
            gravity: -0.1,
            scaleDecay: 0.2,
            baseScale: 1.2,
          },
        );
        // Eerie sparks (rare)
        if (Math.random() < 0.1) {
          this.particles.emit(
            this.playerX + offX, 1, this.playerZ + offZ,
            1,
            {
              tint: 0x44ccff,
              speed: 5,
              life: 0.8,
              gravity: -3,
              baseScale: 0.3,
            },
          );
        }
        break;

      case "snow":
        // Snowflakes
        this.particles.emit(
          this.playerX + offX, 4 + Math.random() * 2, this.playerZ + offZ,
          count + 1,
          {
            tint: 0xeeeeff,
            speed: 3,
            spread: Math.PI * 0.5,
            life: 5,
            gravity: 1.5,
            scaleDecay: 0.2,
            dirY: -1,
            baseScale: 0.5,
            spin: 1,
          },
        );
        break;

      case "sandstorm":
        // Aggressive sand
        this.particles.emit(
          this.playerX + offX, 0.5 + Math.random(), this.playerZ + offZ,
          3,
          {
            tint: 0xbbaa77,
            speed: 30,
            spread: 0.3,
            life: 1.5,
            gravity: 0,
            scaleDecay: 0.4,
            dirX: 1, dirY: 0.2, dirZ: 0,
            baseScale: 0.7,
          },
        );
        break;
    }
  }

  private updateRain(dt: number): void {
    this.rainCheckTimer += dt;
    if (!this.isRaining) {
      if (this.rainCheckTimer > 5 + Math.random() * 5) {
        this.rainCheckTimer = 0;
        if (Math.random() < 0.3) {
          this.isRaining = true;
          this.rainDuration = 30 + Math.random() * 30;
          this.rainTimer = 0;
        }
      }
      return;
    }

    this.rainTimer += dt;
    if (this.rainTimer >= this.rainDuration) {
      this.isRaining = false;
      return;
    }

    // Raindrops
    for (let i = 0; i < 3; i++) {
      const offX = (Math.random() - 0.5) * 20;
      const offZ = (Math.random() - 0.5) * 20;
      this.particles.emit(
        this.playerX + offX, 5, this.playerZ + offZ,
        1,
        {
          tint: 0x8899aa,
          speed: 40,
          spread: 0.1,
          life: 0.35,
          gravity: 30,
          dirX: 0.1, dirY: -1, dirZ: 0,
          baseScale: 0.3,
          scaleDecay: 0,
        },
      );
    }
  }

  private updateEmbers(dt: number): void {
    for (const light of this.zoneLights) {
      if (Math.random() < 0.08) {
        this.particles.emit(
          light.x, 1, light.z,
          1,
          {
            tint: 0xff8844,
            speed: 4,
            spread: Math.PI * 0.3,
            life: 0.7,
            gravity: -8,
            dirY: 1,
            baseScale: 0.4,
            scaleDecay: 0.8,
          },
        );
        // Occasional spark
        if (Math.random() < 0.3) {
          this.particles.emit(
            light.x, 1.2, light.z,
            1,
            {
              tint: 0xffcc44,
              speed: 8,
              spread: Math.PI * 0.5,
              life: 0.4,
              gravity: -12,
              dirY: 1,
              baseScale: 0.2,
              spin: 5,
            },
          );
        }
      }
    }
  }

  dispose(): void {
    // Nothing to dispose — particles are owned by ParticleSystem3D
  }
}
