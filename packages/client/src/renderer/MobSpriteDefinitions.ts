import { Graphics, Texture } from "pixi.js";
import { TextureFactory } from "./TextureFactory.js";

type DrawFn = (g: Graphics, w: number, h: number) => void;

interface MobVisual {
  width: number;
  height: number;
  draw: DrawFn;
  isBoss?: boolean;
}

// Helper: 1px dark outline around a shape for readability
function outline(g: Graphics, x: number, y: number, w: number, h: number): void {
  g.rect(x - 0.5, y - 0.5, w + 1, h + 1);
  g.stroke({ width: 1, color: 0x111111, alpha: 0.5 });
}

const DEFS: Record<string, MobVisual> = {
  Chicken: {
    width: 28, height: 26,
    draw(g, w, h) {
      // Ground shadow
      g.ellipse(w / 2, h / 2 + 9.5, 6.4, 2.4);
      g.fill({ color: 0x000000, alpha: 0.15 });
      // Body (slightly larger: 8.9x7.1)
      g.ellipse(w / 2, h / 2 + 2.4, 8.9, 7.1);
      g.fill(0xf0c040);
      g.ellipse(w / 2, h / 2 + 2.4, 8.9, 7.1);
      g.stroke({ width: 1, color: 0xc09020, alpha: 0.15 });
      // Tail fan: 2 overlapping triangles
      g.moveTo(w / 2 - 7.6, h / 2); g.lineTo(w / 2 - 12.7, h / 2 - 4.7); g.lineTo(w / 2 - 8.9, h / 2 + 1.2);
      g.fill(0xe0b838);
      g.moveTo(w / 2 - 7.6, h / 2 + 1.2); g.lineTo(w / 2 - 11.5, h / 2 - 2.4); g.lineTo(w / 2 - 7.6, h / 2 + 2.4);
      g.fill(0xe0b030);
      // Wing
      g.ellipse(w / 2 - 2.5, h / 2 + 2.4, 3.8, 3.5);
      g.fill(0xe0b030);
      // Comb
      g.circle(w / 2 + 1.3, h / 2 - 4.7, 2.5);
      g.fill(0xe74c3c);
      g.circle(w / 2 - 1.3, h / 2 - 3.5, 1.9);
      g.fill(0xe74c3c);
      // Head
      g.circle(w / 2 + 1.3, h / 2 - 1.2, 3.8);
      g.fill(0xf0c848);
      // Eye
      g.circle(w / 2 + 3.8, h / 2 - 2.4, 1.3);
      g.fill(0x111111);
      // Beak
      g.moveTo(w / 2 + 6.4, h / 2 - 1.2);
      g.lineTo(w / 2 + 10.2, h / 2);
      g.lineTo(w / 2 + 6.4, h / 2 + 1.2);
      g.fill(0xf09020);
      // Legs
      g.moveTo(w / 2 - 2.5, h / 2 + 7.1); g.lineTo(w / 2 - 3.8, h / 2 + 11.8); g.lineTo(w / 2 - 6.4, h / 2 + 11.8);
      g.stroke({ width: 1, color: 0xf09020 });
      g.moveTo(w / 2 + 2.5, h / 2 + 7.1); g.lineTo(w / 2 + 3.8, h / 2 + 11.8); g.lineTo(w / 2 + 6.4, h / 2 + 11.8);
      g.stroke({ width: 1, color: 0xf09020 });
      // Toe detail: 3 forward-splaying lines per foot
      // Left foot toes
      g.moveTo(w / 2 - 3.8, h / 2 + 11.8); g.lineTo(w / 2 - 6.4, h / 2 + 11.8);
      g.stroke({ width: 0.5, color: 0xf09020 });
      g.moveTo(w / 2 - 3.8, h / 2 + 11.8); g.lineTo(w / 2 - 5.1, h / 2 + 13);
      g.stroke({ width: 0.5, color: 0xf09020 });
      g.moveTo(w / 2 - 3.8, h / 2 + 11.8); g.lineTo(w / 2 - 2.5, h / 2 + 13);
      g.stroke({ width: 0.5, color: 0xf09020 });
      // Right foot toes
      g.moveTo(w / 2 + 3.8, h / 2 + 11.8); g.lineTo(w / 2 + 6.4, h / 2 + 11.8);
      g.stroke({ width: 0.5, color: 0xf09020 });
      g.moveTo(w / 2 + 3.8, h / 2 + 11.8); g.lineTo(w / 2 + 5.1, h / 2 + 13);
      g.stroke({ width: 0.5, color: 0xf09020 });
      g.moveTo(w / 2 + 3.8, h / 2 + 11.8); g.lineTo(w / 2 + 2.5, h / 2 + 13);
      g.stroke({ width: 0.5, color: 0xf09020 });
      // Feather texture strokes
      g.moveTo(w / 2 - 3, h / 2); g.quadraticCurveTo(w / 2 - 5, h / 2 - 2, w / 2 - 4, h / 2 + 2);
      g.stroke({ width: 0.5, color: 0xd8b030, alpha: 0.25 });
      g.moveTo(w / 2 - 1, h / 2 + 1); g.quadraticCurveTo(w / 2 - 3, h / 2 - 1, w / 2 - 2, h / 2 + 3);
      g.stroke({ width: 0.5, color: 0xd8b030, alpha: 0.25 });
      g.moveTo(w / 2 + 1, h / 2 + 2); g.quadraticCurveTo(w / 2, h / 2, w / 2 + 2, h / 2 + 4);
      g.stroke({ width: 0.5, color: 0xd8b030, alpha: 0.2 });
    },
  },

  Cow: {
    width: 36, height: 30,
    draw(g, w, h) {
      // Body
      g.roundRect(6, 8, 24, 14, 4);
      g.fill(0x8b6914);
      g.roundRect(6, 8, 24, 14, 4);
      g.stroke({ width: 1, color: 0x5a4008, alpha: 0.15 });
      // Belly highlight
      g.ellipse(18, 17, 10, 4);
      g.fill(0xc2a060);
      // Udder (pink ellipse beneath belly)
      g.ellipse(18, 21, 3, 2);
      g.fill(0xffaaaa);
      // Spots
      g.ellipse(12, 12, 3, 2.5);
      g.fill(0x4a3a2a);
      g.ellipse(22, 10, 2.5, 2);
      g.fill(0x4a3a2a);
      // Head
      g.circle(28, 8, 5);
      g.fill(0x8b6914);
      g.circle(28, 8, 5);
      g.stroke({ width: 1, color: 0x5a4008, alpha: 0.4 });
      // Ears (angled ellipses on head sides)
      g.ellipse(24, 5, 2.5, 1.2);
      g.fill(0x8b6914);
      g.ellipse(24, 5, 2.5, 1.2);
      g.stroke({ width: 0.3, color: 0x5a4008, alpha: 0.15 });
      g.ellipse(32, 5, 2.5, 1.2);
      g.fill(0x8b6914);
      g.ellipse(32, 5, 2.5, 1.2);
      g.stroke({ width: 0.3, color: 0x5a4008, alpha: 0.15 });
      // Snout
      g.ellipse(30, 10, 3, 2);
      g.fill(0xc2a060);
      // Horns
      g.moveTo(25, 3); g.lineTo(24, 0); g.lineTo(26, 3);
      g.fill(0xccccaa);
      g.moveTo(31, 3); g.lineTo(32, 0); g.lineTo(30, 3);
      g.fill(0xccccaa);
      // Fur tuft between horns
      g.moveTo(27, 3); g.lineTo(27.5, 1);
      g.stroke({ width: 0.5, color: 0xa07a20 });
      g.moveTo(28, 3); g.lineTo(28.5, 0.5);
      g.stroke({ width: 0.5, color: 0xa07a20 });
      g.moveTo(29, 3); g.lineTo(29, 1);
      g.stroke({ width: 0.5, color: 0xa07a20 });
      g.moveTo(28, 2.5); g.lineTo(28, 0);
      g.stroke({ width: 0.5, color: 0xa07a20 });
      // Eyes
      g.circle(27, 7, 1.2);
      g.fill(0x111111);
      g.circle(30, 7, 1.2);
      g.fill(0x111111);
      // Legs
      for (const x of [10, 16, 22, 27]) {
        g.rect(x, 22, 3, 6);
        g.fill(0x7b5904);
        // Hoof
        g.rect(x, 27, 3, 1.5);
        g.fill(0x444444);
      }
      // Tail
      g.moveTo(6, 10); g.lineTo(2, 14); g.lineTo(1, 12);
      g.stroke({ width: 1.5, color: 0x8b6914 });
    },
  },

  Goblin: {
    width: 32, height: 34,
    draw(g, w, h) {
      // Body
      g.roundRect(8.6, 14.6, 14.8, 12.1, 3.7);
      g.fill(0x3a7a3a);
      g.roundRect(8.6, 14.6, 14.8, 12.1, 3.7);
      g.stroke({ width: 1, color: 0x1a4a1a, alpha: 0.15 });
      // Belt
      g.rect(8.6, 21.9, 14.8, 2.4);
      g.fill(0x5c3a1e);
      // Loincloth detail: 3 small downward triangles at body bottom edge
      g.moveTo(11.1, 26.7); g.lineTo(12.3, 29.1); g.lineTo(13.5, 26.7);
      g.fill(0x4a3018);
      g.moveTo(14.8, 26.7); g.lineTo(16, 29.7); g.lineTo(17.2, 26.7);
      g.fill(0x4a3018);
      g.moveTo(18.5, 26.7); g.lineTo(19.7, 29.1); g.lineTo(20.9, 26.7);
      g.fill(0x4a3018);
      // Head
      g.circle(w / 2, 10.9, 7.4);
      g.fill(0x4a9a4a);
      g.circle(w / 2, 10.9, 7.4);
      g.stroke({ width: 1, color: 0x2a6a2a, alpha: 0.15 });
      // Ears
      g.moveTo(6.2, 8.5); g.lineTo(2.5, 2.4); g.lineTo(8.6, 8.5);
      g.fill(0x4a9a4a);
      g.moveTo(25.8, 8.5); g.lineTo(29.5, 2.4); g.lineTo(23.4, 8.5);
      g.fill(0x4a9a4a);
      // Eyes (glowing yellow)
      g.circle(12.3, 9.7, 2.5);
      g.fill(0xffff00);
      g.circle(12.3, 9.7, 1);
      g.fill(0x111111);
      g.circle(19.7, 9.7, 2.5);
      g.fill(0xffff00);
      g.circle(19.7, 9.7, 1);
      g.fill(0x111111);
      // Nose
      g.circle(16, 13.4, 1.5);
      g.fill(0x3a7a3a);
      // Mouth
      g.moveTo(12.3, 15.8); g.lineTo(16, 17); g.lineTo(19.7, 15.8);
      g.stroke({ width: 0.5, color: 0x2a5a2a });
      // Arms
      g.rect(4.9, 17, 3.7, 8.5);
      g.fill(0x4a9a4a);
      g.rect(23.4, 17, 3.7, 8.5);
      g.fill(0x4a9a4a);
      // Legs
      g.rect(11.1, 26.7, 3.7, 6.1);
      g.fill(0x3a7a3a);
      g.rect(17.2, 26.7, 3.7, 6.1);
      g.fill(0x3a7a3a);
      // Feet
      g.rect(9.8, 31.6, 4.9, 2.4);
      g.fill(0x2a5a2a);
      g.rect(17.2, 31.6, 4.9, 2.4);
      g.fill(0x2a5a2a);
      // Loincloth fold lines
      g.moveTo(11, 27); g.lineTo(12, 29);
      g.stroke({ width: 0.3, color: 0x3a2010, alpha: 0.3 });
      g.moveTo(15, 27); g.lineTo(16, 30);
      g.stroke({ width: 0.3, color: 0x3a2010, alpha: 0.3 });
      // Ear inner color
      g.moveTo(3, 3); g.lineTo(6, 8);
      g.stroke({ width: 1, color: 0x3a7a3a, alpha: 0.3 });
      g.moveTo(29, 3); g.lineTo(26, 8);
      g.stroke({ width: 1, color: 0x3a7a3a, alpha: 0.3 });
    },
  },

  "Goblin Sentry": {
    width: 34, height: 36,
    draw(g, w, h) {
      DEFS.Goblin.draw(g, 32, 34);
      // Shield on left arm
      g.roundRect(1, 17, 6.2, 9.7, 1.2);
      g.fill(0x8b6914);
      g.roundRect(1, 17, 6.2, 9.7, 1.2);
      g.stroke({ width: 1, color: 0x5a4008 });
      g.rect(3.7, 18.2, 1.2, 7.3);
      g.fill(0xaaa060);
    },
  },

  "Goblin Warrior": {
    width: 36, height: 36,
    draw(g, w, h) {
      DEFS.Goblin.draw(g, 32, 34);
      // Sword on right
      g.rect(28.3, 12.1, 2.5, 17);
      g.fill(0xaaaaaa);
      g.rect(27.1, 10.9, 4.9, 2.4);
      g.fill(0x8b6914);
      // Blade highlight
      g.rect(28.9, 13.4, 0.6, 14.6);
      g.fill({ color: 0xffffff, alpha: 0.3 });
    },
  },

  "Goblin Mage": {
    width: 34, height: 36,
    draw(g, w, h) {
      DEFS.Goblin.draw(g, 32, 34);
      // Staff
      g.rect(27.1, 4.9, 2.5, 26.7);
      g.fill(0x5c3a1e);
      // Orb
      g.circle(28.3, 4.9, 3.7);
      g.fill(0x9944ff);
      g.circle(28.3, 4.9, 1.8);
      g.fill({ color: 0xeeccff, alpha: 0.6 });
      // Glow
      g.circle(28.3, 4.9, 6.2);
      g.fill({ color: 0x9944ff, alpha: 0.12 });
    },
  },

  Skeleton: {
    width: 30, height: 38,
    draw(g, w, h) {
      // Skull
      g.circle(w / 2, 8.3, 6.3);
      g.fill(0xeeeedd);
      g.circle(w / 2, 8.3, 6.3);
      g.stroke({ width: 1, color: 0x999988, alpha: 0.15 });
      // Jaw
      g.roundRect(10, 11.9, 10, 3.6, 1.3);
      g.fill(0xddddcc);
      // Eye sockets
      g.circle(11.3, 7.1, 2.5);
      g.fill(0x1a1a1a);
      g.circle(18.8, 7.1, 2.5);
      g.fill(0x1a1a1a);
      // Eye glow
      g.circle(11.3, 7.1, 1);
      g.fill(0xff4444);
      g.circle(18.8, 7.1, 1);
      g.fill(0xff4444);
      // Spine/Torso
      g.rect(12.5, 15.4, 5, 11.9);
      g.fill(0xddddbb);
      // Ribs (slightly curved arcs instead of straight rects)
      for (let ry = 16.6; ry < 26.1; ry += 2.4) {
        // Left rib arc
        g.moveTo(8.8, ry + 0.6);
        g.bezierCurveTo(11.3, ry - 0.6, 12.5, ry - 0.4, 15, ry + 0.6);
        g.stroke({ width: 1, color: 0xccccaa });
        // Right rib arc
        g.moveTo(15, ry + 0.6);
        g.bezierCurveTo(17.5, ry - 0.4, 18.8, ry - 0.6, 21.3, ry + 0.6);
        g.stroke({ width: 1, color: 0xccccaa });
        // Rib shadow
        g.moveTo(8.8, ry + 1.4);
        g.bezierCurveTo(11.3, ry + 0.2, 12.5, ry + 0.5, 15, ry + 1.4);
        g.stroke({ width: 0.5, color: 0x000000, alpha: 0.1 });
        g.moveTo(15, ry + 1.4);
        g.bezierCurveTo(17.5, ry + 0.5, 18.8, ry + 0.2, 21.3, ry + 1.4);
        g.stroke({ width: 0.5, color: 0x000000, alpha: 0.1 });
      }
      // Arms (bone segments)
      g.rect(5, 15.4, 3.8, 4.8);
      g.fill(0xddddbb);
      g.rect(3.8, 20.2, 3.8, 4.8);
      g.fill(0xccccaa);
      g.rect(21.3, 15.4, 3.8, 4.8);
      g.fill(0xddddbb);
      g.rect(22.5, 20.2, 3.8, 4.8);
      g.fill(0xccccaa);
      // Legs
      g.rect(11.3, 27.3, 3.8, 7.1);
      g.fill(0xddddbb);
      g.rect(15, 27.3, 3.8, 7.1);
      g.fill(0xddddbb);
      // Feet
      g.rect(10, 33.3, 5, 2.4);
      g.fill(0xccccaa);
      g.rect(15, 33.3, 5, 2.4);
      g.fill(0xccccaa);
      // Joint circles (elbows and knees)
      g.circle(6, 21, 1.2); g.fill({ color: 0xccccaa, alpha: 0.5 });
      g.circle(24, 21, 1.2); g.fill({ color: 0xccccaa, alpha: 0.5 });
      g.circle(12, 30, 1); g.fill({ color: 0xccccaa, alpha: 0.5 });
      g.circle(18, 30, 1); g.fill({ color: 0xccccaa, alpha: 0.5 });
      // Skull crack
      g.moveTo(w / 2 - 2, 4); g.lineTo(w / 2 - 1, 8); g.lineTo(w / 2 + 1, 6);
      g.stroke({ width: 0.5, color: 0x888877, alpha: 0.4 });
    },
  },

  "Bone Archer": {
    width: 28, height: 32,
    draw(g, w, h) {
      DEFS.Skeleton.draw(g, 24, 32);
      // Bow
      g.moveTo(22, 10);
      g.bezierCurveTo(26, 15, 26, 22, 22, 27);
      g.stroke({ width: 1.5, color: 0x8b6914 });
      // Bowstring
      g.moveTo(22, 10); g.lineTo(22, 27);
      g.stroke({ width: 0.5, color: 0xcccccc });
    },
  },

  "Dark Cultist": {
    width: 24, height: 32,
    draw(g, w, h) {
      // Dark robe
      g.moveTo(6, 10); g.lineTo(4, 30); g.lineTo(20, 30); g.lineTo(18, 10);
      g.fill(0x1a0a2e);
      g.moveTo(6, 10); g.lineTo(4, 30); g.lineTo(20, 30); g.lineTo(18, 10);
      g.stroke({ width: 1, color: 0x0a0a1a, alpha: 0.5 });
      // Hood
      g.moveTo(6, 10); g.lineTo(w / 2, 2); g.lineTo(18, 10);
      g.fill(0x1a0a2e);
      // Face shadow
      g.ellipse(w / 2, 9, 4, 3);
      g.fill(0x0a0a0a);
      // Glowing eyes
      g.circle(10, 8, 1.5);
      g.fill(0xaa44ff);
      g.circle(14, 8, 1.5);
      g.fill(0xaa44ff);
      g.circle(10, 8, 0.6);
      g.fill(0xeeccff);
      g.circle(14, 8, 0.6);
      g.fill(0xeeccff);
      // Hands
      g.circle(5, 20, 2);
      g.fill(0x8866aa);
      g.circle(19, 20, 2);
      g.fill(0x8866aa);
      // Robe trim
      g.rect(4, 28, 16, 2);
      g.fill(0x3a1a5e);
    },
  },

  "Bone Golem": {
    width: 32, height: 34,
    draw(g, w, h) {
      // Massive body
      g.roundRect(6, 10, 20, 16, 4);
      g.fill(0xddddbb);
      g.roundRect(6, 10, 20, 16, 4);
      g.stroke({ width: 1.5, color: 0x999988 });
      // Bone texture
      for (let by = 12; by < 24; by += 3) {
        g.rect(8, by, 16, 1);
        g.fill({ color: 0xccccaa, alpha: 0.5 });
      }
      // Head (skull)
      g.circle(w / 2, 8, 6);
      g.fill(0xeeeedd);
      g.circle(w / 2, 8, 6);
      g.stroke({ width: 1, color: 0x999988 });
      g.circle(13, 7, 2);
      g.fill(0x1a1a1a);
      g.circle(19, 7, 2);
      g.fill(0x1a1a1a);
      g.circle(13, 7, 0.8);
      g.fill(0xff6666);
      g.circle(19, 7, 0.8);
      g.fill(0xff6666);
      // Arms (thick bone)
      g.rect(2, 12, 5, 12);
      g.fill(0xccccaa);
      g.rect(25, 12, 5, 12);
      g.fill(0xccccaa);
      // Fists
      g.circle(4, 25, 3);
      g.fill(0xddddbb);
      g.circle(28, 25, 3);
      g.fill(0xddddbb);
      // Legs
      g.rect(10, 26, 4, 7);
      g.fill(0xccccaa);
      g.rect(18, 26, 4, 7);
      g.fill(0xccccaa);
    },
  },

  "Skeleton Soldier": {
    width: 26, height: 32,
    draw(g, w, h) {
      DEFS.Skeleton.draw(g, 24, 32);
      // Helmet
      g.arc(12, 7, 6, Math.PI, 0);
      g.fill(0x777777);
      g.arc(12, 7, 6, Math.PI, 0);
      g.stroke({ width: 0.5, color: 0x555555 });
      // Sword
      g.rect(21, 14, 2, 10);
      g.fill(0xaaaaaa);
      g.rect(20, 13, 4, 2);
      g.fill(0x8b6914);
    },
  },

  "Forest Spider": {
    width: 38, height: 28,
    draw(g, w, h) {
      // Abdomen
      g.ellipse(26.1, 15.2, 8.3, 5.8);
      g.fill(0x3a2a1a);
      g.ellipse(26.1, 15.2, 8.3, 5.8);
      g.stroke({ width: 1, color: 0x1a1a0a, alpha: 0.5 });
      // Pattern on abdomen
      g.circle(26.1, 14, 2.4);
      g.fill(0x5a4a3a);
      g.circle(23.8, 16.3, 1.2);
      g.fill(0x5a4a3a);
      g.circle(28.5, 16.3, 1.2);
      g.fill(0x5a4a3a);
      // Spinnerets: 2 small dots at rear of abdomen
      g.circle(33.3, 16.3, 1);
      g.fill(0x2a1a0a);
      g.circle(34.4, 14.6, 1);
      g.fill(0x2a1a0a);
      // Cephalothorax
      g.circle(14.3, 15.2, 5.9);
      g.fill(0x4a3a2a);
      g.circle(14.3, 15.2, 5.9);
      g.stroke({ width: 1, color: 0x2a1a0a, alpha: 0.4 });
      // Eyes (multiple)
      g.circle(10.7, 11.7, 1.4);
      g.fill(0xff0000);
      g.circle(13.1, 10.5, 1.8);
      g.fill(0xff0000);
      g.circle(15.4, 10.5, 1.8);
      g.fill(0xff0000);
      g.circle(17.8, 11.7, 1.4);
      g.fill(0xff0000);
      // Eye glints
      g.circle(13.1, 10.5, 0.6);
      g.fill(0xffaaaa);
      g.circle(15.4, 10.5, 0.6);
      g.fill(0xffaaaa);
      // Legs (4 per side, thicker with joints)
      const angles = [-0.7, -0.3, 0.15, 0.5];
      for (const a of angles) {
        // Left legs
        const lx1 = 14.3 + Math.cos(Math.PI + a) * 5.9;
        const ly1 = 15.2 + Math.sin(Math.PI + a) * 4.7;
        const lx2 = 14.3 + Math.cos(Math.PI + a) * 13.1;
        const ly2 = 15.2 + Math.sin(Math.PI + a) * 10.5;
        g.moveTo(14.3, 15.2); g.lineTo(lx1, ly1); g.lineTo(lx2, ly2);
        g.stroke({ width: 2, color: 0x3a2a1a });
        // Bristle lines perpendicular to leg segments
        const lmx = (lx1 + lx2) / 2, lmy = (ly1 + ly2) / 2;
        const ldx = lx2 - lx1, ldy = ly2 - ly1;
        const llen = Math.sqrt(ldx * ldx + ldy * ldy);
        const lnx = -ldy / llen, lny = ldx / llen;
        g.moveTo(lmx - lnx * 1.8, lmy - lny * 1.8); g.lineTo(lmx + lnx * 1.8, lmy + lny * 1.8);
        g.stroke({ width: 0.5, color: 0x4a3a2a });
        g.moveTo(lmx - lnx * 1.4 + ldx * 0.15, lmy - lny * 1.4 + ldy * 0.15); g.lineTo(lmx + lnx * 1.4 + ldx * 0.15, lmy + lny * 1.4 + ldy * 0.15);
        g.stroke({ width: 0.5, color: 0x4a3a2a });
        g.moveTo(lmx - lnx * 1.4 - ldx * 0.15, lmy - lny * 1.4 - ldy * 0.15); g.lineTo(lmx + lnx * 1.4 - ldx * 0.15, lmy + lny * 1.4 - ldy * 0.15);
        g.stroke({ width: 0.5, color: 0x4a3a2a });
        // Right legs
        const rx1 = 14.3 + Math.cos(a) * 5.9;
        const ry1 = 15.2 + Math.sin(a) * 4.7;
        const rx2 = 14.3 + Math.cos(a) * 13.1;
        const ry2 = 15.2 + Math.sin(a) * 10.5;
        g.moveTo(14.3, 15.2); g.lineTo(rx1, ry1); g.lineTo(rx2, ry2);
        g.stroke({ width: 2, color: 0x3a2a1a });
        // Bristle lines on right legs
        const rmx = (rx1 + rx2) / 2, rmy = (ry1 + ry2) / 2;
        const rdx = rx2 - rx1, rdy = ry2 - ry1;
        const rlen = Math.sqrt(rdx * rdx + rdy * rdy);
        const rnx = -rdy / rlen, rny = rdx / rlen;
        g.moveTo(rmx - rnx * 1.8, rmy - rny * 1.8); g.lineTo(rmx + rnx * 1.8, rmy + rny * 1.8);
        g.stroke({ width: 0.5, color: 0x4a3a2a });
        g.moveTo(rmx - rnx * 1.4 + rdx * 0.15, rmy - rny * 1.4 + rdy * 0.15); g.lineTo(rmx + rnx * 1.4 + rdx * 0.15, rmy + rny * 1.4 + rdy * 0.15);
        g.stroke({ width: 0.5, color: 0x4a3a2a });
        g.moveTo(rmx - rnx * 1.4 - rdx * 0.15, rmy - rny * 1.4 - rdy * 0.15); g.lineTo(rmx + rnx * 1.4 - rdx * 0.15, rmy + rny * 1.4 - rdy * 0.15);
        g.stroke({ width: 0.5, color: 0x4a3a2a });
      }
      // Fangs
      g.moveTo(11.9, 17.5); g.lineTo(10.7, 21);
      g.stroke({ width: 1.5, color: 0xeeeedd });
      g.moveTo(16.6, 17.5); g.lineTo(17.8, 21);
      g.stroke({ width: 1.5, color: 0xeeeedd });
    },
  },

  "Goblin Chieftain": {
    width: 36, height: 40, isBoss: true,
    draw(g, w, h) {
      // Aura glow (larger, brighter)
      g.circle(w / 2, h / 2, 18);
      g.fill({ color: 0xffaa00, alpha: 0.08 });
      g.circle(w / 2, h / 2, 14);
      g.fill({ color: 0xffcc44, alpha: 0.06 });
      // Cape
      g.moveTo(7, 18); g.lineTo(w / 2, 34); g.lineTo(29, 18);
      g.fill(0xcc2222);
      g.moveTo(7, 18); g.lineTo(w / 2, 34); g.lineTo(29, 18);
      g.stroke({ width: 1, color: 0x881111, alpha: 0.5 });
      // Body (large)
      g.roundRect(10, 17, 16, 13, 3);
      g.fill(0x3a7a3a);
      g.roundRect(10, 17, 16, 13, 3);
      g.stroke({ width: 1, color: 0x1a4a1a, alpha: 0.5 });
      // Belt with buckle
      g.rect(10, 25, 16, 3);
      g.fill(0x5c3a1e);
      g.rect(16, 25, 4, 3);
      g.fill(0xffd700);
      // Head (bigger)
      g.circle(w / 2, 13, 8);
      g.fill(0x4a9a4a);
      g.circle(w / 2, 13, 8);
      g.stroke({ width: 1, color: 0x2a6a2a, alpha: 0.4 });
      // Crown
      for (let i = 0; i < 5; i++) {
        const cx = 10 + i * 4;
        g.moveTo(cx, 6); g.lineTo(cx + 2, 1); g.lineTo(cx + 4, 6);
        g.fill(0xffd700);
      }
      g.rect(10, 5, 16, 2);
      g.fill(0xffd700);
      // Gem in crown center
      g.circle(w / 2, 5, 1.5);
      g.fill(0xff0000);
      // Ears
      g.moveTo(6, 11); g.lineTo(2, 4); g.lineTo(9, 11);
      g.fill(0x4a9a4a);
      g.moveTo(30, 11); g.lineTo(34, 4); g.lineTo(27, 11);
      g.fill(0x4a9a4a);
      // Fierce eyes
      g.circle(14, 12, 2.5);
      g.fill(0xff4444);
      g.circle(14, 12, 1);
      g.fill(0xffcccc);
      g.circle(22, 12, 2.5);
      g.fill(0xff4444);
      g.circle(22, 12, 1);
      g.fill(0xffcccc);
      // Tusks
      g.moveTo(13, 17); g.lineTo(12, 20);
      g.stroke({ width: 1.5, color: 0xeeeedd });
      g.moveTo(23, 17); g.lineTo(24, 20);
      g.stroke({ width: 1.5, color: 0xeeeedd });
      // Arms
      g.rect(5, 19, 5, 9);
      g.fill(0x4a9a4a);
      g.rect(26, 19, 5, 9);
      g.fill(0x4a9a4a);
      // Axe in right hand
      g.rect(30, 14, 2, 16);
      g.fill(0x5c3a1e);
      g.moveTo(28, 14); g.lineTo(34, 12); g.lineTo(34, 18); g.lineTo(28, 16);
      g.fill(0x888888);
      // Legs
      g.rect(12, 30, 4, 6);
      g.fill(0x3a7a3a);
      g.rect(20, 30, 4, 6);
      g.fill(0x3a7a3a);
      g.rect(11, 35, 5, 3);
      g.fill(0x2a5a2a);
      g.rect(20, 35, 5, 3);
      g.fill(0x2a5a2a);
    },
  },

  // ── NPC sprites ──

  "Elder Theron": {
    width: 26, height: 34,
    draw(g, w, h) {
      // Blue robe
      g.moveTo(7, 14); g.lineTo(5, 32); g.lineTo(21, 32); g.lineTo(19, 14);
      g.fill(0x2255aa);
      g.moveTo(7, 14); g.lineTo(5, 32); g.lineTo(21, 32); g.lineTo(19, 14);
      g.stroke({ width: 1, color: 0x1a3a77, alpha: 0.5 });
      // Robe trim
      g.rect(5, 30, 16, 2);
      g.fill(0x4488cc);
      // Sash
      g.rect(10, 18, 6, 2);
      g.fill(0xdaa520);
      // Head
      g.circle(w / 2, 10, 6);
      g.fill(0xdeb887);
      outline(g, w / 2 - 6, 4, 12, 12);
      // Gray beard
      g.moveTo(9, 13); g.lineTo(w / 2, 22); g.lineTo(17, 13);
      g.fill(0xbbbbbb);
      g.moveTo(9, 13); g.lineTo(w / 2, 22); g.lineTo(17, 13);
      g.stroke({ width: 0.5, color: 0x999999, alpha: 0.4 });
      // Eyes
      g.circle(11, 9, 1.2); g.fill(0x334455);
      g.circle(15, 9, 1.2); g.fill(0x334455);
      // Eyebrows (bushy, gray)
      g.rect(9, 7, 4, 1); g.fill(0xaaaaaa);
      g.rect(13, 7, 4, 1); g.fill(0xaaaaaa);
      // Staff (left hand)
      g.rect(3, 6, 2, 26); g.fill(0x5c3a1e);
      // Staff orb
      g.circle(4, 5, 3); g.fill(0x44aaff);
      g.circle(4, 5, 1.5); g.fill({ color: 0xccddff, alpha: 0.6 });
      // Hands
      g.circle(6, 20, 2); g.fill(0xdeb887);
      g.circle(20, 20, 2); g.fill(0xdeb887);
    },
  },

  "Merchant Lyra": {
    width: 24, height: 30,
    draw(g, w, h) {
      // Green/brown dress
      g.roundRect(6, 12, 12, 14, 3);
      g.fill(0x3a7a3a);
      g.roundRect(6, 12, 12, 14, 3);
      g.stroke({ width: 1, color: 0x2a5a2a, alpha: 0.5 });
      // Apron (light tan)
      g.roundRect(8, 14, 8, 10, 2);
      g.fill(0xd2b48c);
      g.roundRect(8, 14, 8, 10, 2);
      g.stroke({ width: 0.5, color: 0xa08060, alpha: 0.4 });
      // Belt
      g.rect(6, 17, 12, 2); g.fill(0x5c3a1e);
      // Pouch on belt
      g.roundRect(16, 16, 4, 4, 1); g.fill(0x8b6914);
      // Head
      g.circle(w / 2, 8, 5); g.fill(0xdeb887);
      outline(g, w / 2 - 5, 3, 10, 10);
      // Hair (brown, shoulder length)
      g.arc(w / 2, 8, 5.5, Math.PI, 0); g.fill(0x6b3a1e);
      g.rect(6, 8, 2, 6); g.fill(0x6b3a1e);
      g.rect(16, 8, 2, 6); g.fill(0x6b3a1e);
      // Eyes
      g.circle(10, 7, 1.2); g.fill(0x334455);
      g.circle(14, 7, 1.2); g.fill(0x334455);
      // Smile
      g.moveTo(10, 10); g.bezierCurveTo(11, 12, 13, 12, 14, 10);
      g.stroke({ width: 0.5, color: 0x8b4513 });
      // Arms
      g.rect(3, 14, 3, 7); g.fill(0xdeb887);
      g.rect(18, 14, 3, 7); g.fill(0xdeb887);
      // Feet
      g.rect(7, 26, 4, 2); g.fill(0x5c3a1e);
      g.rect(13, 26, 4, 2); g.fill(0x5c3a1e);
    },
  },

  "Smith Garrett": {
    width: 28, height: 32,
    draw(g, w, h) {
      // Muscular torso
      g.roundRect(7, 12, 14, 12, 3);
      g.fill(0x6b4226);
      g.roundRect(7, 12, 14, 12, 3);
      g.stroke({ width: 1, color: 0x4a2e1a, alpha: 0.5 });
      // Brown leather apron
      g.roundRect(9, 14, 10, 10, 2);
      g.fill(0x8b6914);
      g.roundRect(9, 14, 10, 10, 2);
      g.stroke({ width: 0.5, color: 0x5a4008, alpha: 0.4 });
      // Apron straps
      g.moveTo(11, 14); g.lineTo(12, 10); g.stroke({ width: 1, color: 0x5a4008 });
      g.moveTo(17, 14); g.lineTo(16, 10); g.stroke({ width: 1, color: 0x5a4008 });
      // Head (dark skin)
      g.circle(w / 2, 8, 6); g.fill(0x8b5e3c);
      outline(g, w / 2 - 6, 2, 12, 12);
      // Short dark hair
      g.arc(w / 2, 7, 6, Math.PI, 0); g.fill(0x1a1a1a);
      // Eyes
      g.circle(11, 7, 1.2); g.fill(0x111111);
      g.circle(17, 7, 1.2); g.fill(0x111111);
      // Strong jaw
      g.rect(10, 11, 8, 2); g.fill(0x7b4e2c);
      // Thick arms
      g.rect(3, 13, 4, 9); g.fill(0x8b5e3c);
      g.rect(21, 13, 4, 9); g.fill(0x8b5e3c);
      // Hammer in right hand
      g.rect(24, 8, 2, 16); g.fill(0x5c3a1e);
      g.roundRect(22, 6, 6, 4, 1); g.fill(0x888888);
      g.roundRect(22, 6, 6, 4, 1); g.stroke({ width: 0.5, color: 0x555555 });
      // Legs
      g.rect(9, 24, 4, 6); g.fill(0x4a3020);
      g.rect(15, 24, 4, 6); g.fill(0x4a3020);
      // Boots
      g.rect(8, 29, 5, 2); g.fill(0x333333);
      g.rect(15, 29, 5, 2); g.fill(0x333333);
    },
  },

  Guard: {
    width: 26, height: 34,
    draw(g, w, h) {
      // Armored torso
      g.roundRect(7, 14, 12, 12, 3);
      g.fill(0x888888);
      g.roundRect(7, 14, 12, 12, 3);
      g.stroke({ width: 1, color: 0x555555, alpha: 0.6 });
      // Chest plate highlight
      g.roundRect(9, 16, 8, 6, 2);
      g.fill(0xaaaaaa);
      // Belt
      g.rect(7, 22, 12, 2); g.fill(0x5c3a1e);
      g.rect(11, 22, 4, 2); g.fill(0xccaa44);
      // Helmet
      g.arc(w / 2, 9, 7, Math.PI, 0); g.fill(0x777777);
      g.arc(w / 2, 9, 7, Math.PI, 0); g.stroke({ width: 0.5, color: 0x444444 });
      // Helmet nose guard
      g.rect(12, 6, 2, 6); g.fill(0x666666);
      // Face slit
      g.rect(9, 8, 8, 2); g.fill(0x1a1a1a);
      // Eyes in slit
      g.circle(11, 9, 0.8); g.fill(0x334455);
      g.circle(15, 9, 0.8); g.fill(0x334455);
      // Spear (right hand)
      g.rect(22, 2, 2, 30); g.fill(0x5c3a1e);
      // Spear head
      g.moveTo(21, 2); g.lineTo(23, -2); g.lineTo(25, 2);
      g.fill(0xaaaaaa);
      // Shield (left arm)
      g.roundRect(1, 16, 6, 10, 2); g.fill(0x666666);
      g.roundRect(1, 16, 6, 10, 2); g.stroke({ width: 1, color: 0x444444 });
      // Shield emblem (cross)
      g.rect(3, 18, 2, 6); g.fill(0xccaa44);
      g.rect(2, 20, 4, 2); g.fill(0xccaa44);
      // Armored arms
      g.rect(4, 14, 3, 8); g.fill(0x777777);
      g.rect(19, 14, 3, 8); g.fill(0x777777);
      // Legs (armored greaves)
      g.rect(9, 26, 4, 6); g.fill(0x666666);
      g.rect(13, 26, 4, 6); g.fill(0x666666);
      // Boots
      g.rect(8, 31, 5, 2); g.fill(0x444444);
      g.rect(13, 31, 5, 2); g.fill(0x444444);
    },
  },

  // ── Ground Item sprite ──

  GroundItem: {
    width: 20, height: 20,
    draw(g, w, h) {
      // Glow
      g.circle(w / 2, h / 2, 9);
      g.fill({ color: 0xffdd44, alpha: 0.12 });
      g.circle(w / 2, h / 2, 6);
      g.fill({ color: 0xffee88, alpha: 0.1 });
      // Bag body
      g.roundRect(5, 7, 10, 9, 3);
      g.fill(0x8b6914);
      g.roundRect(5, 7, 10, 9, 3);
      g.stroke({ width: 1, color: 0x5a4008, alpha: 0.6 });
      // Bag tie
      g.moveTo(8, 7); g.lineTo(w / 2, 4); g.lineTo(12, 7);
      g.fill(0x8b6914);
      // String
      g.moveTo(8, 7); g.lineTo(w / 2, 5); g.lineTo(12, 7);
      g.stroke({ width: 0.5, color: 0x5a4008 });
      // Sparkle
      g.moveTo(w / 2, 1); g.lineTo(w / 2 + 1, 3); g.lineTo(w / 2, 5); g.lineTo(w / 2 - 1, 3);
      g.fill(0xffffaa);
      g.moveTo(w / 2 + 4, 3); g.lineTo(w / 2 + 3, 4); g.lineTo(w / 2 + 4, 5); g.lineTo(w / 2 + 5, 4);
      g.fill({ color: 0xffffcc, alpha: 0.7 });
    },
  },

  GroundItem_Weapon: {
    width: 20, height: 20,
    draw(g, w, h) {
      // Glow
      g.circle(w / 2, h / 2, 8);
      g.fill({ color: 0xaaaaff, alpha: 0.12 });
      // Sword blade
      g.moveTo(w / 2, 3); g.lineTo(w / 2 + 2, 13); g.lineTo(w / 2, 14); g.lineTo(w / 2 - 2, 13);
      g.fill(0xbbbbbb);
      g.moveTo(w / 2, 3); g.lineTo(w / 2 + 2, 13); g.lineTo(w / 2, 14); g.lineTo(w / 2 - 2, 13);
      g.stroke({ width: 0.5, color: 0x888888 });
      // Blade highlight
      g.moveTo(w / 2, 4); g.lineTo(w / 2 + 0.5, 12);
      g.stroke({ width: 0.5, color: 0xffffff, alpha: 0.4 });
      // Guard
      g.rect(w / 2 - 4, 13, 8, 2); g.fill(0x8b6914);
      // Grip
      g.rect(w / 2 - 1, 15, 2, 3); g.fill(0x5c3a1e);
      // Pommel
      g.circle(w / 2, 18.5, 1.5); g.fill(0x8b6914);
    },
  },

  GroundItem_Armor: {
    width: 20, height: 20,
    draw(g, w, h) {
      // Glow
      g.circle(w / 2, h / 2, 8);
      g.fill({ color: 0x88aaff, alpha: 0.12 });
      // Shield shape
      g.moveTo(w / 2, 3); g.lineTo(w / 2 + 6, 5); g.lineTo(w / 2 + 5, 14);
      g.lineTo(w / 2, 17); g.lineTo(w / 2 - 5, 14); g.lineTo(w / 2 - 6, 5);
      g.fill(0x777777);
      g.moveTo(w / 2, 3); g.lineTo(w / 2 + 6, 5); g.lineTo(w / 2 + 5, 14);
      g.lineTo(w / 2, 17); g.lineTo(w / 2 - 5, 14); g.lineTo(w / 2 - 6, 5);
      g.stroke({ width: 1, color: 0x555555 });
      // Emblem stripe
      g.rect(w / 2 - 1, 5, 2, 10); g.fill(0xccaa44);
      g.rect(w / 2 - 4, 8, 8, 2); g.fill(0xccaa44);
    },
  },

  GroundItem_Food: {
    width: 20, height: 20,
    draw(g, w, h) {
      // Glow
      g.circle(w / 2, h / 2, 8);
      g.fill({ color: 0xffaa44, alpha: 0.12 });
      // Bowl
      g.arc(w / 2, 12, 6, 0, Math.PI); g.fill(0x8b6914);
      g.arc(w / 2, 12, 6, 0, Math.PI); g.stroke({ width: 0.5, color: 0x5a4008 });
      // Food in bowl
      g.arc(w / 2, 12, 5, Math.PI, 0); g.fill(0xe8a040);
      // Steam wisps
      g.moveTo(w / 2 - 2, 7); g.bezierCurveTo(w / 2 - 3, 4, w / 2 - 1, 3, w / 2 - 2, 1);
      g.stroke({ width: 0.5, color: 0xffffff, alpha: 0.3 });
      g.moveTo(w / 2 + 2, 7); g.bezierCurveTo(w / 2 + 3, 5, w / 2 + 1, 4, w / 2 + 2, 2);
      g.stroke({ width: 0.5, color: 0xffffff, alpha: 0.3 });
    },
  },

  GroundItem_Material: {
    width: 20, height: 20,
    draw(g, w, h) {
      // Glow
      g.circle(w / 2, h / 2, 8);
      g.fill({ color: 0x88dd88, alpha: 0.12 });
      // Sack
      g.roundRect(4, 6, 12, 10, 3);
      g.fill(0x8b7744);
      g.roundRect(4, 6, 12, 10, 3);
      g.stroke({ width: 1, color: 0x5a4008, alpha: 0.6 });
      // Sack top gathered
      g.moveTo(6, 6); g.lineTo(w / 2, 3); g.lineTo(14, 6);
      g.fill(0x8b7744);
      g.moveTo(6, 6); g.lineTo(w / 2, 3); g.lineTo(14, 6);
      g.stroke({ width: 0.5, color: 0x5a4008 });
      // Tie
      g.circle(w / 2, 4, 1); g.fill(0x5a4008);
    },
  },

  GroundItem_Gold: {
    width: 20, height: 20,
    draw(g, w, h) {
      // Glow (bright gold)
      g.circle(w / 2, h / 2, 9);
      g.fill({ color: 0xffd700, alpha: 0.15 });
      g.circle(w / 2, h / 2, 6);
      g.fill({ color: 0xffee44, alpha: 0.1 });
      // Coin stack (3 coins, offset)
      g.ellipse(w / 2 - 2, 14, 5, 3); g.fill(0xccaa00);
      g.ellipse(w / 2 - 2, 14, 5, 3); g.stroke({ width: 0.5, color: 0x886600 });
      g.ellipse(w / 2, 11, 5, 3); g.fill(0xddbb00);
      g.ellipse(w / 2, 11, 5, 3); g.stroke({ width: 0.5, color: 0x886600 });
      g.ellipse(w / 2 + 1, 8, 5, 3); g.fill(0xffdd22);
      g.ellipse(w / 2 + 1, 8, 5, 3); g.stroke({ width: 0.5, color: 0xaa8800 });
      // "$" on top coin
      g.moveTo(w / 2 + 1, 6); g.lineTo(w / 2 + 1, 10);
      g.stroke({ width: 0.8, color: 0x886600 });
      // Sparkle
      g.moveTo(w / 2 + 5, 4); g.lineTo(w / 2 + 4, 5); g.lineTo(w / 2 + 5, 6); g.lineTo(w / 2 + 6, 5);
      g.fill(0xffffcc);
    },
  },

  // --- Scorched Highlands/Frozen Wastes/Dragon's Lair mobs ---

  "Fire Imp": {
    width: 28, height: 32,
    draw(g, w, h) {
      // Ember glow at feet
      g.ellipse(w / 2, h / 2 + 12.3, 7.6, 2.5);
      g.fill({ color: 0xff6600, alpha: 0.15 });
      // Body
      g.roundRect(7.6, 12.3, 12.7, 9.8, 2.5);
      g.fill(0xcc3300);
      g.roundRect(7.6, 12.3, 12.7, 9.8, 2.5);
      g.stroke({ width: 1, color: 0x881100, alpha: 0.5 });
      // Head
      g.circle(w / 2, 8.6, 6.4);
      g.fill(0xdd4411);
      g.circle(w / 2, 8.6, 6.4);
      g.stroke({ width: 1, color: 0x881100, alpha: 0.4 });
      // Horns
      g.moveTo(10.2, 4.9); g.lineTo(8.9, 0); g.lineTo(12.7, 4.9);
      g.fill(0x881100);
      g.moveTo(15.3, 4.9); g.lineTo(19.1, 0); g.lineTo(17.8, 4.9);
      g.fill(0x881100);
      // Eyes (glowing yellow)
      g.circle(11.5, 7.4, 1.9);
      g.fill(0xffcc00);
      g.circle(11.5, 7.4, 0.8);
      g.fill(0x111111);
      g.circle(16.5, 7.4, 1.9);
      g.fill(0xffcc00);
      g.circle(16.5, 7.4, 0.8);
      g.fill(0x111111);
      // Pointed ears
      g.moveTo(6.4, 7.4); g.lineTo(3.8, 3.7); g.lineTo(8.9, 7.4);
      g.fill(0xdd4411);
      g.moveTo(21.6, 7.4); g.lineTo(24.2, 3.7); g.lineTo(19.1, 7.4);
      g.fill(0xdd4411);
      // Arms
      g.rect(5.1, 14.8, 2.5, 7.4);
      g.fill(0xcc3300);
      g.rect(20.4, 14.8, 2.5, 7.4);
      g.fill(0xcc3300);
      // Legs
      g.rect(10.2, 22.2, 2.5, 6.2);
      g.fill(0xaa2200);
      g.rect(15.3, 22.2, 2.5, 6.2);
      g.fill(0xaa2200);
    },
  },

  "Lava Beetle": {
    width: 30, height: 24,
    draw(g, w, h) {
      // Body ellipse
      g.ellipse(w / 2, h / 2 + 1, 12, 7);
      g.fill(0x661100);
      // Shell
      g.roundRect(5, 4, 20, 12, 4);
      g.fill(0x882200);
      g.roundRect(5, 4, 20, 12, 4);
      g.stroke({ width: 1, color: 0x441100, alpha: 0.5 });
      // Orange glow cracks on shell
      g.moveTo(8, 7); g.lineTo(14, 9);
      g.stroke({ width: 0.5, color: 0xff6600, alpha: 0.3 });
      g.moveTo(16, 6); g.lineTo(22, 10);
      g.stroke({ width: 0.5, color: 0xff6600, alpha: 0.3 });
      g.moveTo(10, 12); g.lineTo(18, 11);
      g.stroke({ width: 0.5, color: 0xff6600, alpha: 0.3 });
      g.moveTo(12, 5); g.lineTo(15, 13);
      g.stroke({ width: 0.5, color: 0xff6600, alpha: 0.3 });
      // Head
      g.circle(7, h / 2 + 1, 4);
      g.fill(0x551100);
      // Eyes
      g.circle(5, h / 2, 1);
      g.fill(0xff0000);
      g.circle(5, h / 2 + 2, 1);
      g.fill(0xff0000);
      // Mandibles
      g.moveTo(4, h / 2 - 1); g.lineTo(1, h / 2 - 2); g.lineTo(4, h / 2 + 1);
      g.fill(0x661100);
      g.moveTo(4, h / 2 + 1); g.lineTo(1, h / 2 + 3); g.lineTo(4, h / 2 + 3);
      g.fill(0x661100);
      // Legs (3 per side, angled bezier strokes)
      // Left legs
      g.moveTo(10, 16); g.bezierCurveTo(8, 19, 6, 21, 4, 22);
      g.stroke({ width: 1.5, color: 0x441100 });
      g.moveTo(14, 16); g.bezierCurveTo(12, 20, 10, 22, 8, 23);
      g.stroke({ width: 1.5, color: 0x441100 });
      g.moveTo(18, 16); g.bezierCurveTo(16, 20, 15, 22, 13, 23);
      g.stroke({ width: 1.5, color: 0x441100 });
      // Right legs
      g.moveTo(10, 4); g.bezierCurveTo(8, 2, 6, 1, 4, 0);
      g.stroke({ width: 1.5, color: 0x441100 });
      g.moveTo(14, 4); g.bezierCurveTo(12, 2, 10, 0, 8, -1);
      g.stroke({ width: 1.5, color: 0x441100 });
      g.moveTo(18, 4); g.bezierCurveTo(16, 2, 15, 0, 13, -1);
      g.stroke({ width: 1.5, color: 0x441100 });
    },
  },

  "Scorched Warrior": {
    width: 26, height: 32,
    draw(g, w, h) {
      // Body
      g.roundRect(7, 12, 12, 10, 3);
      g.fill(0x333333);
      g.roundRect(7, 12, 12, 10, 3);
      g.stroke({ width: 1, color: 0x111111, alpha: 0.5 });
      // Chest plate
      g.roundRect(8, 13, 10, 6, 2);
      g.fill(0x555555);
      // Scorch marks on chest
      g.ellipse(11, 15, 3, 2);
      g.fill({ color: 0xff4400, alpha: 0.2 });
      g.ellipse(15, 17, 2, 1.5);
      g.fill({ color: 0xff4400, alpha: 0.2 });
      // Belt
      g.rect(7, 19, 12, 2);
      g.fill(0x3a2a1a);
      // Head (skull-like)
      g.circle(w / 2, 8, 5);
      g.fill(0xddddbb);
      g.circle(w / 2, 8, 5);
      g.stroke({ width: 1, color: 0x999988, alpha: 0.5 });
      // Eye sockets
      g.circle(10, 7, 1.8);
      g.fill(0x1a1a1a);
      g.circle(16, 7, 1.8);
      g.fill(0x1a1a1a);
      // Red glowing eyes
      g.circle(10, 7, 0.8);
      g.fill(0xff2200);
      g.circle(16, 7, 0.8);
      g.fill(0xff2200);
      // Jaw
      g.roundRect(9, 10, 8, 2, 1);
      g.fill(0xccccaa);
      // Arms (dark gray)
      g.rect(4, 13, 3, 7);
      g.fill(0x333333);
      g.rect(19, 13, 3, 7);
      g.fill(0x333333);
      // Sword in right hand (jagged blade with red glow)
      g.moveTo(22, 8); g.lineTo(24, 9); g.lineTo(23, 14); g.lineTo(25, 16); g.lineTo(23, 20); g.lineTo(21, 20); g.lineTo(22, 16); g.lineTo(20, 14); g.lineTo(21, 9);
      g.fill(0x666666);
      g.moveTo(22, 8); g.lineTo(24, 9); g.lineTo(23, 14); g.lineTo(25, 16); g.lineTo(23, 20);
      g.stroke({ width: 0.5, color: 0xff2200, alpha: 0.3 });
      // Legs
      g.rect(9, 22, 3, 6);
      g.fill(0x333333);
      g.rect(14, 22, 3, 6);
      g.fill(0x333333);
      // Boots
      g.rect(8, 27, 4, 2);
      g.fill(0x222222);
      g.rect(14, 27, 4, 2);
      g.fill(0x222222);
    },
  },

  "Magma Elemental": {
    width: 28, height: 34,
    draw(g, w, h) {
      // Outer aura glow
      g.circle(w / 2, h / 2, 16);
      g.fill({ color: 0xff4400, alpha: 0.08 });
      // Inner glow
      g.circle(w / 2, h / 2, 12);
      g.fill({ color: 0xff6600, alpha: 0.06 });
      // Body (irregular ellipse)
      g.ellipse(w / 2, h / 2, 10, 14);
      g.fill(0xcc2200);
      g.ellipse(w / 2, h / 2, 10, 14);
      g.stroke({ width: 1, color: 0x881100, alpha: 0.4 });
      // Surface cracks (bright lines)
      g.moveTo(8, 12); g.lineTo(14, 18);
      g.stroke({ width: 0.5, color: 0xffaa00, alpha: 0.4 });
      g.moveTo(18, 10); g.lineTo(12, 16);
      g.stroke({ width: 0.5, color: 0xffaa00, alpha: 0.4 });
      g.moveTo(10, 22); g.lineTo(16, 20);
      g.stroke({ width: 0.5, color: 0xffaa00, alpha: 0.4 });
      g.moveTo(14, 8); g.lineTo(18, 14);
      g.stroke({ width: 0.5, color: 0xffaa00, alpha: 0.4 });
      g.moveTo(9, 16); g.lineTo(15, 24);
      g.stroke({ width: 0.5, color: 0xffaa00, alpha: 0.4 });
      // Bright core
      g.ellipse(w / 2, h / 2, 5, 7);
      g.fill(0xff8800);
      // Hot core center
      g.ellipse(w / 2, h / 2, 2, 3);
      g.fill(0xffcc44);
      // Lava drips below body
      g.circle(10, h / 2 + 14, 1.5);
      g.fill(0xff4400);
      g.circle(15, h / 2 + 15, 1.2);
      g.fill(0xff4400);
      g.circle(19, h / 2 + 13, 1);
      g.fill(0xff4400);
      g.circle(13, h / 2 + 16, 0.8);
      g.fill(0xff4400);
    },
  },

  "Frost Wolf": {
    width: 36, height: 28,
    draw(g, w, h) {
      // Breath mist
      g.ellipse(w - 2.4, h / 2 - 1.2, 3.6, 2.3);
      g.fill({ color: 0xaaddff, alpha: 0.1 });
      // Body
      g.ellipse(w / 2, h / 2 + 1.2, 13.2, 8.2);
      g.fill(0xddddee);
      g.ellipse(w / 2, h / 2 + 1.2, 13.2, 8.2);
      g.stroke({ width: 1, color: 0xaaaabb, alpha: 0.4 });
      // Body shadow (lower half)
      g.ellipse(w / 2, h / 2 + 4.7, 12, 4.7);
      g.fill({ color: 0xbbbbcc, alpha: 0.3 });
      // Head
      g.circle(w / 2 + 9.6, h / 2 - 2.3, 6);
      g.fill(0xeeeeff);
      g.circle(w / 2 + 9.6, h / 2 - 2.3, 6);
      g.stroke({ width: 1, color: 0xaaaabb, alpha: 0.3 });
      // Snout (pointed triangle extending forward)
      g.moveTo(w / 2 + 14.4, h / 2 - 3.5); g.lineTo(w / 2 + 20.4, h / 2 - 1.2); g.lineTo(w / 2 + 14.4, h / 2 + 1.2);
      g.fill(0xddddee);
      // Icy blue eyes
      g.circle(w / 2 + 10.8, h / 2 - 4.7, 1.8);
      g.fill(0x44aaff);
      g.circle(w / 2 + 10.8, h / 2 - 4.7, 0.7);
      g.fill(0x111111);
      g.circle(w / 2 + 13.2, h / 2 - 3.5, 1.8);
      g.fill(0x44aaff);
      g.circle(w / 2 + 13.2, h / 2 - 3.5, 0.7);
      g.fill(0x111111);
      // Ears (pointed triangles)
      g.moveTo(w / 2 + 7.2, h / 2 - 7); g.lineTo(w / 2 + 6, h / 2 - 12.8); g.lineTo(w / 2 + 9.6, h / 2 - 7);
      g.fill(0xccccdd);
      g.moveTo(w / 2 + 10.8, h / 2 - 7); g.lineTo(w / 2 + 12, h / 2 - 12.8); g.lineTo(w / 2 + 14.4, h / 2 - 7);
      g.fill(0xccccdd);
      // 4 legs
      g.rect(8.4, h / 2 + 5.8, 3.6, 7);
      g.fill(0xccccdd);
      g.rect(14.4, h / 2 + 5.8, 3.6, 7);
      g.fill(0xccccdd);
      g.rect(21.6, h / 2 + 5.8, 3.6, 7);
      g.fill(0xccccdd);
      g.rect(27.6, h / 2 + 5.8, 3.6, 7);
      g.fill(0xccccdd);
      // Paw detail (small rects at feet)
      g.rect(7.2, h / 2 + 11.7, 4.8, 1.8);
      g.fill(0xbbbbcc);
      g.rect(13.2, h / 2 + 11.7, 4.8, 1.8);
      g.fill(0xbbbbcc);
      g.rect(20.4, h / 2 + 11.7, 4.8, 1.8);
      g.fill(0xbbbbcc);
      g.rect(26.4, h / 2 + 11.7, 4.8, 1.8);
      g.fill(0xbbbbcc);
      // Tail
      g.moveTo(3.6, h / 2 - 1.2); g.lineTo(0, h / 2 - 5.8); g.lineTo(6, h / 2 + 1.2);
      g.fill(0xddddee);
    },
  },

  "Ice Wraith": {
    width: 24, height: 32,
    draw(g, w, h) {
      // Body glow
      g.circle(w / 2, h / 2, 14);
      g.fill({ color: 0x88bbff, alpha: 0.08 });
      // Wispy trails below
      g.moveTo(8, 26); g.bezierCurveTo(6, 28, 7, 30, 5, 32);
      g.stroke({ width: 0.5, color: 0x88bbff, alpha: 0.2 });
      g.moveTo(12, 27); g.bezierCurveTo(11, 29, 12, 31, 10, 33);
      g.stroke({ width: 0.5, color: 0x88bbff, alpha: 0.2 });
      g.moveTo(16, 26); g.bezierCurveTo(17, 29, 16, 31, 18, 33);
      g.stroke({ width: 0.5, color: 0x88bbff, alpha: 0.2 });
      // Body (flowing cloak shape)
      g.moveTo(w / 2, 4); g.lineTo(w / 2 + 3, 6); g.lineTo(w / 2 + 6, 12);
      g.lineTo(w / 2 + 8, 20); g.lineTo(w / 2 + 6, 26);
      g.lineTo(w / 2 - 6, 26); g.lineTo(w / 2 - 8, 20);
      g.lineTo(w / 2 - 6, 12); g.lineTo(w / 2 - 3, 6);
      g.closePath();
      g.fill(0xaaccff);
      g.moveTo(w / 2, 4); g.lineTo(w / 2 + 3, 6); g.lineTo(w / 2 + 6, 12);
      g.lineTo(w / 2 + 8, 20); g.lineTo(w / 2 + 6, 26);
      g.lineTo(w / 2 - 6, 26); g.lineTo(w / 2 - 8, 20);
      g.lineTo(w / 2 - 6, 12); g.lineTo(w / 2 - 3, 6);
      g.closePath();
      g.stroke({ width: 1, color: 0x88aadd, alpha: 0.4 });
      // Face area (dark void)
      g.ellipse(w / 2, 10, 4, 3);
      g.fill(0x1a2a3a);
      // Glowing eyes
      g.circle(w / 2 - 2, 10, 1.5);
      g.fill(0x44eeff);
      g.circle(w / 2 + 2, 10, 1.5);
      g.fill(0x44eeff);
      // Eye glow
      g.circle(w / 2 - 2, 10, 3);
      g.fill({ color: 0x88ffff, alpha: 0.15 });
      g.circle(w / 2 + 2, 10, 3);
      g.fill({ color: 0x88ffff, alpha: 0.15 });
      // Core glow in chest
      g.circle(w / 2, 16, 2.5);
      g.fill({ color: 0xccddff, alpha: 0.5 });
    },
  },

  Yeti: {
    width: 32, height: 36,
    draw(g, w, h) {
      // Large body
      g.roundRect(8, 12, 16, 14, 4);
      g.fill(0xeeeeff);
      g.roundRect(8, 12, 16, 14, 4);
      g.stroke({ width: 1, color: 0xbbbbcc, alpha: 0.4 });
      // Fur texture (short strokes)
      g.moveTo(10, 14); g.lineTo(10, 16); g.stroke({ width: 0.5, color: 0xddddee });
      g.moveTo(13, 13); g.lineTo(13, 15); g.stroke({ width: 0.5, color: 0xddddee });
      g.moveTo(16, 14); g.lineTo(16, 16); g.stroke({ width: 0.5, color: 0xddddee });
      g.moveTo(19, 13); g.lineTo(19, 15); g.stroke({ width: 0.5, color: 0xddddee });
      g.moveTo(22, 14); g.lineTo(22, 16); g.stroke({ width: 0.5, color: 0xddddee });
      g.moveTo(11, 19); g.lineTo(11, 21); g.stroke({ width: 0.5, color: 0xddddee });
      g.moveTo(15, 20); g.lineTo(15, 22); g.stroke({ width: 0.5, color: 0xddddee });
      g.moveTo(19, 19); g.lineTo(19, 21); g.stroke({ width: 0.5, color: 0xddddee });
      g.moveTo(21, 21); g.lineTo(21, 23); g.stroke({ width: 0.5, color: 0xddddee });
      g.moveTo(12, 23); g.lineTo(12, 25); g.stroke({ width: 0.5, color: 0xddddee });
      // Head
      g.circle(w / 2, 9, 7);
      g.fill(0xeeeeff);
      g.circle(w / 2, 9, 7);
      g.stroke({ width: 1, color: 0xbbbbcc, alpha: 0.3 });
      // Red eyes with glow
      g.circle(13, 8, 2);
      g.fill(0xff2222);
      g.circle(19, 8, 2);
      g.fill(0xff2222);
      g.circle(13, 8, 3);
      g.fill({ color: 0xff4444, alpha: 0.1 });
      g.circle(19, 8, 3);
      g.fill({ color: 0xff4444, alpha: 0.1 });
      // Open mouth (dark arc)
      g.moveTo(13, 13); g.bezierCurveTo(14, 15, 18, 15, 19, 13);
      g.stroke({ width: 1.5, color: 0x222222 });
      // Large arms
      g.rect(2, 14, 5, 10);
      g.fill(0xddddee);
      g.rect(25, 14, 5, 10);
      g.fill(0xddddee);
      // Fists
      g.circle(4, 25, 3);
      g.fill(0xeeeeff);
      g.circle(28, 25, 3);
      g.fill(0xeeeeff);
      // Legs
      g.rect(10, 26, 5, 7);
      g.fill(0xccccdd);
      g.rect(17, 26, 5, 7);
      g.fill(0xccccdd);
      // Feet
      g.roundRect(9, 32, 6, 3, 1);
      g.fill(0xbbbbcc);
      g.roundRect(17, 32, 6, 3, 1);
      g.fill(0xbbbbcc);
    },
  },

  "Crystal Golem": {
    width: 34, height: 36,
    draw(g, w, h) {
      // Body (hexagonal-ish polygon)
      g.moveTo(w / 2, 6); g.lineTo(w / 2 + 10, 10); g.lineTo(w / 2 + 12, 20);
      g.lineTo(w / 2 + 8, 28); g.lineTo(w / 2 - 8, 28);
      g.lineTo(w / 2 - 12, 20); g.lineTo(w / 2 - 10, 10);
      g.closePath();
      g.fill(0x88ccee);
      g.moveTo(w / 2, 6); g.lineTo(w / 2 + 10, 10); g.lineTo(w / 2 + 12, 20);
      g.lineTo(w / 2 + 8, 28); g.lineTo(w / 2 - 8, 28);
      g.lineTo(w / 2 - 12, 20); g.lineTo(w / 2 - 10, 10);
      g.closePath();
      g.stroke({ width: 1, color: 0x5599bb, alpha: 0.5 });
      // Highlight facets (upper-left)
      g.moveTo(w / 2, 6); g.lineTo(w / 2 - 10, 10); g.lineTo(w / 2 - 4, 14);
      g.fill({ color: 0xaaddff, alpha: 0.3 });
      g.moveTo(w / 2 - 10, 10); g.lineTo(w / 2 - 12, 20); g.lineTo(w / 2 - 4, 14);
      g.fill({ color: 0xaaddff, alpha: 0.3 });
      // Shadow facets (lower-right)
      g.moveTo(w / 2 + 10, 10); g.lineTo(w / 2 + 12, 20); g.lineTo(w / 2 + 4, 18);
      g.fill({ color: 0x5599bb, alpha: 0.3 });
      g.moveTo(w / 2 + 12, 20); g.lineTo(w / 2 + 8, 28); g.lineTo(w / 2 + 4, 18);
      g.fill({ color: 0x5599bb, alpha: 0.3 });
      // Core glow
      g.circle(w / 2, h / 2, 5);
      g.fill({ color: 0x44eeff, alpha: 0.3 });
      g.circle(w / 2, h / 2, 2.5);
      g.fill({ color: 0xccffff, alpha: 0.5 });
      // Crystalline protrusions on top/shoulders
      g.moveTo(w / 2 - 2, 6); g.lineTo(w / 2 - 1, 1); g.lineTo(w / 2 + 1, 6);
      g.fill(0xaaddff);
      g.moveTo(w / 2 - 8, 9); g.lineTo(w / 2 - 9, 4); g.lineTo(w / 2 - 6, 9);
      g.fill(0xaaddff);
      g.moveTo(w / 2 + 6, 9); g.lineTo(w / 2 + 9, 4); g.lineTo(w / 2 + 8, 9);
      g.fill(0xaaddff);
      g.moveTo(w / 2 + 3, 7); g.lineTo(w / 2 + 4, 2); g.lineTo(w / 2 + 5, 7);
      g.fill(0xaaddff);
      // Arms (angular)
      g.rect(1, 14, 4, 10);
      g.fill(0x77bbdd);
      g.rect(29, 14, 4, 10);
      g.fill(0x77bbdd);
      // Legs (angular)
      g.rect(10, 28, 5, 7);
      g.fill(0x6699aa);
      g.rect(19, 28, 5, 7);
      g.fill(0x6699aa);
    },
  },

  Dragonkin: {
    width: 28, height: 34,
    draw(g, w, h) {
      // Wings (folded, behind shoulders)
      g.moveTo(4, 12); g.lineTo(0, 4); g.lineTo(8, 14);
      g.fill(0x772222);
      g.moveTo(24, 12); g.lineTo(28, 4); g.lineTo(20, 14);
      g.fill(0x772222);
      // Tail (curved thick line extending from back)
      g.moveTo(w / 2, 24); g.bezierCurveTo(w / 2 - 4, 28, w / 2 - 8, 30, w / 2 - 10, 28);
      g.stroke({ width: 3, color: 0x882222 });
      // Body
      g.roundRect(8, 12, 12, 12, 3);
      g.fill(0x882222);
      g.roundRect(8, 12, 12, 12, 3);
      g.stroke({ width: 1, color: 0x551111, alpha: 0.5 });
      // Chest scales (horizontal lines)
      g.moveTo(9, 15); g.lineTo(19, 15);
      g.stroke({ width: 0.5, color: 0xaa3333, alpha: 0.3 });
      g.moveTo(9, 17); g.lineTo(19, 17);
      g.stroke({ width: 0.5, color: 0xaa3333, alpha: 0.3 });
      g.moveTo(9, 19); g.lineTo(19, 19);
      g.stroke({ width: 0.5, color: 0xaa3333, alpha: 0.3 });
      g.moveTo(9, 21); g.lineTo(19, 21);
      g.stroke({ width: 0.5, color: 0xaa3333, alpha: 0.3 });
      // Scales detail (small diamonds on shoulders)
      g.moveTo(9, 13); g.lineTo(8, 14); g.lineTo(9, 15); g.lineTo(10, 14);
      g.fill(0xaa3333);
      g.moveTo(19, 13); g.lineTo(18, 14); g.lineTo(19, 15); g.lineTo(20, 14);
      g.fill(0xaa3333);
      // Head (slightly oval with short snout)
      g.ellipse(w / 2, 8, 5, 4);
      g.fill(0x993333);
      g.ellipse(w / 2, 8, 5, 4);
      g.stroke({ width: 1, color: 0x661111, alpha: 0.4 });
      // Snout
      g.moveTo(w / 2 + 3, 7); g.lineTo(w / 2 + 6, 8); g.lineTo(w / 2 + 3, 10);
      g.fill(0x993333);
      // Yellow-orange eyes with slit pupils
      g.circle(w / 2 - 2, 7, 1.5);
      g.fill(0xffaa00);
      g.rect(w / 2 - 2.3, 6, 0.6, 2);
      g.fill(0x111111);
      g.circle(w / 2 + 2, 7, 1.5);
      g.fill(0xffaa00);
      g.rect(w / 2 + 1.7, 6, 0.6, 2);
      g.fill(0x111111);
      // Small horns
      g.moveTo(w / 2 - 3, 5); g.lineTo(w / 2 - 4, 1); g.lineTo(w / 2 - 1, 5);
      g.fill(0x661111);
      g.moveTo(w / 2 + 1, 5); g.lineTo(w / 2 + 4, 1); g.lineTo(w / 2 + 3, 5);
      g.fill(0x661111);
      // Arms with clawed hands
      g.rect(4, 14, 3, 8);
      g.fill(0x993333);
      g.rect(21, 14, 3, 8);
      g.fill(0x993333);
      // Claws (3 lines per hand)
      g.moveTo(4, 22); g.lineTo(3, 24); g.stroke({ width: 0.5, color: 0x661111 });
      g.moveTo(5, 22); g.lineTo(4, 24); g.stroke({ width: 0.5, color: 0x661111 });
      g.moveTo(6, 22); g.lineTo(5, 24); g.stroke({ width: 0.5, color: 0x661111 });
      g.moveTo(22, 22); g.lineTo(23, 24); g.stroke({ width: 0.5, color: 0x661111 });
      g.moveTo(23, 22); g.lineTo(24, 24); g.stroke({ width: 0.5, color: 0x661111 });
      g.moveTo(24, 22); g.lineTo(25, 24); g.stroke({ width: 0.5, color: 0x661111 });
      // Legs with clawed feet
      g.rect(10, 24, 3, 6);
      g.fill(0x772222);
      g.rect(15, 24, 3, 6);
      g.fill(0x772222);
      // Foot claws
      g.moveTo(10, 30); g.lineTo(9, 32); g.stroke({ width: 0.5, color: 0x661111 });
      g.moveTo(11, 30); g.lineTo(10, 32); g.stroke({ width: 0.5, color: 0x661111 });
      g.moveTo(12, 30); g.lineTo(11, 32); g.stroke({ width: 0.5, color: 0x661111 });
      g.moveTo(15, 30); g.lineTo(14, 32); g.stroke({ width: 0.5, color: 0x661111 });
      g.moveTo(16, 30); g.lineTo(15, 32); g.stroke({ width: 0.5, color: 0x661111 });
      g.moveTo(17, 30); g.lineTo(16, 32); g.stroke({ width: 0.5, color: 0x661111 });
    },
  },

  "Elder Drake": {
    width: 42, height: 48, isBoss: true,
    draw(g, w, h) {
      // Aura glow
      g.circle(w / 2, h / 2, 22);
      g.fill({ color: 0xff4400, alpha: 0.08 });
      // Inner aura
      g.circle(w / 2, h / 2, 16);
      g.fill({ color: 0xff6600, alpha: 0.06 });
      // Wings (large triangular shapes with membrane lines)
      // Left wing
      g.moveTo(8, 16); g.lineTo(0, 6); g.lineTo(2, 28);
      g.fill(0x881111);
      g.moveTo(4, 10); g.lineTo(5, 22);
      g.stroke({ width: 0.5, color: 0x661100 });
      g.moveTo(2, 8); g.lineTo(4, 24);
      g.stroke({ width: 0.5, color: 0x661100 });
      // Right wing
      g.moveTo(34, 16); g.lineTo(42, 6); g.lineTo(40, 28);
      g.fill(0x881111);
      g.moveTo(38, 10); g.lineTo(37, 22);
      g.stroke({ width: 0.5, color: 0x661100 });
      g.moveTo(40, 8); g.lineTo(38, 24);
      g.stroke({ width: 0.5, color: 0x661100 });
      // Tail (thick bezier curve extending behind)
      g.moveTo(w / 2 - 4, 34); g.bezierCurveTo(w / 2 - 8, 38, w / 2 - 12, 42, w / 2 - 14, 40);
      g.stroke({ width: 4, color: 0x882200 });
      // Body (large ellipse)
      g.ellipse(w / 2, h / 2 + 2, 16, 12);
      g.fill(0xaa2200);
      g.ellipse(w / 2, h / 2 + 2, 16, 12);
      g.stroke({ width: 1.5, color: 0x661100, alpha: 0.5 });
      // Belly scales
      g.ellipse(w / 2, h / 2 + 5, 10, 6);
      g.fill(0xcc4422);
      // Scale texture (small arc marks across body)
      for (let sx = -6; sx <= 6; sx += 4) {
        for (let sy = -2; sy <= 4; sy += 4) {
          g.arc(w / 2 + sx, h / 2 + 2 + sy, 1.5, 0, Math.PI);
          g.stroke({ width: 0.5, color: 0x882200, alpha: 0.6 });
        }
      }
      // Neck (tapered polygon extending upward)
      g.moveTo(w / 2 - 4, h / 2 - 8); g.lineTo(w / 2 - 2, h / 2 - 16);
      g.lineTo(w / 2 + 2, h / 2 - 16); g.lineTo(w / 2 + 4, h / 2 - 8);
      g.fill(0xaa2200);
      // Head (elongated ellipse)
      g.ellipse(w / 2, 6, 8, 6);
      g.fill(0xbb2200);
      g.ellipse(w / 2, 6, 8, 6);
      g.stroke({ width: 1, color: 0x661100, alpha: 0.4 });
      // Glowing orange eyes
      g.circle(w / 2 - 3, 5, 2);
      g.fill(0xff8800);
      g.circle(w / 2 + 3, 5, 2);
      g.fill(0xff8800);
      // Eye glow
      g.circle(w / 2 - 3, 5, 3.5);
      g.fill({ color: 0xff4400, alpha: 0.15 });
      g.circle(w / 2 + 3, 5, 3.5);
      g.fill({ color: 0xff4400, alpha: 0.15 });
      // Nostrils
      g.circle(w / 2 - 2, 9, 0.8);
      g.fill(0xff6600);
      g.circle(w / 2 + 2, 9, 0.8);
      g.fill(0xff6600);
      // Horns (large backward-curving triangles)
      g.moveTo(w / 2 - 5, 2); g.lineTo(w / 2 - 10, -4); g.lineTo(w / 2 - 3, 4);
      g.fill(0x661100);
      g.moveTo(w / 2 + 5, 2); g.lineTo(w / 2 + 10, -4); g.lineTo(w / 2 + 3, 4);
      g.fill(0x661100);
      // Jaw (lower mandible)
      g.moveTo(w / 2 - 6, 8); g.lineTo(w / 2 - 4, 11); g.lineTo(w / 2 + 4, 11); g.lineTo(w / 2 + 6, 8);
      g.fill(0x992200);
      // Teeth (small triangles)
      g.moveTo(w / 2 - 3, 8); g.lineTo(w / 2 - 2, 10); g.lineTo(w / 2 - 1, 8);
      g.fill(0xeeddcc);
      g.moveTo(w / 2, 8); g.lineTo(w / 2 + 1, 10); g.lineTo(w / 2 + 2, 8);
      g.fill(0xeeddcc);
      // Fire breath hint (glow near mouth)
      g.ellipse(w / 2, 12, 4, 2);
      g.fill({ color: 0xff8800, alpha: 0.1 });
      // Legs (4 thick rects with clawed feet)
      g.rect(10, 34, 4, 8);
      g.fill(0x882200);
      g.rect(16, 34, 4, 8);
      g.fill(0x882200);
      g.rect(22, 34, 4, 8);
      g.fill(0x882200);
      g.rect(28, 34, 4, 8);
      g.fill(0x882200);
      // Clawed feet (3 lines each)
      for (const lx of [10, 16, 22, 28]) {
        g.moveTo(lx, 42); g.lineTo(lx - 1, 45);
        g.stroke({ width: 0.5, color: 0x661100 });
        g.moveTo(lx + 2, 42); g.lineTo(lx + 2, 45);
        g.stroke({ width: 0.5, color: 0x661100 });
        g.moveTo(lx + 4, 42); g.lineTo(lx + 5, 45);
        g.stroke({ width: 0.5, color: 0x661100 });
      }
    },
  },

  "Lich King": {
    width: 38, height: 44, isBoss: true,
    draw(g, w, h) {
      // Aura glow (large, purple)
      g.circle(w / 2, h / 2, 20);
      g.fill({ color: 0x8800ff, alpha: 0.06 });
      g.circle(w / 2, h / 2, 15);
      g.fill({ color: 0xaa44ff, alpha: 0.06 });
      // Floating particles
      for (let i = 0; i < 4; i++) {
        const px = 6 + i * 8;
        const py = 36 + (i % 2) * 3;
        g.circle(px, py, 1);
        g.fill({ color: 0xaa44ff, alpha: 0.3 });
      }
      // Robe
      g.moveTo(8, 16); g.lineTo(4, 40); g.lineTo(34, 40); g.lineTo(30, 16);
      g.fill(0x140a20);
      g.moveTo(8, 16); g.lineTo(4, 40); g.lineTo(34, 40); g.lineTo(30, 16);
      g.stroke({ width: 1.5, color: 0x0a0510, alpha: 0.6 });
      // Robe trim
      g.rect(4, 38, 30, 2);
      g.fill(0x3a1a5e);
      // Robe pattern
      g.moveTo(15, 25); g.lineTo(19, 20); g.lineTo(23, 25); g.lineTo(19, 30);
      g.stroke({ width: 0.5, color: 0x5a2a8e, alpha: 0.4 });
      // Hood
      g.moveTo(8, 16); g.lineTo(w / 2, 4); g.lineTo(30, 16);
      g.fill(0x140a20);
      // Inner face darkness
      g.ellipse(w / 2, 14, 6, 5);
      g.fill(0x0a0510);
      // Glowing eyes
      g.circle(15, 13, 2.5);
      g.fill(0xaa44ff);
      g.circle(23, 13, 2.5);
      g.fill(0xaa44ff);
      g.circle(15, 13, 1.2);
      g.fill(0xeeccff);
      g.circle(23, 13, 1.2);
      g.fill(0xeeccff);
      // Eye glow effect
      g.circle(15, 13, 4);
      g.fill({ color: 0xaa44ff, alpha: 0.15 });
      g.circle(23, 13, 4);
      g.fill({ color: 0xaa44ff, alpha: 0.15 });
      // Staff
      g.rect(32, 6, 2, 32);
      g.fill(0x3a2a1e);
      g.rect(32.5, 8, 1, 28);
      g.fill({ color: 0xffffff, alpha: 0.08 });
      // Staff orb
      g.circle(33, 5, 4);
      g.fill(0x9944ff);
      g.circle(33, 5, 2);
      g.fill({ color: 0xeeccff, alpha: 0.6 });
      g.circle(33, 5, 6);
      g.fill({ color: 0x9944ff, alpha: 0.12 });
      // Skeletal hands
      g.circle(9, 24, 2.5);
      g.fill(0xccccaa);
      g.circle(29, 24, 2.5);
      g.fill(0xccccaa);
      // Finger bones
      for (let f = 0; f < 3; f++) {
        g.rect(7 + f * 1.5, 22, 1, 3);
        g.fill(0xddddbb);
        g.rect(27 + f * 1.5, 22, 1, 3);
        g.fill(0xddddbb);
      }
    },
  },
};

const textureCache = new Map<string, Texture>();

export function getMobTexture(name: string): Texture {
  if (textureCache.has(name)) return textureCache.get(name)!;

  const def = DEFS[name];
  if (!def) {
    // Fallback: gray humanoid silhouette with "?" — looks entity-shaped
    const g = new Graphics();
    const fw = 24, fh = 30;
    // Head
    g.circle(fw / 2, 6, 5);
    g.fill(0x666666);
    // Body
    g.roundRect(6, 12, 12, 10, 3);
    g.fill(0x555555);
    // Arms
    g.rect(3, 13, 3, 7);
    g.fill(0x555555);
    g.rect(18, 13, 3, 7);
    g.fill(0x555555);
    // Legs
    g.rect(7, 22, 4, 6);
    g.fill(0x555555);
    g.rect(13, 22, 4, 6);
    g.fill(0x555555);
    // Question mark
    g.moveTo(10, 4); g.bezierCurveTo(10, 1, 16, 1, 16, 5);
    g.bezierCurveTo(16, 7, 13, 7, 13, 9);
    g.stroke({ width: 1.5, color: 0xeeeeee });
    g.circle(13, 11, 0.8);
    g.fill(0xeeeeee);
    const tex = TextureFactory.generate(g, fw, fh);
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
  const def = DEFS[name];
  return def ? { w: def.width, h: def.height } : { w: 28, h: 28 };
}
