import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { cartToIso, ISO_TILE_H } from "@madworld/shared";

interface ChatBubble {
  container: Container;
  eid: number;
  elapsed: number;
  duration: number;
}

const BUBBLE_STYLE = new TextStyle({
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  fontSize: 11,
  fontWeight: "normal",
  fill: 0x222222,
  wordWrap: true,
  wordWrapWidth: 120,
});

const BUBBLE_DURATION = 5;
const MAX_BUBBLES = 20;

export class ChatBubbleRenderer {
  readonly container = new Container();
  private bubbles: ChatBubble[] = [];

  addBubble(eid: number, message: string): void {
    // Remove existing bubble for this entity
    const idx = this.bubbles.findIndex((b) => b.eid === eid);
    if (idx !== -1) {
      const old = this.bubbles[idx];
      this.container.removeChild(old.container);
      old.container.destroy({ children: true });
      this.bubbles.splice(idx, 1);
    }

    const text = new Text({ text: message.slice(0, 80), style: BUBBLE_STYLE });
    text.anchor.set(0.5, 1);

    const padding = 6;
    const bg = new Graphics();
    const bw = text.width + padding * 2;
    const bh = text.height + padding * 2;
    // Background
    bg.roundRect(-bw / 2, -bh, bw, bh, 6);
    bg.fill({ color: 0xffffff, alpha: 0.9 });
    bg.roundRect(-bw / 2, -bh, bw, bh, 6);
    bg.stroke({ width: 1, color: 0xcccccc, alpha: 0.5 });
    // Speech tail
    bg.moveTo(-4, 0);
    bg.lineTo(0, 6);
    bg.lineTo(4, 0);
    bg.fill({ color: 0xffffff, alpha: 0.9 });

    text.y = -padding;

    const cont = new Container();
    cont.addChild(bg);
    cont.addChild(text);
    this.container.addChild(cont);

    this.bubbles.push({ container: cont, eid, elapsed: 0, duration: BUBBLE_DURATION });

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

      // Fade out in last second
      if (b.elapsed > b.duration - 1) {
        b.container.alpha = b.duration - b.elapsed;
      }
    }
  }
}
