import { Graphics, type Application } from "pixi.js";

export class ScreenEffects {
  private overlay: Graphics;
  private width: number;
  private height: number;
  private activeEffect: { color: number; duration: number; elapsed: number } | null = null;
  private fadeOverlay: Graphics;
  private fadeState: { phase: "in" | "hold" | "out"; elapsed: number } | null = null;

  constructor(app: Application) {
    this.width = app.screen.width;
    this.height = app.screen.height;

    // Flash overlay
    this.overlay = new Graphics();
    this.overlay.eventMode = "none";
    this.overlay.alpha = 0;
    app.stage.addChild(this.overlay);

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
    });
  }

  flashDamage(): void {
    this.flash(0xff0000, 0.2);
  }

  flashLevelUp(): void {
    this.flash(0xffd700, 0.3);
  }

  fadeZoneTransition(): void {
    this.fadeState = { phase: "in", elapsed: 0 };
  }

  private flash(color: number, duration: number): void {
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
        case "hold":
          this.fadeOverlay.alpha = 1;
          if (this.fadeState.elapsed >= 0.15) {
            this.fadeState = { phase: "out", elapsed: 0 };
          }
          break;
        case "out":
          this.fadeOverlay.alpha = Math.max(1 - this.fadeState.elapsed / 0.3, 0);
          if (this.fadeState.elapsed >= 0.3) {
            this.fadeOverlay.alpha = 0;
            this.fadeState = null;
          }
          break;
      }
    }
  }
}
