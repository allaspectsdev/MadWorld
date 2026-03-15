import { Graphics, Texture } from "pixi.js";
import { TextureFactory } from "./TextureFactory.js";

type DrawFn = (g: Graphics, w: number, h: number) => void;

interface MobVisual {
  width: number;
  height: number;
  draw: DrawFn;
  isBoss?: boolean;
}

const DEFS: Record<string, MobVisual> = {
  Chicken: {
    width: 16, height: 16,
    draw(g, w, h) {
      // Body
      g.ellipse(w / 2, h / 2 + 1, 5, 4);
      g.fill(0xf0c040);
      // Comb
      g.rect(w / 2 - 1, h / 2 - 5, 2, 3);
      g.fill(0xe74c3c);
      // Eye
      g.circle(w / 2 + 2, h / 2 - 1, 1);
      g.fill(0x111111);
      // Beak
      g.moveTo(w / 2 + 4, h / 2);
      g.lineTo(w / 2 + 7, h / 2 + 1);
      g.lineTo(w / 2 + 4, h / 2 + 2);
      g.fill(0xf09020);
      // Legs
      g.rect(w / 2 - 2, h / 2 + 4, 1, 3);
      g.fill(0xf09020);
      g.rect(w / 2 + 1, h / 2 + 4, 1, 3);
      g.fill(0xf09020);
    },
  },

  Cow: {
    width: 28, height: 24,
    draw(g, w, h) {
      // Body
      g.roundRect(4, 6, 20, 12, 3);
      g.fill(0x8b6914);
      // Belly
      g.ellipse(14, 14, 8, 4);
      g.fill(0xc2a060);
      // Head
      g.circle(22, 6, 4);
      g.fill(0x8b6914);
      // Horns
      g.moveTo(20, 2); g.lineTo(19, 0); g.lineTo(21, 2);
      g.fill(0xcccccc);
      g.moveTo(24, 2); g.lineTo(25, 0); g.lineTo(23, 2);
      g.fill(0xcccccc);
      // Spots
      g.ellipse(10, 10, 3, 2);
      g.fill(0x333333);
      g.ellipse(16, 8, 2, 2);
      g.fill(0x333333);
      // Legs
      for (const x of [7, 12, 17, 22]) {
        g.rect(x, 18, 2, 5);
        g.fill(0x7b5904);
      }
      // Eye
      g.circle(23, 5, 1);
      g.fill(0x111111);
    },
  },

  Goblin: {
    width: 20, height: 22,
    draw(g, w, h) {
      // Body
      g.roundRect(5, 10, 10, 8, 2);
      g.fill(0x3a7a3a);
      // Head (big)
      g.circle(w / 2, 7, 5);
      g.fill(0x4a9a4a);
      // Ears
      g.moveTo(3, 5); g.lineTo(1, 1); g.lineTo(5, 5);
      g.fill(0x4a9a4a);
      g.moveTo(17, 5); g.lineTo(19, 1); g.lineTo(15, 5);
      g.fill(0x4a9a4a);
      // Eyes
      g.circle(8, 6, 1.5);
      g.fill(0xffff00);
      g.circle(12, 6, 1.5);
      g.fill(0xffff00);
      // Legs
      g.rect(7, 18, 2, 4);
      g.fill(0x3a7a3a);
      g.rect(11, 18, 2, 4);
      g.fill(0x3a7a3a);
    },
  },

  Skeleton: {
    width: 18, height: 24,
    draw(g, w, h) {
      // Skull
      g.circle(w / 2, 5, 4);
      g.fill(0xeeeecc);
      // Eye sockets
      g.circle(7, 4, 1.5);
      g.fill(0x222222);
      g.circle(11, 4, 1.5);
      g.fill(0x222222);
      // Torso
      g.rect(6, 10, 6, 8);
      g.fill(0xddddbb);
      // Ribs
      for (let y = 11; y < 17; y += 2) {
        g.rect(6, y, 6, 1);
        g.fill(0xccccaa);
      }
      // Arms
      g.rect(3, 10, 2, 7);
      g.fill(0xddddbb);
      g.rect(13, 10, 2, 7);
      g.fill(0xddddbb);
      // Legs
      g.rect(7, 18, 2, 5);
      g.fill(0xddddbb);
      g.rect(10, 18, 2, 5);
      g.fill(0xddddbb);
    },
  },

  "Forest Spider": {
    width: 24, height: 18,
    draw(g, w, h) {
      // Abdomen
      g.ellipse(16, 10, 5, 4);
      g.fill(0x3a2a1a);
      // Cephalothorax
      g.circle(9, 10, 4);
      g.fill(0x4a3a2a);
      // Eyes
      g.circle(7, 8, 1);
      g.fill(0xff0000);
      g.circle(11, 8, 1);
      g.fill(0xff0000);
      // Legs (4 per side)
      const angles = [-0.6, -0.3, 0.2, 0.5];
      for (const a of angles) {
        const lx = 9 + Math.cos(Math.PI + a) * 8;
        const ly = 10 + Math.sin(Math.PI + a) * 7;
        g.moveTo(9, 10);
        g.lineTo(lx, ly);
        g.stroke({ width: 1.5, color: 0x3a2a1a });
        const rx = 9 + Math.cos(a) * 8;
        const ry = 10 + Math.sin(a) * 7;
        g.moveTo(9, 10);
        g.lineTo(rx, ry);
        g.stroke({ width: 1.5, color: 0x3a2a1a });
      }
    },
  },

  "Goblin Chieftain": {
    width: 30, height: 33, isBoss: true,
    draw(g, w, h) {
      // Aura glow
      g.circle(w / 2, h / 2, 14);
      g.fill({ color: 0xffaa00, alpha: 0.12 });
      // Cape
      g.moveTo(6, 16); g.lineTo(w / 2, 28); g.lineTo(24, 16);
      g.fill(0xcc2222);
      // Body (large goblin)
      g.roundRect(8, 15, 14, 12, 3);
      g.fill(0x3a7a3a);
      // Head
      g.circle(w / 2, 11, 7);
      g.fill(0x4a9a4a);
      // Crown
      g.moveTo(8, 5); g.lineTo(10, 1); g.lineTo(12, 5);
      g.fill(0xffd700);
      g.moveTo(13, 5); g.lineTo(15, 0); g.lineTo(17, 5);
      g.fill(0xffd700);
      g.moveTo(18, 5); g.lineTo(20, 1); g.lineTo(22, 5);
      g.fill(0xffd700);
      // Ears
      g.moveTo(5, 9); g.lineTo(2, 3); g.lineTo(8, 9);
      g.fill(0x4a9a4a);
      g.moveTo(25, 9); g.lineTo(28, 3); g.lineTo(22, 9);
      g.fill(0x4a9a4a);
      // Eyes
      g.circle(12, 10, 2);
      g.fill(0xff4444);
      g.circle(18, 10, 2);
      g.fill(0xff4444);
      // Legs
      g.rect(10, 27, 3, 5);
      g.fill(0x3a7a3a);
      g.rect(17, 27, 3, 5);
      g.fill(0x3a7a3a);
    },
  },

  "Lich King": {
    width: 32, height: 38, isBoss: true,
    draw(g, w, h) {
      // Aura glow
      g.circle(w / 2, h / 2, 16);
      g.fill({ color: 0x8800ff, alpha: 0.12 });
      // Robe (trapezoid)
      g.moveTo(8, 14); g.lineTo(4, 34); g.lineTo(28, 34); g.lineTo(24, 14);
      g.fill(0x1a0a2e);
      // Hood
      g.moveTo(8, 14); g.lineTo(w / 2, 2); g.lineTo(24, 14);
      g.fill(0x1a0a2e);
      // Face shadow
      g.ellipse(w / 2, 12, 5, 4);
      g.fill(0x0a0a1a);
      // Glowing eyes
      g.circle(13, 11, 2);
      g.fill(0xaa44ff);
      g.circle(19, 11, 2);
      g.fill(0xaa44ff);
      g.circle(13, 11, 1);
      g.fill(0xeeccff);
      g.circle(19, 11, 1);
      g.fill(0xeeccff);
      // Staff
      g.rect(26, 6, 2, 26);
      g.fill(0x4a3a2a);
      // Staff orb
      g.circle(27, 5, 3);
      g.fill(0x9944ff);
      g.circle(27, 5, 1.5);
      g.fill({ color: 0xffffff, alpha: 0.5 });
    },
  },
};

// Map variant names to base definitions
const ALIASES: Record<string, string> = {
  "Goblin Sentry": "Goblin",
  "Goblin Warrior": "Goblin",
  "Goblin Mage": "Goblin",
  "Skeleton Soldier": "Skeleton",
  "Bone Archer": "Skeleton",
  "Dark Cultist": "Skeleton",
  "Bone Golem": "Skeleton",
};

const textureCache = new Map<string, Texture>();

export function getMobTexture(name: string): Texture {
  if (textureCache.has(name)) return textureCache.get(name)!;

  const def = DEFS[name] ?? DEFS[ALIASES[name] ?? ""];
  if (!def) {
    // Fallback: red circle
    const g = new Graphics();
    g.circle(12, 12, 10);
    g.fill(0xe74c3c);
    const tex = TextureFactory.generate(g, 24, 24);
    textureCache.set(name, tex);
    return tex;
  }

  const g = new Graphics();
  def.draw(g, def.width, def.height);
  const tex = TextureFactory.generate(g, def.width, def.height);
  textureCache.set(name, tex);
  return tex;
}

export function isBossMob(name: string): boolean {
  return DEFS[name]?.isBoss ?? false;
}

export function getMobSize(name: string): { w: number; h: number } {
  const def = DEFS[name] ?? DEFS[ALIASES[name] ?? ""];
  return def ? { w: def.width, h: def.height } : { w: 24, h: 24 };
}
