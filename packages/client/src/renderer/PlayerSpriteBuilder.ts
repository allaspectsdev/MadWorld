import { Graphics, Texture } from "pixi.js";
import { TextureFactory } from "./TextureFactory.js";
import type { Appearance } from "@madworld/shared";

const SKIN_COLORS = [0xf5d0a9, 0xd4a574, 0xa0724a, 0x6b4423, 0xffe0bd, 0xc68642, 0xe8c4a0, 0x8d5524];
const HAIR_COLORS = [0x2c1b0e, 0x71503a, 0xc9a86c, 0xe74c3c, 0x3498db, 0x9b59b6, 0xeeeeee, 0x1a1a1a, 0xff8c00, 0x2ecc71, 0xff69b4, 0x4a4a4a];
const SHIRT_COLORS = [0x3498db, 0xe74c3c, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0x95a5a6, 0xc0392b, 0x2980b9, 0x27ae60, 0x8e44ad];

const W = 28;
const H = 36;

const cache = new Map<string, Texture>();

function cacheKey(a: Appearance): string {
  return `${a.hairStyle}_${a.hairColor}_${a.skinColor}_${a.shirtColor}`;
}

function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) - amount);
  const g = Math.max(0, ((color >> 8) & 0xff) - amount);
  const b = Math.max(0, (color & 0xff) - amount);
  return (r << 16) | (g << 8) | b;
}

function lighten(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + amount);
  const g = Math.min(255, ((color >> 8) & 0xff) + amount);
  const b = Math.min(255, (color & 0xff) + amount);
  return (r << 16) | (g << 8) | b;
}

function drawPlayer(g: Graphics, a: Appearance): void {
  const skin = SKIN_COLORS[a.skinColor % SKIN_COLORS.length];
  const hair = HAIR_COLORS[a.hairColor % HAIR_COLORS.length];
  const shirt = SHIRT_COLORS[a.shirtColor % SHIRT_COLORS.length];
  const skinDark = darken(skin, 30);
  const shirtDark = darken(shirt, 40);
  const hairLight = lighten(hair, 30);
  const pantColor = 0x3a3a5a;
  const shoeColor = 0x4a3a2a;

  // Shadow
  g.ellipse(W / 2, H - 1, 7, 2.5);
  g.fill({ color: 0x000000, alpha: 0.25 });

  // Shoes
  g.roundRect(8, H - 5, 4, 3, 1);
  g.fill(shoeColor);
  g.roundRect(16, H - 5, 4, 3, 1);
  g.fill(shoeColor);
  // Shoe specular highlights
  g.circle(9.5, H - 4, 0.8);
  g.fill({ color: 0xffffff, alpha: 0.06 });
  g.circle(17.5, H - 4, 0.8);
  g.fill({ color: 0xffffff, alpha: 0.06 });

  // Legs (tapered polygons)
  // Left leg: 3px at hip, 3.5px at knee, 2.5px at ankle
  g.moveTo(9, H - 12);
  g.lineTo(12, H - 12);
  g.lineTo(12.25, H - 8);
  g.lineTo(11.25, H - 4);
  g.lineTo(8.75, H - 4);
  g.lineTo(8.75, H - 8);
  g.closePath();
  g.fill(pantColor);
  // Left leg inner highlight
  g.rect(9.5, H - 11, 0.8, 6);
  g.fill({ color: 0xffffff, alpha: 0.05 });
  // Left leg shadow (right edge)
  g.rect(11.5, H - 11, 0.8, 6);
  g.fill({ color: 0x000000, alpha: 0.04 });
  // Right leg
  g.moveTo(16, H - 12);
  g.lineTo(19, H - 12);
  g.lineTo(19.25, H - 8);
  g.lineTo(18.25, H - 4);
  g.lineTo(15.75, H - 4);
  g.lineTo(15.75, H - 8);
  g.closePath();
  g.fill(pantColor);
  // Right leg inner highlight
  g.rect(16.5, H - 11, 0.8, 6);
  g.fill({ color: 0xffffff, alpha: 0.05 });
  // Right leg shadow (right edge)
  g.rect(18.5, H - 11, 0.8, 6);
  g.fill({ color: 0x000000, alpha: 0.04 });

  // Torso (polygon wider at shoulders, narrower at waist)
  g.moveTo(6.5, 14);  // left shoulder
  g.lineTo(21.5, 14); // right shoulder (15px wide at y=14)
  g.lineTo(20, 25);   // right waist (12px wide at y=25)
  g.lineTo(8, 25);    // left waist
  g.closePath();
  g.fill(shirt);
  g.moveTo(6.5, 14);
  g.lineTo(21.5, 14);
  g.lineTo(20, 25);
  g.lineTo(8, 25);
  g.closePath();
  g.stroke({ width: 1, color: shirtDark, alpha: 0.15 });
  // Shirt highlight
  g.rect(8, 15, 4, 10);
  g.fill({ color: 0xffffff, alpha: 0.04 });
  // Directional shading: left highlight, right shadow
  g.rect(7, 15, 3, 9);
  g.fill({ color: 0xffffff, alpha: 0.05 });
  g.rect(18, 15, 3, 9);
  g.fill({ color: 0x000000, alpha: 0.05 });
  // Belt
  g.rect(7, 24, 14, 2);
  g.fill(0x5c3a1e);

  // Arms (roundRect overlapping 1px into torso)
  g.roundRect(4, 15, 4, 9, 1.5);
  g.fill(skin);
  g.roundRect(4, 15, 4, 9, 1.5);
  g.stroke({ width: 0.5, color: skinDark, alpha: 0.15 });
  // Left arm highlight (left edge)
  g.rect(4, 16, 1, 7);
  g.fill({ color: 0xffffff, alpha: 0.04 });
  g.roundRect(20, 15, 4, 9, 1.5);
  g.fill(skin);
  g.roundRect(20, 15, 4, 9, 1.5);
  g.stroke({ width: 0.5, color: skinDark, alpha: 0.15 });
  // Right arm shadow (right edge)
  g.rect(23, 16, 1, 7);
  g.fill({ color: 0x000000, alpha: 0.04 });
  // Hands (1.5px radius)
  g.circle(6, 25, 1.5);
  g.fill(skin);
  g.circle(22, 25, 1.5);
  g.fill(skin);

  // Neck
  g.rect(12, 11, 4, 4);
  g.fill(skin);

  // Head
  g.circle(W / 2, 9, 6);
  g.fill(skin);
  g.circle(W / 2, 9, 6);
  g.stroke({ width: 1, color: skinDark, alpha: 0.12 });
  // Head highlight upper-left
  g.arc(W / 2 - 2, 7, 4, Math.PI * 1.2, Math.PI * 1.8);
  g.fill({ color: 0xffffff, alpha: 0.06 });
  // Head shadow lower-right
  g.arc(W / 2 + 2, 11, 4, Math.PI * 0.2, Math.PI * 0.8);
  g.fill({ color: 0x000000, alpha: 0.05 });

  // Chin (small triangle at bottom of head)
  g.moveTo(W / 2 - 2, 14);
  g.lineTo(W / 2, 15.5);
  g.lineTo(W / 2 + 2, 14);
  g.closePath();
  g.fill(skin);

  // Ears (semicircles on head sides)
  g.arc(W / 2 - 6, 9, 1.5, Math.PI * 0.5, Math.PI * 1.5);
  g.fill(skin);
  g.arc(W / 2 + 6, 9, 1.5, -Math.PI * 0.5, Math.PI * 0.5);
  g.fill(skin);

  // Eyes
  g.circle(11, 8, 1.0);
  g.fill(0xffffff);
  g.circle(11, 8, 0.6);
  g.fill(0x111111);
  g.circle(17, 8, 1.0);
  g.fill(0xffffff);
  g.circle(17, 8, 0.6);
  g.fill(0x111111);

  // Eye specular highlights
  g.circle(11.2, 7.8, 0.3);
  g.fill({ color: 0xffffff, alpha: 0.8 });
  g.circle(17.2, 7.8, 0.3);
  g.fill({ color: 0xffffff, alpha: 0.8 });

  // Nose (tiny dot between and below eyes)
  g.circle(14, 9.5, 1);
  g.fill(skinDark);

  // Mouth
  g.moveTo(12, 12);
  g.lineTo(14, 12.5);
  g.lineTo(16, 12);
  g.stroke({ width: 0.5, color: skinDark, alpha: 0.4 });

  // Hair based on style
  const style = a.hairStyle % 5;
  switch (style) {
    case 0: // Bald — just a shine
      g.circle(12, 5, 2);
      g.fill({ color: 0xffffff, alpha: 0.1 });
      // Strand lines
      g.moveTo(10, 4); g.lineTo(12, 3);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(13, 3.5); g.lineTo(15, 4);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      break;
    case 1: // Short crop
      g.arc(W / 2, 8, 6.5, Math.PI + 0.3, -0.3);
      g.fill(hair);
      // Side fade
      g.rect(8, 6, 2, 4);
      g.fill({ color: hair, alpha: 0.5 });
      g.rect(18, 6, 2, 4);
      g.fill({ color: hair, alpha: 0.5 });
      // Strand lines
      g.moveTo(10, 4); g.lineTo(11, 2.5);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(13, 3); g.lineTo(14, 2);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(16, 3.5); g.lineTo(17, 2.5);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      break;
    case 2: // Mohawk (tall)
      g.rect(11, 0, 6, 7);
      g.fill(hair);
      // Highlight
      g.rect(13, 1, 2, 5);
      g.fill({ color: 0xffffff, alpha: 0.08 });
      // Strand lines
      g.moveTo(12, 1); g.lineTo(12.5, 0);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(14, 0.5); g.lineTo(14.5, 0);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(16, 1); g.lineTo(15.5, 0);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      break;
    case 3: // Long flowing
      g.arc(W / 2, 8, 7, Math.PI, 0);
      g.fill(hair);
      // Side hair as tapered polygons (wider at top, narrower at bottom)
      g.moveTo(5, 6);
      g.lineTo(8, 6);
      g.lineTo(7.5, 18);
      g.lineTo(5.5, 18);
      g.closePath();
      g.fill(hair);
      g.moveTo(20, 6);
      g.lineTo(23, 6);
      g.lineTo(22.5, 18);
      g.lineTo(20.5, 18);
      g.closePath();
      g.fill(hair);
      // Hair highlight
      g.rect(6, 7, 1, 10);
      g.fill({ color: 0xffffff, alpha: 0.08 });
      // Strand lines
      g.moveTo(6, 8); g.lineTo(6.2, 16);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(21, 8); g.lineTo(21.2, 16);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(12, 3); g.lineTo(13, 2);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      break;
    case 4: // Spiky
      for (let i = 0; i < 5; i++) {
        const sx = 9 + i * 2.5;
        g.moveTo(sx - 1, 5);
        g.lineTo(sx, 0 + (i % 2));
        g.lineTo(sx + 1, 5);
        g.fill(hair);
      }
      g.arc(W / 2, 8, 6.5, Math.PI + 0.2, -0.2);
      g.fill(hair);
      // Strand lines on spikes
      g.moveTo(10, 4); g.lineTo(10.2, 1.5);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(14, 3); g.lineTo(14.2, 0.5);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(18, 4); g.lineTo(17.8, 1.5);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
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
