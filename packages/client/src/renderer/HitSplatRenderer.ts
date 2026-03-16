import { Container, Text, TextStyle } from "pixi.js";
import { TILE_SIZE } from "@madworld/shared";

interface HitSplat {
  text: Text;
  startTime: number;
  startX: number;
  startY: number;
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
    fontSize: 26,
    fontWeight: "bold",
    fill: 0xff0000,
    stroke: { color: 0x000000, width: 4 },
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
    fontSize: 18,
    fontWeight: "bold",
    fill: 0x44ff88,
    stroke: { color: 0x000000, width: 3 },
  });

  addSplat(worldX: number, worldY: number, damage: number, isCrit: boolean): void {
    const isHeal = damage < 0;
    const style = isHeal ? this.healStyle : damage === 0 ? this.missStyle : isCrit ? this.critStyle : this.hitStyle;
    const label = isHeal ? `+${Math.abs(damage)}` : damage === 0 ? "Miss" : isCrit ? `${damage}!` : String(damage);

    const text = new Text({ text: label, style });
    text.anchor.set(0.5);
    // Centered above target, no random horizontal offset
    const px = worldX * TILE_SIZE;
    const py = worldY * TILE_SIZE - TILE_SIZE * 0.6;
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
    const duration = 1000; // Faster: 1s instead of 1.5s

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

      splat.text.y = splat.startY - elapsed * 0.04;
      splat.text.alpha = 1 - progress * progress;
      // Subtle scale: 1.0 -> 1.05 (not ballooning)
      splat.text.scale.set(1 + progress * 0.05);
    }
  }
}
