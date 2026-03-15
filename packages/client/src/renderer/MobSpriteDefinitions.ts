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
    width: 22, height: 22,
    draw(g, w, h) {
      // Body
      g.ellipse(w / 2, h / 2 + 2, 6, 5);
      g.fill(0xf0c040);
      g.ellipse(w / 2, h / 2 + 2, 6, 5);
      g.stroke({ width: 1, color: 0xc09020, alpha: 0.5 });
      // Wing
      g.ellipse(w / 2 - 2, h / 2 + 2, 3, 3);
      g.fill(0xe0b030);
      // Comb
      g.circle(w / 2 + 1, h / 2 - 4, 2);
      g.fill(0xe74c3c);
      g.circle(w / 2 - 1, h / 2 - 3, 1.5);
      g.fill(0xe74c3c);
      // Head
      g.circle(w / 2 + 1, h / 2 - 1, 3);
      g.fill(0xf0c848);
      // Eye
      g.circle(w / 2 + 3, h / 2 - 2, 1);
      g.fill(0x111111);
      // Beak
      g.moveTo(w / 2 + 5, h / 2 - 1);
      g.lineTo(w / 2 + 8, h / 2);
      g.lineTo(w / 2 + 5, h / 2 + 1);
      g.fill(0xf09020);
      // Legs
      g.moveTo(w / 2 - 2, h / 2 + 6); g.lineTo(w / 2 - 3, h / 2 + 10); g.lineTo(w / 2 - 5, h / 2 + 10);
      g.stroke({ width: 1, color: 0xf09020 });
      g.moveTo(w / 2 + 2, h / 2 + 6); g.lineTo(w / 2 + 3, h / 2 + 10); g.lineTo(w / 2 + 5, h / 2 + 10);
      g.stroke({ width: 1, color: 0xf09020 });
      // Tail feathers
      g.moveTo(w / 2 - 5, h / 2); g.lineTo(w / 2 - 8, h / 2 - 2); g.lineTo(w / 2 - 6, h / 2 + 1);
      g.fill(0xe0b030);
    },
  },

  Cow: {
    width: 36, height: 30,
    draw(g, w, h) {
      // Body
      g.roundRect(6, 8, 24, 14, 4);
      g.fill(0x8b6914);
      g.roundRect(6, 8, 24, 14, 4);
      g.stroke({ width: 1, color: 0x5a4008, alpha: 0.5 });
      // Belly highlight
      g.ellipse(18, 17, 10, 4);
      g.fill(0xc2a060);
      // Spots
      g.ellipse(12, 12, 3, 2.5);
      g.fill(0x222222);
      g.ellipse(22, 10, 2.5, 2);
      g.fill(0x222222);
      // Head
      g.circle(28, 8, 5);
      g.fill(0x8b6914);
      g.circle(28, 8, 5);
      g.stroke({ width: 1, color: 0x5a4008, alpha: 0.4 });
      // Snout
      g.ellipse(30, 10, 3, 2);
      g.fill(0xc2a060);
      // Horns
      g.moveTo(25, 3); g.lineTo(24, 0); g.lineTo(26, 3);
      g.fill(0xccccaa);
      g.moveTo(31, 3); g.lineTo(32, 0); g.lineTo(30, 3);
      g.fill(0xccccaa);
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
    width: 26, height: 28,
    draw(g, w, h) {
      // Body
      g.roundRect(7, 12, 12, 10, 3);
      g.fill(0x3a7a3a);
      g.roundRect(7, 12, 12, 10, 3);
      g.stroke({ width: 1, color: 0x1a4a1a, alpha: 0.5 });
      // Belt
      g.rect(7, 18, 12, 2);
      g.fill(0x5c3a1e);
      // Head
      g.circle(w / 2, 9, 6);
      g.fill(0x4a9a4a);
      g.circle(w / 2, 9, 6);
      g.stroke({ width: 1, color: 0x2a6a2a, alpha: 0.4 });
      // Ears
      g.moveTo(5, 7); g.lineTo(2, 2); g.lineTo(7, 7);
      g.fill(0x4a9a4a);
      g.moveTo(21, 7); g.lineTo(24, 2); g.lineTo(19, 7);
      g.fill(0x4a9a4a);
      // Eyes (glowing yellow)
      g.circle(10, 8, 2);
      g.fill(0xffff00);
      g.circle(10, 8, 0.8);
      g.fill(0x111111);
      g.circle(16, 8, 2);
      g.fill(0xffff00);
      g.circle(16, 8, 0.8);
      g.fill(0x111111);
      // Nose
      g.circle(13, 11, 1.2);
      g.fill(0x3a7a3a);
      // Mouth
      g.moveTo(10, 13); g.lineTo(13, 14); g.lineTo(16, 13);
      g.stroke({ width: 0.5, color: 0x2a5a2a });
      // Arms
      g.rect(4, 14, 3, 7);
      g.fill(0x4a9a4a);
      g.rect(19, 14, 3, 7);
      g.fill(0x4a9a4a);
      // Legs
      g.rect(9, 22, 3, 5);
      g.fill(0x3a7a3a);
      g.rect(14, 22, 3, 5);
      g.fill(0x3a7a3a);
      // Feet
      g.rect(8, 26, 4, 2);
      g.fill(0x2a5a2a);
      g.rect(14, 26, 4, 2);
      g.fill(0x2a5a2a);
    },
  },

  "Goblin Sentry": {
    width: 28, height: 30,
    draw(g, w, h) {
      DEFS.Goblin.draw(g, 26, 28);
      // Shield on left arm
      g.roundRect(1, 14, 5, 8, 1);
      g.fill(0x8b6914);
      g.roundRect(1, 14, 5, 8, 1);
      g.stroke({ width: 1, color: 0x5a4008 });
      g.rect(3, 15, 1, 6);
      g.fill(0xaaa060);
    },
  },

  "Goblin Warrior": {
    width: 30, height: 30,
    draw(g, w, h) {
      DEFS.Goblin.draw(g, 26, 28);
      // Sword on right
      g.rect(23, 10, 2, 14);
      g.fill(0xaaaaaa);
      g.rect(22, 9, 4, 2);
      g.fill(0x8b6914);
      // Blade highlight
      g.rect(23.5, 11, 0.5, 12);
      g.fill({ color: 0xffffff, alpha: 0.3 });
    },
  },

  "Goblin Mage": {
    width: 28, height: 30,
    draw(g, w, h) {
      DEFS.Goblin.draw(g, 26, 28);
      // Staff
      g.rect(22, 4, 2, 22);
      g.fill(0x5c3a1e);
      // Orb
      g.circle(23, 4, 3);
      g.fill(0x9944ff);
      g.circle(23, 4, 1.5);
      g.fill({ color: 0xeeccff, alpha: 0.6 });
      // Glow
      g.circle(23, 4, 5);
      g.fill({ color: 0x9944ff, alpha: 0.12 });
    },
  },

  Skeleton: {
    width: 24, height: 32,
    draw(g, w, h) {
      // Skull
      g.circle(w / 2, 7, 5);
      g.fill(0xeeeedd);
      g.circle(w / 2, 7, 5);
      g.stroke({ width: 1, color: 0x999988, alpha: 0.5 });
      // Jaw
      g.roundRect(8, 10, 8, 3, 1);
      g.fill(0xddddcc);
      // Eye sockets
      g.circle(9, 6, 2);
      g.fill(0x1a1a1a);
      g.circle(15, 6, 2);
      g.fill(0x1a1a1a);
      // Eye glow
      g.circle(9, 6, 0.8);
      g.fill(0xff4444);
      g.circle(15, 6, 0.8);
      g.fill(0xff4444);
      // Spine/Torso
      g.rect(10, 13, 4, 10);
      g.fill(0xddddbb);
      // Ribs
      for (let ry = 14; ry < 22; ry += 2) {
        g.rect(7, ry, 10, 1);
        g.fill(0xccccaa);
        // Rib shadow
        g.rect(7, ry + 1, 10, 0.5);
        g.fill({ color: 0x000000, alpha: 0.1 });
      }
      // Arms (bone segments)
      g.rect(4, 13, 3, 4);
      g.fill(0xddddbb);
      g.rect(3, 17, 3, 4);
      g.fill(0xccccaa);
      g.rect(17, 13, 3, 4);
      g.fill(0xddddbb);
      g.rect(18, 17, 3, 4);
      g.fill(0xccccaa);
      // Legs
      g.rect(9, 23, 3, 6);
      g.fill(0xddddbb);
      g.rect(12, 23, 3, 6);
      g.fill(0xddddbb);
      // Feet
      g.rect(8, 28, 4, 2);
      g.fill(0xccccaa);
      g.rect(12, 28, 4, 2);
      g.fill(0xccccaa);
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
    width: 32, height: 24,
    draw(g, w, h) {
      // Abdomen
      g.ellipse(22, 13, 7, 5);
      g.fill(0x3a2a1a);
      g.ellipse(22, 13, 7, 5);
      g.stroke({ width: 1, color: 0x1a1a0a, alpha: 0.5 });
      // Pattern on abdomen
      g.circle(22, 12, 2);
      g.fill(0x5a4a3a);
      g.circle(20, 14, 1);
      g.fill(0x5a4a3a);
      g.circle(24, 14, 1);
      g.fill(0x5a4a3a);
      // Cephalothorax
      g.circle(12, 13, 5);
      g.fill(0x4a3a2a);
      g.circle(12, 13, 5);
      g.stroke({ width: 1, color: 0x2a1a0a, alpha: 0.4 });
      // Eyes (multiple)
      g.circle(9, 10, 1.2);
      g.fill(0xff0000);
      g.circle(11, 9, 1.5);
      g.fill(0xff0000);
      g.circle(13, 9, 1.5);
      g.fill(0xff0000);
      g.circle(15, 10, 1.2);
      g.fill(0xff0000);
      // Eye glints
      g.circle(11, 9, 0.5);
      g.fill(0xffaaaa);
      g.circle(13, 9, 0.5);
      g.fill(0xffaaaa);
      // Legs (4 per side, thicker with joints)
      const angles = [-0.7, -0.3, 0.15, 0.5];
      for (const a of angles) {
        // Left legs
        const lx1 = 12 + Math.cos(Math.PI + a) * 5;
        const ly1 = 13 + Math.sin(Math.PI + a) * 4;
        const lx2 = 12 + Math.cos(Math.PI + a) * 11;
        const ly2 = 13 + Math.sin(Math.PI + a) * 9;
        g.moveTo(12, 13); g.lineTo(lx1, ly1); g.lineTo(lx2, ly2);
        g.stroke({ width: 2, color: 0x3a2a1a });
        // Right legs
        const rx1 = 12 + Math.cos(a) * 5;
        const ry1 = 13 + Math.sin(a) * 4;
        const rx2 = 12 + Math.cos(a) * 11;
        const ry2 = 13 + Math.sin(a) * 9;
        g.moveTo(12, 13); g.lineTo(rx1, ry1); g.lineTo(rx2, ry2);
        g.stroke({ width: 2, color: 0x3a2a1a });
      }
      // Fangs
      g.moveTo(10, 15); g.lineTo(9, 18);
      g.stroke({ width: 1.5, color: 0xeeeedd });
      g.moveTo(14, 15); g.lineTo(15, 18);
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
