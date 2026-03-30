import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { cartToIso, ISO_TILE_H } from "@madworld/shared";

interface HitSplat {
  text: Text;
  glow?: Graphics;
  startTime: number;
  startX: number;
  startY: number;
  offsetX: number;
  isCrit: boolean;
  isHeal: boolean;
  popScale: number;
}

const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

export class HitSplatRenderer {
  readonly container = new Container();
  private splats: HitSplat[] = [];

  private hitStyle = new TextStyle({
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: "bold",
    fill: 0xff4444,
    stroke: { color: 0x000000, width: 3 },
  });

  private critStyle = new TextStyle({
    fontFamily: FONT,
    fontSize: 32,
    fontWeight: "bold",
    fill: 0xffdd44,
    stroke: { color: 0x880000, width: 4 },
    dropShadow: {
      color: 0xff4400,
      blur: 6,
      distance: 0,
    },
  });

  private missStyle = new TextStyle({
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: "bold",
    fill: 0x999999,
    stroke: { color: 0x000000, width: 2 },
  });

  private healStyle = new TextStyle({
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: "bold",
    fill: 0x44ffaa,
    stroke: { color: 0x005522, width: 3 },
    dropShadow: {
      color: 0x00ff66,
      blur: 4,
      distance: 0,
    },
  });

  addSplat(worldX: number, worldY: number, damage: number, isCrit: boolean): void {
    const isHeal = damage < 0;
    const isMiss = damage === 0;
    const style = isHeal ? this.healStyle : isMiss ? this.missStyle : isCrit ? this.critStyle : this.hitStyle;
    const label = isHeal ? `+${Math.abs(damage)}` : isMiss ? "Miss" : isCrit ? `${damage}!` : String(damage);

    const text = new Text({ text: label, style });
    text.anchor.set(0.5);

    const iso = cartToIso(worldX, worldY);
    // Spread numbers horizontally so they don't stack
    const offsetX = (Math.random() - 0.5) * 30;
    const px = iso.x + offsetX;
    const py = iso.y - ISO_TILE_H * 0.6;
    text.x = px;
    text.y = py;

    // Crits start bigger then pop down
    if (isCrit) {
      text.scale.set(1.8);
    }

    const splatContainer = new Container();

    // Glow behind crits
    let glow: Graphics | undefined;
    if (isCrit) {
      glow = new Graphics();
      glow.circle(0, 0, 20);
      glow.fill({ color: 0xffaa00, alpha: 0.3 });
      glow.circle(0, 0, 12);
      glow.fill({ color: 0xffdd44, alpha: 0.2 });
      glow.x = px;
      glow.y = py;
      this.container.addChild(glow);
    }

    this.container.addChild(text);
    this.splats.push({
      text,
      glow,
      startTime: performance.now(),
      startX: px,
      startY: py,
      offsetX,
      isCrit,
      isHeal,
      popScale: isCrit ? 1.8 : 1.0,
    });
  }

  update(): void {
    const now = performance.now();
    const duration = 1200;

    for (let i = this.splats.length - 1; i >= 0; i--) {
      const splat = this.splats[i];
      const elapsed = now - splat.startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        this.container.removeChild(splat.text);
        splat.text.destroy();
        if (splat.glow) {
          this.container.removeChild(splat.glow);
          splat.glow.destroy();
        }
        this.splats.splice(i, 1);
        continue;
      }

      // Movement: float upward with slight deceleration
      const floatSpeed = splat.isCrit ? 0.06 : splat.isHeal ? 0.05 : 0.04;
      splat.text.y = splat.startY - elapsed * floatSpeed;

      // Scale animation
      if (splat.isCrit) {
        // Crits: pop in big, then settle to normal, then shrink
        const popPhase = Math.min(progress / 0.15, 1);
        const settleScale = 1.8 - popPhase * 0.6; // 1.8 -> 1.2
        const shrinkPhase = Math.max(0, (progress - 0.5) / 0.5);
        const scale = settleScale * (1 - shrinkPhase * 0.3);
        splat.text.scale.set(scale);
      } else if (splat.isHeal) {
        // Heals: gentle bounce in
        const bounce = progress < 0.1 ? 1 + Math.sin(progress / 0.1 * Math.PI) * 0.15 : 1;
        splat.text.scale.set(bounce);
      } else {
        // Regular: subtle scale up
        splat.text.scale.set(1 + progress * 0.08);
      }

      // Fade out (faster for misses)
      const fadeStart = splat.isCrit ? 0.4 : 0.3;
      if (progress > fadeStart) {
        const fadeProgress = (progress - fadeStart) / (1 - fadeStart);
        splat.text.alpha = 1 - fadeProgress * fadeProgress;
      }

      // Glow follows and fades
      if (splat.glow) {
        splat.glow.y = splat.text.y;
        splat.glow.alpha = Math.max(0, 1 - progress * 1.5);
        splat.glow.scale.set(1 + progress * 0.5);
      }
    }
  }
}
