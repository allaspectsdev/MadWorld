import { Graphics, Texture } from "pixi.js";
import { TextureFactory } from "./TextureFactory.js";
import type { Appearance } from "@madworld/shared";

const SKIN_COLORS = [0xf5d0a9, 0xd4a574, 0xa0724a, 0x6b4423, 0xffe0bd, 0xc68642];
const HAIR_COLORS = [0x2c1b0e, 0x71503a, 0xc9a86c, 0xe74c3c, 0x3498db, 0x9b59b6, 0xeeeeee, 0x1a1a1a];
const SHIRT_COLORS = [0x3498db, 0xe74c3c, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0x95a5a6];

const W = 20;
const H = 28;

const cache = new Map<string, Texture>();

function cacheKey(a: Appearance): string {
  return `${a.hairStyle}_${a.hairColor}_${a.skinColor}_${a.shirtColor}`;
}

function drawPlayer(g: Graphics, a: Appearance): void {
  const skin = SKIN_COLORS[a.skinColor % SKIN_COLORS.length];
  const hair = HAIR_COLORS[a.hairColor % HAIR_COLORS.length];
  const shirt = SHIRT_COLORS[a.shirtColor % SHIRT_COLORS.length];

  // Shadow
  g.ellipse(W / 2, H - 1, 6, 2);
  g.fill({ color: 0x000000, alpha: 0.2 });

  // Legs
  g.rect(7, 20, 2, 6);
  g.fill(0x444466);
  g.rect(11, 20, 2, 6);
  g.fill(0x444466);

  // Body
  g.roundRect(5, 12, 10, 9, 1);
  g.fill(shirt);

  // Arms
  g.rect(3, 13, 2, 7);
  g.fill(skin);
  g.rect(15, 13, 2, 7);
  g.fill(skin);

  // Head
  g.circle(W / 2, 8, 5);
  g.fill(skin);

  // Eyes
  g.circle(8, 7, 1);
  g.fill(0x111111);
  g.circle(12, 7, 1);
  g.fill(0x111111);

  // Hair based on style
  const style = a.hairStyle % 4;
  switch (style) {
    case 0: // Bald - no hair
      break;
    case 1: // Short
      g.arc(W / 2, 7, 5, Math.PI, 0);
      g.fill(hair);
      break;
    case 2: // Mohawk
      g.rect(8, 0, 4, 5);
      g.fill(hair);
      break;
    case 3: // Long
      g.arc(W / 2, 7, 5.5, Math.PI, 0);
      g.fill(hair);
      // Side hair
      g.rect(4, 5, 2, 8);
      g.fill(hair);
      g.rect(14, 5, 2, 8);
      g.fill(hair);
      break;
  }
}

export function getPlayerTexture(appearance?: Appearance): Texture {
  const a = appearance ?? { hairStyle: 0, hairColor: 0, skinColor: 0, shirtColor: 0 };
  const key = cacheKey(a);

  if (cache.has(key)) return cache.get(key)!;

  const g = new Graphics();
  drawPlayer(g, a);
  const tex = TextureFactory.generate(g, W, H);
  cache.set(key, tex);
  return tex;
}

export const PLAYER_SPRITE_SIZE = { w: W, h: H };
