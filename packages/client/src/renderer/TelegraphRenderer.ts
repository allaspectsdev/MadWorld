import { Container, Graphics } from "pixi.js";
import { TILE_SIZE } from "@madworld/shared";

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

    this.active.push({
      graphic,
      x: worldX * TILE_SIZE,
      y: worldY * TILE_SIZE,
      maxRadius: radius * TILE_SIZE,
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

      // Expanding ring
      t.graphic.circle(t.x, t.y, currentRadius);
      t.graphic.fill({ color: t.color, alpha: 0.15 * (1 - progress) });
      t.graphic.circle(t.x, t.y, currentRadius);
      t.graphic.stroke({ width: 2, color: t.color, alpha: 0.5 * (1 - progress) });
      t.graphic.alpha = 1;

      if (progress >= 1) {
        this.container.removeChild(t.graphic);
        t.graphic.destroy();
        this.active.splice(i, 1);
      }
    }
  }
}
