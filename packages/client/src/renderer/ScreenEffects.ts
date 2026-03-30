import { Graphics, Sprite, Texture, type Application } from "pixi.js";

export class ScreenEffects {
  private overlay: Graphics;
  private width: number;
  private height: number;
  private activeEffect: { color: number; duration: number; elapsed: number } | null = null;
  private fadeOverlay: Graphics;
  private fadeState: { phase: "in" | "hold" | "out"; elapsed: number } | null = null;
  private vignette: Sprite;
  private fogLayer: Graphics;
  private fogEnabled = false;
  private fogTimer = 0;
  private lowHpPulse = 0;
  private lowHpActive = false;
  private levelUpRings: { elapsed: number; duration: number }[] = [];

  constructor(app: Application) {
    this.width = app.screen.width;
    this.height = app.screen.height;

    // Flash overlay
    this.overlay = new Graphics();
    this.overlay.eventMode = "none";
    this.overlay.alpha = 0;
    app.stage.addChild(this.overlay);

    // Fog layer
    this.fogLayer = new Graphics();
    this.fogLayer.eventMode = "none";
    this.fogLayer.alpha = 0;
    app.stage.addChild(this.fogLayer);

    // Vignette overlay
    this.vignette = this.createVignetteSprite();
    this.vignette.eventMode = "none";
    this.vignette.alpha = 0.12;
    app.stage.addChild(this.vignette);

    // Fade overlay (for zone transitions)
    this.fadeOverlay = new Graphics();
    this.fadeOverlay.eventMode = "none";
    this.fadeOverlay.alpha = 0;
    this.fadeOverlay.rect(0, 0, 4000, 4000);
    this.fadeOverlay.fill(0x000000);
    app.stage.addChild(this.fadeOverlay);

    window.addEventListener("resize", () => {
      this.width = app.screen.width;
      this.height = app.screen.height;
      this.resizeVignette();
    });
  }

  private createVignetteSprite(): Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.35)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    const texture = Texture.from(canvas);
    const sprite = new Sprite(texture);
    sprite.width = this.width;
    sprite.height = this.height;
    return sprite;
  }

  private resizeVignette(): void {
    this.vignette.width = this.width;
    this.vignette.height = this.height;
  }

  setVignetteIntensity(alpha: number): void {
    this.vignette.alpha = alpha;
  }

  enableFog(enabled: boolean): void {
    this.fogEnabled = enabled;
    if (!enabled) {
      this.fogLayer.alpha = 0;
    }
  }

  /** Call each frame with current HP ratio (0-1). Enables low-HP pulsing red vignette. */
  setHpRatio(ratio: number): void {
    this.lowHpActive = ratio < 0.25 && ratio > 0;
  }

  flashDamage(): void {
    this.flash(0xff0000, 0.2);
  }

  flashLevelUp(): void {
    this.flash(0xffd700, 0.4);
    // Spawn expanding golden rings
    this.levelUpRings.push({ elapsed: 0, duration: 1.2 });
    this.levelUpRings.push({ elapsed: -0.15, duration: 1.2 });
    this.levelUpRings.push({ elapsed: -0.3, duration: 1.2 });
  }

  flashLightning(): void {
    this.flash(0xccddff, 0.4);
  }

  fadeZoneTransition(): void {
    this.fadeState = { phase: "in", elapsed: 0 };
  }

  flash(color: number, duration: number): void {
    this.overlay.clear();
    this.overlay.rect(0, 0, this.width * 2, this.height * 2);
    this.overlay.fill(color);
    this.activeEffect = { color, duration, elapsed: 0 };
    this.overlay.alpha = 0;
  }

  update(dt: number): void {
    // Flash effect
    if (this.activeEffect) {
      this.activeEffect.elapsed += dt;
      const t = this.activeEffect.elapsed / this.activeEffect.duration;
      if (t >= 1) {
        this.overlay.alpha = 0;
        this.activeEffect = null;
      } else {
        // Triangle: 0 → peak → 0
        this.overlay.alpha = t < 0.3 ? (t / 0.3) * 0.2 : (1 - t) / 0.7 * 0.2;
      }
    }

    // Low HP pulsing red vignette
    if (this.lowHpActive) {
      this.lowHpPulse += dt * 3;
      const pulse = 0.15 + Math.sin(this.lowHpPulse) * 0.08;
      this.vignette.alpha = Math.max(this.vignette.alpha, pulse);
      this.vignette.tint = 0xff2222;
    } else {
      this.lowHpPulse = 0;
      this.vignette.tint = 0xffffff;
      // Only reset if no other code is managing vignette
      if (this.vignette.tint === 0xffffff) {
        this.vignette.alpha += (0.12 - this.vignette.alpha) * Math.min(1, dt * 4);
      }
    }

    // Level-up expanding rings
    if (this.levelUpRings.length > 0) {
      this.overlay.clear();
      // Keep any active flash
      if (this.activeEffect) {
        this.overlay.rect(0, 0, this.width * 2, this.height * 2);
        this.overlay.fill(this.activeEffect.color);
      }

      const cx = this.width / 2;
      const cy = this.height / 2;

      for (let i = this.levelUpRings.length - 1; i >= 0; i--) {
        const ring = this.levelUpRings[i];
        ring.elapsed += dt;
        if (ring.elapsed < 0) continue; // delayed start
        const t = ring.elapsed / ring.duration;
        if (t >= 1) {
          this.levelUpRings.splice(i, 1);
          continue;
        }

        const radius = t * Math.max(this.width, this.height) * 0.6;
        const alpha = (1 - t) * 0.25;
        this.overlay.circle(cx, cy, radius);
        this.overlay.stroke({ width: 3 - t * 2, color: 0xffd700, alpha });
        // Inner brighter ring
        this.overlay.circle(cx, cy, radius * 0.85);
        this.overlay.stroke({ width: 1.5, color: 0xffeeaa, alpha: alpha * 0.6 });
      }
    }

    // Fade effect
    if (this.fadeState) {
      this.fadeState.elapsed += dt;
      switch (this.fadeState.phase) {
        case "in":
          this.fadeOverlay.alpha = Math.min(this.fadeState.elapsed / 0.3, 1);
          if (this.fadeState.elapsed >= 0.3) {
            this.fadeState = { phase: "hold", elapsed: 0 };
          }
          break;
        case "hold": {
          this.fadeOverlay.alpha = 1;

          // Portal ring effect during hold
          const cx = this.width / 2;
          const cy = this.height / 2;
          const ringT = this.fadeState.elapsed / 0.15;
          for (let r = 0; r < 3; r++) {
            const offset = r * 0.25;
            const radius = (ringT + offset) * 80;
            this.fadeOverlay.circle(cx, cy, radius);
            this.fadeOverlay.stroke({ width: 2, color: 0x9b59b6, alpha: 0.3 * (1 - ringT) });
          }

          if (this.fadeState.elapsed >= 0.15) {
            this.fadeState = { phase: "out", elapsed: 0 };
          }
          break;
        }
        case "out":
          this.fadeOverlay.alpha = Math.max(1 - this.fadeState.elapsed / 0.3, 0);
          if (this.fadeState.elapsed >= 0.3) {
            this.fadeOverlay.alpha = 0;
            this.fadeState = null;
          }
          break;
      }
    }

    // Fog effect
    this.fogTimer += dt;
    if (this.fogEnabled) {
      this.fogLayer.clear();
      for (let i = 0; i < 3; i++) {
        const offsetX = Math.sin(this.fogTimer * 0.3 + i * 2.1) * this.width * 0.3;
        const offsetY = Math.cos(this.fogTimer * 0.2 + i * 1.7) * this.height * 0.2;
        const fcx = this.width / 2 + offsetX;
        const fcy = this.height / 2 + offsetY;
        this.fogLayer.ellipse(fcx, fcy, this.width * 0.5, this.height * 0.25);
        this.fogLayer.fill({ color: 0xaaaacc, alpha: 0.04 });
      }
      this.fogLayer.alpha = 0.6;
    } else {
      this.fogLayer.alpha = 0;
    }
  }
}
