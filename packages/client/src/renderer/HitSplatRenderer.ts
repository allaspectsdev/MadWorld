import { Container, Text, TextStyle } from "pixi.js";
import { TILE_SIZE } from "@madworld/shared";

interface HitSplat {
  text: Text;
  startTime: number;
  startX: number;
  startY: number;
}

export class HitSplatRenderer {
  readonly container = new Container();
  private splats: HitSplat[] = [];

  private hitStyle = new TextStyle({
    fontFamily: "Courier New",
    fontSize: 16,
    fontWeight: "bold",
    fill: 0xff4444,
    stroke: { color: 0x000000, width: 3 },
  });

  private critStyle = new TextStyle({
    fontFamily: "Courier New",
    fontSize: 22,
    fontWeight: "bold",
    fill: 0xff0000,
    stroke: { color: 0x000000, width: 3 },
  });

  private missStyle = new TextStyle({
    fontFamily: "Courier New",
    fontSize: 14,
    fill: 0x999999,
    stroke: { color: 0x000000, width: 2 },
  });

  addSplat(worldX: number, worldY: number, damage: number, isCrit: boolean): void {
    const style = damage === 0 ? this.missStyle : isCrit ? this.critStyle : this.hitStyle;
    const label = damage === 0 ? "Miss" : String(damage);

    const text = new Text({ text: label, style });
    text.anchor.set(0.5);
    const px = worldX * TILE_SIZE + (Math.random() - 0.5) * 10;
    const py = worldY * TILE_SIZE - TILE_SIZE * 0.5;
    text.x = px;
    text.y = py;

    this.container.addChild(text);
    this.splats.push({
      text,
      startTime: performance.now(),
      startX: px,
      startY: py,
    });
  }

  update(): void {
    const now = performance.now();
    const duration = 1500;

    for (let i = this.splats.length - 1; i >= 0; i--) {
      const splat = this.splats[i];
      const elapsed = now - splat.startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        this.container.removeChild(splat.text);
        splat.text.destroy();
        this.splats.splice(i, 1);
        continue;
      }

      splat.text.y = splat.startY - elapsed * 0.03;
      splat.text.alpha = 1 - progress * progress;
      splat.text.scale.set(1 + progress * 0.2);
    }
  }
}
