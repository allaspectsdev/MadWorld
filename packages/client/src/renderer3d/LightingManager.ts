import * as THREE from "three";
import type { ThreeApp } from "./ThreeApp.js";

interface PointLightEntry {
  light: THREE.PointLight;
  baseIntensity: number;
  phase: number;
  flicker: boolean;
}

/**
 * Manages scene lighting: directional sun, ambient, and a pool of
 * point lights for torches/campfires. Handles day/night cycle.
 */
export class LightingManager {
  private app: ThreeApp;
  private pointLightPool: PointLightEntry[] = [];
  private activePointLights = 0;
  private timer = 0;
  private timeOfDay = 6; // Start at morning

  // Day/night color ramps (matching original LightingSystem)
  private static readonly DAY_SUN_COLOR = 0xffeedd;
  private static readonly DAWN_SUN_COLOR = 0xffaa44;
  private static readonly NIGHT_AMBIENT_COLOR = 0x101030;
  private static readonly DAY_AMBIENT_COLOR = 0x808090;

  constructor(app: ThreeApp, poolSize = 32) {
    this.app = app;

    // Pre-allocate point light pool
    for (let i = 0; i < poolSize; i++) {
      const pl = new THREE.PointLight(0xff8844, 0, 8, 2);
      pl.visible = false;
      app.scene.add(pl);
      this.pointLightPool.push({
        light: pl,
        baseIntensity: 0,
        phase: Math.random() * Math.PI * 2,
        flicker: true,
      });
    }
  }

  /** Set time of day (0-24 minute cycle) */
  setTimeOfDay(t: number): void {
    this.timeOfDay = t;
  }

  /**
   * Place a point light at world position (e.g. for torch, campfire).
   * Returns the index for later removal, or -1 if pool exhausted.
   */
  addPointLight(
    worldX: number,
    worldZ: number,
    color = 0xff8844,
    intensity = 2,
    radius = 8,
    flicker = true,
  ): number {
    if (this.activePointLights >= this.pointLightPool.length) return -1;

    const entry = this.pointLightPool[this.activePointLights];
    entry.light.position.set(worldX, 1.5, worldZ);
    entry.light.color.set(color);
    entry.baseIntensity = intensity;
    entry.light.intensity = intensity;
    entry.light.distance = radius;
    entry.light.visible = true;
    entry.flicker = flicker;
    entry.phase = Math.random() * Math.PI * 2;

    return this.activePointLights++;
  }

  /** Remove all active point lights (e.g. on zone change) */
  clearPointLights(): void {
    for (let i = 0; i < this.activePointLights; i++) {
      this.pointLightPool[i].light.visible = false;
    }
    this.activePointLights = 0;
  }

  /** Update lighting each frame */
  update(dt: number, playerX: number, playerZ: number): void {
    this.timer += dt;
    const tod = this.timeOfDay;

    // Calculate sun angle and intensity from time of day
    let sunIntensity: number;
    let sunColor: THREE.Color;
    let ambientIntensity: number;
    let ambientColor: THREE.Color;

    if (tod < 3) {
      // Dawn
      const t = tod / 3;
      sunIntensity = 0.3 + t * 1.2;
      sunColor = new THREE.Color(LightingManager.DAWN_SUN_COLOR).lerp(
        new THREE.Color(LightingManager.DAY_SUN_COLOR), t,
      );
      ambientIntensity = 0.4 + t * 0.4;
      ambientColor = new THREE.Color(LightingManager.NIGHT_AMBIENT_COLOR).lerp(
        new THREE.Color(LightingManager.DAY_AMBIENT_COLOR), t,
      );
    } else if (tod < 12) {
      // Day — bright and clear
      sunIntensity = 1.5;
      sunColor = new THREE.Color(LightingManager.DAY_SUN_COLOR);
      ambientIntensity = 0.8;
      ambientColor = new THREE.Color(LightingManager.DAY_AMBIENT_COLOR);
    } else if (tod < 15) {
      // Dusk
      const t = (tod - 12) / 3;
      sunIntensity = 1.5 - t * 1.2;
      sunColor = new THREE.Color(LightingManager.DAY_SUN_COLOR).lerp(
        new THREE.Color(LightingManager.DAWN_SUN_COLOR), t,
      );
      ambientIntensity = 0.8 - t * 0.4;
      ambientColor = new THREE.Color(LightingManager.DAY_AMBIENT_COLOR).lerp(
        new THREE.Color(LightingManager.NIGHT_AMBIENT_COLOR), t,
      );
    } else {
      // Night
      sunIntensity = 0.1;
      sunColor = new THREE.Color(0x334466);
      ambientIntensity = 0.25;
      ambientColor = new THREE.Color(LightingManager.NIGHT_AMBIENT_COLOR);
    }

    // Apply to scene lights
    this.app.sun.intensity = sunIntensity;
    this.app.sun.color.copy(sunColor);
    this.app.ambient.intensity = ambientIntensity;
    this.app.ambient.color.copy(ambientColor);

    // Move sun position through the sky (arc follows time of day)
    const sunAngle = (tod / 24) * Math.PI * 2;
    const sunDist = 80;
    this.app.sun.position.set(
      playerX + Math.cos(sunAngle) * sunDist,
      Math.sin(sunAngle) * sunDist + 20,
      playerZ - 30,
    );
    this.app.sun.target.position.set(playerX, 0, playerZ);
    this.app.sun.target.updateMatrixWorld();

    // Update shadow camera to follow player
    this.app.sun.shadow.camera.updateProjectionMatrix();

    // Flicker point lights
    for (let i = 0; i < this.activePointLights; i++) {
      const entry = this.pointLightPool[i];
      if (!entry.flicker) continue;
      entry.light.intensity = entry.baseIntensity *
        (0.85 + 0.15 * Math.sin(this.timer * 8 + entry.phase));
    }

    // Increase point light intensity at night (torches more visible)
    const nightBoost = tod >= 15 ? 1.5 : tod < 3 ? 1.5 - (tod / 3) * 0.5 : 1.0;
    for (let i = 0; i < this.activePointLights; i++) {
      const entry = this.pointLightPool[i];
      const flicker = entry.flicker
        ? 0.85 + 0.15 * Math.sin(this.timer * 8 + entry.phase)
        : 1.0;
      entry.light.intensity = entry.baseIntensity * flicker * nightBoost;
    }
  }

  /** Get the time-of-day normalized sun angle (0=dawn, 0.5=noon, 1=dusk) for shadows */
  getSunDirection(): number {
    const tod = this.timeOfDay;
    if (tod >= 15 || tod < 0) return 0.5;
    return tod / 15;
  }

  dispose(): void {
    this.clearPointLights();
  }
}
