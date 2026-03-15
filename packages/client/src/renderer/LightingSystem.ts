import { Container, Graphics, RenderTexture, Sprite, type Application } from "pixi.js";
import { TILE_SIZE } from "@madworld/shared";

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: number;
  intensity: number;
  flicker?: boolean;
}

const CYCLE_DURATION = 24 * 60; // 24 minutes in seconds
const LIGHT_MAP_SCALE = 0.25; // 1/4 resolution

export class LightingSystem {
  private app: Application;
  private lightMapTexture: RenderTexture;
  private lightMapGraphics: Graphics;
  private overlay: Sprite;
  private timer = 0;

  // Static zone lights (torches, campfires)
  private zoneLights: LightSource[] = [];
  // Dynamic lights (player, boss auras, spells)
  private dynamicLights: LightSource[] = [];

  // Camera state for coordinate conversion
  private camX = 0;
  private camY = 0;
  private camZoom = 1;
  private screenW = 1920;
  private screenH = 1080;

  constructor(app: Application) {
    this.app = app;

    this.screenW = app.screen.width;
    this.screenH = app.screen.height;

    const lmW = Math.ceil(this.screenW * LIGHT_MAP_SCALE);
    const lmH = Math.ceil(this.screenH * LIGHT_MAP_SCALE);

    this.lightMapTexture = RenderTexture.create({
      width: lmW,
      height: lmH,
    });

    this.lightMapGraphics = new Graphics();

    this.overlay = new Sprite(this.lightMapTexture);
    this.overlay.width = this.screenW;
    this.overlay.height = this.screenH;
    this.overlay.blendMode = "multiply";
    this.overlay.eventMode = "none";
    app.stage.addChild(this.overlay);
  }

  setZoneLights(lights: LightSource[]): void {
    this.zoneLights = lights;
  }

  setCamera(worldX: number, worldY: number, zoom: number): void {
    this.camX = worldX;
    this.camY = worldY;
    this.camZoom = zoom;
  }

  resize(): void {
    this.screenW = this.app.screen.width;
    this.screenH = this.app.screen.height;

    const lmW = Math.ceil(this.screenW * LIGHT_MAP_SCALE);
    const lmH = Math.ceil(this.screenH * LIGHT_MAP_SCALE);

    this.lightMapTexture.resize(lmW, lmH);
    this.overlay.width = this.screenW;
    this.overlay.height = this.screenH;
  }

  update(dt: number, playerWorldX: number, playerWorldY: number): void {
    this.timer = (this.timer + dt) % CYCLE_DURATION;
    const minuteInCycle = this.timer / 60; // 0-24

    // Determine ambient color based on time of day
    const ambient = this.getAmbientColor(minuteInCycle);

    const g = this.lightMapGraphics;
    const lmW = Math.ceil(this.screenW * LIGHT_MAP_SCALE);
    const lmH = Math.ceil(this.screenH * LIGHT_MAP_SCALE);

    g.clear();

    // Fill with ambient light color
    g.rect(0, 0, lmW, lmH);
    g.fill(ambient.color);

    // Draw light sources as additive bright circles
    this.dynamicLights = [];

    // Player light — always provides visibility
    const playerRadius = ambient.isNight ? 6 : 12;
    this.dynamicLights.push({
      x: playerWorldX,
      y: playerWorldY,
      radius: playerRadius,
      color: 0xffffff,
      intensity: ambient.isNight ? 0.9 : 0.3,
    });

    // Draw all lights
    const allLights = [...this.zoneLights, ...this.dynamicLights];
    for (const light of allLights) {
      const screenPos = this.worldToLightMap(light.x, light.y);

      // Skip lights far off screen
      const radiusPx = light.radius * TILE_SIZE * this.camZoom * LIGHT_MAP_SCALE;
      if (
        screenPos.x < -radiusPx || screenPos.x > lmW + radiusPx ||
        screenPos.y < -radiusPx || screenPos.y > lmH + radiusPx
      ) continue;

      // Flicker effect
      let intensity = light.intensity;
      if (light.flicker) {
        intensity *= 0.85 + Math.random() * 0.15;
      }

      // Draw concentric circles for soft falloff
      const steps = 3;
      for (let i = steps; i > 0; i--) {
        const frac = i / steps;
        const r = radiusPx * frac;
        const alpha = intensity * (1 - frac * 0.6);
        g.circle(screenPos.x, screenPos.y, r);
        g.fill({ color: light.color, alpha: alpha * 0.4 });
      }

      // Bright center
      g.circle(screenPos.x, screenPos.y, radiusPx * 0.3);
      g.fill({ color: 0xffffff, alpha: intensity * 0.3 });
    }

    // Render the light map
    this.app.renderer.render({
      container: g,
      target: this.lightMapTexture,
      clear: true,
    });
  }

  /** Add a temporary dynamic light (boss aura, spell, etc.) */
  addDynamicLight(light: LightSource): void {
    this.dynamicLights.push(light);
  }

  private worldToLightMap(worldX: number, worldY: number): { x: number; y: number } {
    // Convert world tile position to screen position, then to light map coords
    const screenX = (worldX * TILE_SIZE - this.camX * TILE_SIZE) * this.camZoom + this.screenW / 2;
    const screenY = (worldY * TILE_SIZE - this.camY * TILE_SIZE) * this.camZoom + this.screenH / 2;
    return {
      x: screenX * LIGHT_MAP_SCALE,
      y: screenY * LIGHT_MAP_SCALE,
    };
  }

  private getAmbientColor(minuteInCycle: number): { color: number; isNight: boolean } {
    if (minuteInCycle < 3) {
      // Dawn: warm orange-white, brightening
      const t = minuteInCycle / 3;
      const r = Math.floor(180 + t * 75);
      const gb = Math.floor(140 + t * 115);
      return { color: (r << 16) | (gb << 8) | gb, isNight: false };
    } else if (minuteInCycle < 12) {
      // Day: bright white
      return { color: 0xffffff, isNight: false };
    } else if (minuteInCycle < 15) {
      // Dusk: warm orange dimming
      const t = (minuteInCycle - 12) / 3;
      const r = Math.floor(255 - t * 120);
      const g = Math.floor(255 - t * 160);
      const b = Math.floor(255 - t * 200);
      return { color: (r << 16) | (g << 8) | b, isNight: false };
    } else {
      // Night: dark blue
      const nightProgress = (minuteInCycle - 15) / 9;
      const pulse = Math.sin(nightProgress * Math.PI);
      const base = 35 + Math.floor(pulse * 15);
      const r = Math.floor(base * 0.5);
      const g = Math.floor(base * 0.6);
      const b = base + 30;
      return { color: (r << 16) | (g << 8) | b, isNight: true };
    }
  }
}
