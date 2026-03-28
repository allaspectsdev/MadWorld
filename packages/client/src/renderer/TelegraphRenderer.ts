import { Container, Graphics } from "pixi.js";
import { cartToIso, ISO_TILE_W, ISO_TILE_H } from "@madworld/shared";

interface Telegraph {
  graphic: Graphics;
  x: number;
  y: number;
  maxRadius: number;
  duration: number;
  elapsed: number;
  color: number;
}

export class TelegraphRenderer {
  readonly container = new Container();
  private active: Telegraph[] = [];

  addTelegraph(worldX: number, worldY: number, radius: number, durationMs: number, color = 0xff0000): void {
    const graphic = new Graphics();
    graphic.alpha = 0;
    this.container.addChild(graphic);

    const iso = cartToIso(worldX, worldY);
    this.active.push({
      graphic,
      x: iso.x,
      y: iso.y,
      maxRadius: radius * ISO_TILE_W * 0.5,
      duration: durationMs / 1000,
      elapsed: 0,
      color,
    });
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const t = this.active[i];
      t.elapsed += dt;
      const progress = Math.min(t.elapsed / t.duration, 1);

      t.graphic.clear();
      const currentRadius = t.maxRadius * progress;

      // Pulsing fill
      const fillAlpha = (0.12 + Math.sin(t.elapsed * 12) * 0.05) * (1 - progress);
      t.graphic.circle(t.x, t.y, currentRadius);
      t.graphic.fill({ color: t.color, alpha: fillAlpha });

      // Outer ring
      t.graphic.circle(t.x, t.y, currentRadius);
      t.graphic.stroke({ width: 2.5, color: t.color, alpha: 0.5 * (1 - progress) });

      // Inner warning ring at 60% of outer radius
      t.graphic.circle(t.x, t.y, currentRadius * 0.6);
      t.graphic.stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 * (1 - progress) });

      // Cross-hatch lines: 4 diameter lines at 45-degree intervals
      const crossAlpha = 0.1 * (1 - progress);
      for (let a = 0; a < 4; a++) {
        const angle = (a * Math.PI) / 4;
        const dx = Math.cos(angle) * currentRadius;
        const dy = Math.sin(angle) * currentRadius;
        t.graphic.moveTo(t.x - dx, t.y - dy);
        t.graphic.lineTo(t.x + dx, t.y + dy);
        t.graphic.stroke({ width: 1, color: t.color, alpha: crossAlpha });
      }

      t.graphic.alpha = 1;

      if (progress >= 1) {
        this.container.removeChild(t.graphic);
        t.graphic.destroy();
        this.active.splice(i, 1);
      }
    }
  }
}
