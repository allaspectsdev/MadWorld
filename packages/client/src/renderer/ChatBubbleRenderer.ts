import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { cartToIso, ISO_TILE_H, EntityType } from "@madworld/shared";

interface ChatBubble {
  container: Container;
  eid: number;
  elapsed: number;
  duration: number;
  bubbleType: "player" | "npc" | "system";
}

const PLAYER_STYLE = new TextStyle({
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  fontSize: 11,
  fontWeight: "normal",
  fill: 0x222222,
  wordWrap: true,
  wordWrapWidth: 120,
});

const NPC_STYLE = new TextStyle({
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  fontSize: 11,
  fontWeight: "normal",
  fill: 0x3a2a10,
  wordWrap: true,
  wordWrapWidth: 120,
});

const BUBBLE_DURATION = 5;
const MAX_BUBBLES = 20;

export class ChatBubbleRenderer {
  readonly container = new Container();
  private bubbles: ChatBubble[] = [];

  addBubble(eid: number, message: string, entityType?: EntityType): void {
    // Remove existing bubble for this entity
    const idx = this.bubbles.findIndex((b) => b.eid === eid);
    if (idx !== -1) {
      const old = this.bubbles[idx];
      this.container.removeChild(old.container);
      old.container.destroy({ children: true });
      this.bubbles.splice(idx, 1);
    }

    const isNpc = entityType === EntityType.NPC;
    const bubbleType = isNpc ? "npc" : "player";
    const style = isNpc ? NPC_STYLE : PLAYER_STYLE;

    const text = new Text({ text: message.slice(0, 80), style });
    text.anchor.set(0.5, 1);

    const padding = 6;
    const bg = new Graphics();
    const bw = text.width + padding * 2;
    const bh = text.height + padding * 2;

    // Background color depends on type
    const bgColor = isNpc ? 0xfff5dd : 0xffffff;
    const borderColor = isNpc ? 0xdaa520 : 0xcccccc;

    // Background
    bg.roundRect(-bw / 2, -bh, bw, bh, 6);
    bg.fill({ color: bgColor, alpha: 0.92 });
    bg.roundRect(-bw / 2, -bh, bw, bh, 6);
    bg.stroke({ width: 1, color: borderColor, alpha: 0.6 });
    // Speech tail
    bg.moveTo(-4, 0);
    bg.lineTo(0, 6);
    bg.lineTo(4, 0);
    bg.fill({ color: bgColor, alpha: 0.92 });

    text.y = -padding;

    const cont = new Container();
    cont.addChild(bg);
    cont.addChild(text);

    // Entrance animation: start scaled down
    cont.scale.set(0.3);
    cont.alpha = 0;

    this.container.addChild(cont);

    this.bubbles.push({ container: cont, eid, elapsed: 0, duration: BUBBLE_DURATION, bubbleType });

    while (this.bubbles.length > MAX_BUBBLES) {
      const oldest = this.bubbles.shift()!;
      this.container.removeChild(oldest.container);
      oldest.container.destroy({ children: true });
    }
  }

  update(
    dt: number,
    getEntityPos: (eid: number) => { x: number; y: number } | null,
  ): void {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.elapsed += dt;

      if (b.elapsed >= b.duration) {
        this.container.removeChild(b.container);
        b.container.destroy({ children: true });
        this.bubbles.splice(i, 1);
        continue;
      }

      const pos = getEntityPos(b.eid);
      if (pos) {
        const iso = cartToIso(pos.x, pos.y);
        b.container.x = iso.x;
        b.container.y = iso.y - ISO_TILE_H * 0.9;
      }

      // Entrance animation (first 0.2s): scale bounce in
      if (b.elapsed < 0.2) {
        const t = b.elapsed / 0.2;
        // Elastic ease out
        const overshoot = 1 + Math.sin(t * Math.PI) * 0.15;
        const scale = t * overshoot;
        b.container.scale.set(Math.min(scale, 1.1));
        b.container.alpha = Math.min(t * 2, 1);
      } else if (b.elapsed < 0.3) {
        // Settle from overshoot
        const t = (b.elapsed - 0.2) / 0.1;
        b.container.scale.set(1.1 - t * 0.1);
        b.container.alpha = 1;
      } else {
        b.container.scale.set(1);
        b.container.alpha = 1;
      }

      // Fade out in last second
      if (b.elapsed > b.duration - 1) {
        const fadeT = b.duration - b.elapsed;
        b.container.alpha = fadeT;
        b.container.scale.set(0.95 + fadeT * 0.05);
      }
    }
  }
}
