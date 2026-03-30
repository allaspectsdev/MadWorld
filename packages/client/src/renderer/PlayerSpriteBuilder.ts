import { Graphics, Texture } from "pixi.js";
import { TextureFactory } from "./TextureFactory.js";
import type { Appearance } from "@madworld/shared";

export const SKIN_COLORS = [0xf5d0a9, 0xd4a574, 0xa0724a, 0x6b4423, 0xffe0bd, 0xc68642, 0xe8c4a0, 0x8d5524];
export const HAIR_COLORS = [0x2c1b0e, 0x71503a, 0xc9a86c, 0xe74c3c, 0x3498db, 0x9b59b6, 0xeeeeee, 0x1a1a1a, 0xff8c00, 0x2ecc71, 0xff69b4, 0x4a4a4a];
export const SHIRT_COLORS = [0x3498db, 0xe74c3c, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0x95a5a6, 0xc0392b, 0x2980b9, 0x27ae60, 0x8e44ad];

const W = 36;
const H = 46;

const cache = new Map<string, Texture>();

function cacheKey(a: Appearance, equip?: Record<string, string>): string {
  const equipStr = equip ? Object.entries(equip).sort().map(([k,v]) => `${k}:${v}`).join(',') : '';
  return `${a.hairStyle}_${a.hairColor}_${a.skinColor}_${a.shirtColor}_${a.bodyType ?? 0}_${equipStr}`;
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

function drawPlayer(g: Graphics, a: Appearance, equip?: Record<string, string>): void {
  const skin = SKIN_COLORS[a.skinColor % SKIN_COLORS.length];
  const hair = HAIR_COLORS[a.hairColor % HAIR_COLORS.length];
  const shirt = SHIRT_COLORS[a.shirtColor % SHIRT_COLORS.length];
  const skinDark = darken(skin, 30);
  const shirtDark = darken(shirt, 40);
  const hairLight = lighten(hair, 30);
  const pantColor = 0x3a3a5a;
  const shoeColor = 0x4a3a2a;
  const isFeminine = (a.bodyType ?? 0) === 1;

  // Shadow
  g.ellipse(W / 2, H - 1, 9, 3);
  g.fill({ color: 0x000000, alpha: 0.25 });

  // Shoes
  g.roundRect(10, H - 6, 5, 4, 1.5);
  g.fill(isFeminine ? 0x5a3a3a : shoeColor);
  g.roundRect(20.5, H - 6, 5, 4, 1.5);
  g.fill(isFeminine ? 0x5a3a3a : shoeColor);
  // Shoe specular highlights
  g.circle(12, H - 5, 1);
  g.fill({ color: 0xffffff, alpha: 0.06 });
  g.circle(22.5, H - 5, 1);
  g.fill({ color: 0xffffff, alpha: 0.06 });

  if (isFeminine) {
    // Feminine legs — slimmer with skirt overlay
    // Left leg
    g.moveTo(12, H - 15);
    g.lineTo(15, H - 15);
    g.lineTo(15, H - 5);
    g.lineTo(11.5, H - 5);
    g.closePath();
    g.fill(pantColor);
    // Right leg
    g.moveTo(21, H - 15);
    g.lineTo(24, H - 15);
    g.lineTo(24.5, H - 5);
    g.lineTo(21, H - 5);
    g.closePath();
    g.fill(pantColor);
    // Skirt (flared shape covering upper legs)
    g.moveTo(10.5, 32);
    g.lineTo(9, H - 13);
    g.lineTo(27, H - 13);
    g.lineTo(25.5, 32);
    g.closePath();
    g.fill(shirt);
    g.moveTo(10.5, 32);
    g.lineTo(9, H - 13);
    g.lineTo(27, H - 13);
    g.lineTo(25.5, 32);
    g.closePath();
    g.stroke({ width: 0.5, color: shirtDark, alpha: 0.15 });
    // Skirt fold lines
    g.moveTo(14, 33); g.lineTo(13, H - 13);
    g.stroke({ width: 0.3, color: shirtDark, alpha: 0.1 });
    g.moveTo(22, 33); g.lineTo(23, H - 13);
    g.stroke({ width: 0.3, color: shirtDark, alpha: 0.1 });
  } else {
    // Default legs (tapered polygons)
    // Left leg
    g.moveTo(11.5, H - 15);
    g.lineTo(15.5, H - 15);
    g.lineTo(15.5, H - 10);
    g.lineTo(14.5, H - 5);
    g.lineTo(11, H - 5);
    g.lineTo(11, H - 10);
    g.closePath();
    g.fill(pantColor);
    // Left leg inner highlight
    g.rect(12, H - 14, 1, 8);
    g.fill({ color: 0xffffff, alpha: 0.05 });
    // Left leg shadow (right edge)
    g.rect(14.5, H - 14, 1, 8);
    g.fill({ color: 0x000000, alpha: 0.04 });
    // Right leg
    g.moveTo(20.5, H - 15);
    g.lineTo(24.5, H - 15);
    g.lineTo(25, H - 10);
    g.lineTo(23.5, H - 5);
    g.lineTo(20, H - 5);
    g.lineTo(20, H - 10);
    g.closePath();
    g.fill(pantColor);
    // Right leg inner highlight
    g.rect(21, H - 14, 1, 8);
    g.fill({ color: 0xffffff, alpha: 0.05 });
    // Right leg shadow (right edge)
    g.rect(24, H - 14, 1, 8);
    g.fill({ color: 0x000000, alpha: 0.04 });
  }

  // Torso
  if (isFeminine) {
    // Feminine torso — narrower shoulders, defined waist, wider hips
    g.moveTo(10, 18);    // left shoulder (narrower)
    g.lineTo(26, 18);    // right shoulder
    g.lineTo(25.5, 25);  // right mid
    g.lineTo(24, 28);    // right waist (pinched)
    g.lineTo(26, 32);    // right hip (flared)
    g.lineTo(10, 32);    // left hip
    g.lineTo(12, 28);    // left waist (pinched)
    g.lineTo(10.5, 25);  // left mid
    g.closePath();
    g.fill(shirt);
    g.moveTo(10, 18);
    g.lineTo(26, 18);
    g.lineTo(25.5, 25);
    g.lineTo(24, 28);
    g.lineTo(26, 32);
    g.lineTo(10, 32);
    g.lineTo(12, 28);
    g.lineTo(10.5, 25);
    g.closePath();
    g.stroke({ width: 0.5, color: shirtDark, alpha: 0.15 });
  } else {
    // Default torso (polygon wider at shoulders, narrower at waist)
    g.moveTo(8.5, 18);   // left shoulder
    g.lineTo(27.5, 18);  // right shoulder
    g.lineTo(26, 32);    // right waist
    g.lineTo(10, 32);    // left waist
    g.closePath();
    g.fill(shirt);
    g.moveTo(8.5, 18);
    g.lineTo(27.5, 18);
    g.lineTo(26, 32);
    g.lineTo(10, 32);
    g.closePath();
    g.stroke({ width: 1, color: shirtDark, alpha: 0.15 });
  }
  // Shirt highlight
  g.rect(10, 19, 5, 13);
  g.fill({ color: 0xffffff, alpha: 0.04 });
  // Directional shading: left highlight, right shadow
  g.rect(9, 19, 4, 11.5);
  g.fill({ color: 0xffffff, alpha: 0.05 });
  g.rect(23, 19, 4, 11.5);
  g.fill({ color: 0x000000, alpha: 0.05 });
  // Belt
  g.rect(9, 31, 18, 2.5);
  g.fill(0x5c3a1e);

  // Shirt fold lines
  g.moveTo(10, 22); g.lineTo(24, 22);
  g.stroke({ width: 0.3, color: shirtDark, alpha: 0.08 });
  g.moveTo(11, 26); g.lineTo(23, 26);
  g.stroke({ width: 0.3, color: shirtDark, alpha: 0.06 });
  // Collar
  g.moveTo(14, 18); g.lineTo(18, 17.5); g.lineTo(22, 18);
  g.stroke({ width: 0.5, color: shirtDark, alpha: 0.15 });
  // Belt buckle
  g.rect(17, 31, 2, 2);
  g.fill({ color: 0x8b6a3e, alpha: 0.6 });

  // Arms (roundRect overlapping 1px into torso)
  g.roundRect(5, 19, 5, 11.5, 2);
  g.fill(skin);
  g.roundRect(5, 19, 5, 11.5, 2);
  g.stroke({ width: 0.5, color: skinDark, alpha: 0.15 });
  // Left arm highlight (left edge)
  g.rect(5, 20.5, 1.5, 9);
  g.fill({ color: 0xffffff, alpha: 0.04 });
  g.roundRect(26, 19, 5, 11.5, 2);
  g.fill(skin);
  g.roundRect(26, 19, 5, 11.5, 2);
  g.stroke({ width: 0.5, color: skinDark, alpha: 0.15 });
  // Right arm shadow (right edge)
  g.rect(29.5, 20.5, 1.5, 9);
  g.fill({ color: 0x000000, alpha: 0.04 });
  // Hands (2px radius)
  g.circle(7.5, 32, 2);
  g.fill(skin);
  g.circle(28.5, 32, 2);
  g.fill(skin);

  // Neck
  g.rect(15.5, 14, 5, 5);
  g.fill(skin);

  // Head
  g.circle(W / 2, 11.5, 7.7);
  g.fill(skin);
  g.circle(W / 2, 11.5, 7.7);
  g.stroke({ width: 1, color: skinDark, alpha: 0.12 });
  // Head highlight upper-left
  g.arc(W / 2 - 2.5, 9, 5, Math.PI * 1.2, Math.PI * 1.8);
  g.fill({ color: 0xffffff, alpha: 0.06 });
  // Head shadow lower-right
  g.arc(W / 2 + 2.5, 14, 5, Math.PI * 0.2, Math.PI * 0.8);
  g.fill({ color: 0x000000, alpha: 0.05 });

  // Chin (small triangle at bottom of head)
  g.moveTo(W / 2 - 2.5, 18);
  g.lineTo(W / 2, 20);
  g.lineTo(W / 2 + 2.5, 18);
  g.closePath();
  g.fill(skin);

  // Ears (semicircles on head sides)
  g.arc(W / 2 - 7.7, 11.5, 2, Math.PI * 0.5, Math.PI * 1.5);
  g.fill(skin);
  g.arc(W / 2 + 7.7, 11.5, 2, -Math.PI * 0.5, Math.PI * 0.5);
  g.fill(skin);

  // Eyebrows
  if (isFeminine) {
    // Thinner, arched eyebrows
    g.moveTo(12.5, 9.2); g.quadraticCurveTo(14, 8.4, 15.5, 9);
    g.stroke({ width: 0.5, color: hair, alpha: 0.4 });
    g.moveTo(20.5, 9); g.quadraticCurveTo(22, 8.4, 23.5, 9.2);
    g.stroke({ width: 0.5, color: hair, alpha: 0.4 });
  } else {
    g.rect(12.5, 9, 3, 0.8);
    g.fill({ color: hair, alpha: 0.4 });
    g.rect(20.5, 9, 3, 0.8);
    g.fill({ color: hair, alpha: 0.4 });
  }

  // Eyes
  const eyeRadius = isFeminine ? 1.5 : 1.3;
  g.circle(14, 10, eyeRadius);
  g.fill(0xffffff);
  g.circle(14, 10, 0.8);
  g.fill(0x111111);
  g.circle(22, 10, eyeRadius);
  g.fill(0xffffff);
  g.circle(22, 10, 0.8);
  g.fill(0x111111);

  // Eye specular highlights
  g.circle(14.5, 10, 0.4);
  g.fill({ color: 0xffffff, alpha: 0.8 });
  g.circle(22.5, 10, 0.4);
  g.fill({ color: 0xffffff, alpha: 0.8 });

  // Eyelashes (feminine only)
  if (isFeminine) {
    g.moveTo(12.5, 9); g.lineTo(12, 8.5);
    g.stroke({ width: 0.5, color: 0x111111, alpha: 0.5 });
    g.moveTo(15.5, 9.2); g.lineTo(16, 8.7);
    g.stroke({ width: 0.5, color: 0x111111, alpha: 0.5 });
    g.moveTo(20.5, 9.2); g.lineTo(20, 8.7);
    g.stroke({ width: 0.5, color: 0x111111, alpha: 0.5 });
    g.moveTo(23.5, 9); g.lineTo(24, 8.5);
    g.stroke({ width: 0.5, color: 0x111111, alpha: 0.5 });
  }

  // Nose
  g.circle(18, 12, isFeminine ? 1 : 1.3);
  g.fill(skinDark);

  // Mouth
  if (isFeminine) {
    // Softer lips with subtle color
    g.moveTo(15.5, 15.5);
    g.quadraticCurveTo(18, 16.5, 20.5, 15.5);
    g.stroke({ width: 1, color: 0xcc8888, alpha: 0.4 });
  } else {
    g.moveTo(15.5, 15.5);
    g.lineTo(18, 16);
    g.lineTo(20.5, 15.5);
    g.stroke({ width: 0.8, color: skinDark, alpha: 0.4 });
  }

  // Hair based on style
  const style = a.hairStyle % 5;
  switch (style) {
    case 0: // Bald — just a shine
      g.circle(15.5, 6.5, 2.5);
      g.fill({ color: 0xffffff, alpha: 0.1 });
      // Strand lines
      g.moveTo(13, 5); g.lineTo(15.5, 4);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(17, 4.5); g.lineTo(19.5, 5);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      break;
    case 1: // Short crop
      g.arc(W / 2, 10, 8.5, Math.PI + 0.3, -0.3);
      g.fill(hair);
      // Side fade
      g.rect(10, 8, 2.5, 5);
      g.fill({ color: hair, alpha: 0.5 });
      g.rect(23, 8, 2.5, 5);
      g.fill({ color: hair, alpha: 0.5 });
      // Strand lines
      g.moveTo(13, 5); g.lineTo(14, 3);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(17, 4); g.lineTo(18, 2.5);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(20.5, 4.5); g.lineTo(22, 3);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      break;
    case 2: // Mohawk (tall)
      g.rect(14, 0, 8, 9);
      g.fill(hair);
      // Highlight
      g.rect(17, 1.5, 2.5, 6.5);
      g.fill({ color: 0xffffff, alpha: 0.08 });
      // Strand lines
      g.moveTo(15.5, 1.5); g.lineTo(16, 0);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(18, 0.5); g.lineTo(18.5, 0);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(20.5, 1.5); g.lineTo(20, 0);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      break;
    case 3: // Long flowing
      g.arc(W / 2, 10, 9, Math.PI, 0);
      g.fill(hair);
      // Side hair as tapered polygons (wider at top, narrower at bottom)
      g.moveTo(6.5, 8);
      g.lineTo(10, 8);
      g.lineTo(9.5, 23);
      g.lineTo(7, 23);
      g.closePath();
      g.fill(hair);
      g.moveTo(26, 8);
      g.lineTo(29.5, 8);
      g.lineTo(29, 23);
      g.lineTo(26.5, 23);
      g.closePath();
      g.fill(hair);
      // Hair highlight
      g.rect(7.5, 9, 1.5, 13);
      g.fill({ color: 0xffffff, alpha: 0.08 });
      // Strand lines
      g.moveTo(7.5, 10); g.lineTo(8, 20.5);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(27, 10); g.lineTo(27.5, 20.5);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(15.5, 4); g.lineTo(17, 2.5);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      break;
    case 4: // Spiky
      for (let i = 0; i < 5; i++) {
        const sx = 11.5 + i * 3;
        g.moveTo(sx - 1.5, 6.5);
        g.lineTo(sx, 0 + (i % 2));
        g.lineTo(sx + 1.5, 6.5);
        g.fill(hair);
      }
      g.arc(W / 2, 10, 8.5, Math.PI + 0.2, -0.2);
      g.fill(hair);
      // Strand lines on spikes
      g.moveTo(13, 5); g.lineTo(13, 2);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(18, 4); g.lineTo(18, 0.5);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      g.moveTo(23, 5); g.lineTo(23, 2);
      g.stroke({ width: 0.3, color: hairLight, alpha: 0.08 });
      break;
  }

  // Equipment overlays
  if (equip) {
    // Chest armor changes shirt color overlay
    if (equip.chest) {
      const armorColors: Record<string, number> = {
        leather_chest: 0x6b4226,
        chain_mail: 0x888888,
        iron_plate: 0x666666,
        drake_plate: 0x882222,
      };
      const armorColor = armorColors[equip.chest];
      if (armorColor) {
        // Armor overlay on torso
        g.moveTo(9, 18);
        g.lineTo(27, 18);
        g.lineTo(26, 32);
        g.lineTo(10, 32);
        g.closePath();
        g.fill({ color: armorColor, alpha: 0.7 });
        // Shoulder pads
        g.ellipse(9, 19, 4, 2.5);
        g.fill({ color: armorColor, alpha: 0.6 });
        g.ellipse(27, 19, 4, 2.5);
        g.fill({ color: armorColor, alpha: 0.6 });
      }
    }

    // Helmet
    if (equip.head) {
      const helmColors: Record<string, { color: number; hasNoseGuard?: boolean; hasHorns?: boolean }> = {
        leather_cap: { color: 0x6b4226 },
        iron_helm: { color: 0x777777, hasNoseGuard: true },
        dragon_helm: { color: 0x882222, hasHorns: true },
      };
      const helm = helmColors[equip.head];
      if (helm) {
        // Helmet dome over head
        g.arc(W / 2, 10, 8.5, Math.PI, 0);
        g.fill(helm.color);
        if (helm.hasNoseGuard) {
          g.rect(17, 8, 2.5, 6.5);
          g.fill({ color: helm.color, alpha: 0.8 });
        }
        if (helm.hasHorns) {
          g.moveTo(11.5, 5); g.lineTo(9, 0); g.lineTo(14, 5);
          g.fill(0x661111);
          g.moveTo(22, 5); g.lineTo(27, 0); g.lineTo(24.5, 5);
          g.fill(0x661111);
        }
      }
    }

    // Weapon (right hand)
    if (equip.weapon) {
      const isAxe = equip.weapon.includes('axe');
      const isBow = equip.weapon.includes('bow');
      if (isBow) {
        // Bow arc
        g.moveTo(29.5, 20.5);
        g.bezierCurveTo(33.5, 24, 33.5, 31, 29.5, 34.5);
        g.stroke({ width: 1.5, color: 0x8b6914 });
        g.moveTo(29.5, 20.5); g.lineTo(29.5, 34.5);
        g.stroke({ width: 0.5, color: 0xcccccc });
      } else if (isAxe) {
        // Axe handle + head
        g.rect(29.5, 18, 2, 15.5);
        g.fill(0x5c3a1e);
        g.moveTo(28.5, 18); g.lineTo(33.5, 15.5); g.lineTo(33.5, 22); g.lineTo(28.5, 19);
        g.fill(0x888888);
      } else {
        // Sword
        g.rect(29.5, 15.5, 2, 15.5);
        g.fill(0xaaaaaa);
        g.rect(27, 14, 8, 2);
        g.fill(0x8b6914);
        // Blade highlight
        g.rect(30, 17, 0.5, 13);
        g.fill({ color: 0xffffff, alpha: 0.3 });
      }
    }

    // Shield (left arm)
    if (equip.shield) {
      g.roundRect(1.5, 22, 6.5, 9, 2);
      g.fill(0x666666);
      g.roundRect(1.5, 22, 6.5, 9, 2);
      g.stroke({ width: 0.5, color: 0x444444 });
      // Shield emblem
      g.rect(4, 23, 1.5, 5);
      g.fill(0xccaa44);
    }

    // Boots
    if (equip.feet) {
      const bootColor = equip.feet.includes('iron') ? 0x555555 : 0x4a3a2a;
      g.roundRect(10, H - 6, 5, 4, 1.5);
      g.fill(bootColor);
      g.roundRect(20.5, H - 6, 5, 4, 1.5);
      g.fill(bootColor);
    }
  }
}

export function getPlayerTexture(appearance?: Appearance, equipment?: Record<string, string>): Texture {
  const a: Appearance = {
    hairStyle: appearance?.hairStyle ?? 0,
    hairColor: appearance?.hairColor ?? 0,
    skinColor: appearance?.skinColor ?? 0,
    shirtColor: appearance?.shirtColor ?? 0,
    bodyType: appearance?.bodyType ?? 0,
  };
  const key = cacheKey(a, equipment);

  if (cache.has(key)) return cache.get(key)!;

  const g = new Graphics();
  drawPlayer(g, a, equipment);
  const tex = TextureFactory.generate(g, W, H);
  cache.set(key, tex);
  return tex;
}

export const PLAYER_SPRITE_SIZE = { w: W, h: H };
