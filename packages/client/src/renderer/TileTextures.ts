import { Graphics, Texture } from "pixi.js";
import { TileType, TILE_SIZE } from "@madworld/shared";
import { TextureFactory } from "./TextureFactory.js";

const S = TILE_SIZE;

function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

// Helper: draw a small blade of grass
function blade(g: Graphics, x: number, y: number, h: number, color: number): void {
  g.moveTo(x, y);
  g.lineTo(x - 0.5, y - h);
  g.lineTo(x + 0.5, y - h);
  g.lineTo(x, y);
  g.fill(color);
}

function drawGrass(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 7919);
  const greens = [0x3d6b4a, 0x4a7c59, 0x5a8c69, 0x6a9c79, 0x3a6040, 0x528a5e];

  // Base with subtle gradient
  g.rect(0, 0, S, S);
  g.fill(0x4a7c59);
  // Darker edges for depth
  g.rect(0, 0, S, 3);
  g.fill({ color: 0x000000, alpha: 0.04 });
  g.rect(0, S - 3, S, 3);
  g.fill({ color: 0x000000, alpha: 0.04 });

  // Dense grass blades in clusters
  for (let cluster = 0; cluster < 5; cluster++) {
    const cx = 4 + rng() * (S - 8);
    const cy = 4 + rng() * (S - 8);
    const count = 4 + Math.floor(rng() * 5);
    for (let i = 0; i < count; i++) {
      const bx = cx + (rng() - 0.5) * 8;
      const by = cy + (rng() - 0.5) * 6;
      const bh = 2 + rng() * 4;
      const color = greens[Math.floor(rng() * greens.length)];
      if (bx > 0 && bx < S && by > 2 && by < S) {
        blade(g, bx, by, bh, color);
        // Shadow at base
        g.rect(bx - 0.5, by, 1, 0.5);
        g.fill({ color: 0x000000, alpha: 0.08 });
      }
    }
  }

  // Scattered individual blades
  for (let i = 0; i < 10; i++) {
    const x = rng() * S;
    const y = 3 + rng() * (S - 3);
    blade(g, x, y, 1 + rng() * 3, greens[Math.floor(rng() * greens.length)]);
  }

  // Flowers on variant 0 and 1
  if (variant < 2) {
    const flowerColors = [0xffff66, 0xff99cc, 0xffffcc, 0xaaddff];
    const fCount = 1 + Math.floor(rng() * 3);
    for (let f = 0; f < fCount; f++) {
      const fx = 4 + rng() * (S - 8);
      const fy = 4 + rng() * (S - 8);
      g.circle(fx, fy, 1.5);
      g.fill(flowerColors[Math.floor(rng() * flowerColors.length)]);
    }
  }

  return TextureFactory.generate(g, S, S);
}

function drawDirt(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 6271);

  g.rect(0, 0, S, S);
  g.fill(0x8b7355);

  // Layered noise — many speckles of varying sizes
  const browns = [0x7b6345, 0x9b8365, 0x6b5335, 0xa89375, 0x8a7050];
  for (let i = 0; i < 30; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const size = 0.5 + rng() * 2;
    g.rect(x, y, size, size);
    g.fill(browns[Math.floor(rng() * browns.length)]);
  }

  // Cracks (thin dark paths)
  for (let c = 0; c < 2; c++) {
    let cx = rng() * S;
    let cy = rng() * S;
    g.moveTo(cx, cy);
    for (let seg = 0; seg < 4; seg++) {
      cx += (rng() - 0.5) * 8;
      cy += rng() * 6;
      g.lineTo(Math.max(0, Math.min(S, cx)), Math.max(0, Math.min(S, cy)));
    }
    g.stroke({ width: 0.5, color: 0x5a4230, alpha: 0.6 });
  }

  // Stone clusters
  if (variant < 2) {
    for (let s = 0; s < 2 + Math.floor(rng() * 2); s++) {
      const sx = 3 + rng() * (S - 6);
      const sy = 3 + rng() * (S - 6);
      g.circle(sx, sy, 1 + rng() * 1.5);
      g.fill(0x999999);
      g.circle(sx + 0.5, sy + 0.5, 1 + rng() * 1.5);
      g.fill({ color: 0x000000, alpha: 0.1 });
    }
  }

  return TextureFactory.generate(g, S, S);
}

function drawCobblestone(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 4391);

  // Mortar base
  g.rect(0, 0, S, S);
  g.fill(0x3a3a3a);

  // Irregular stones with 3D shadow
  let y = 1;
  while (y < S - 1) {
    let x = 1;
    const rowShift = Math.floor(rng() * 5);
    while (x < S - 1) {
      const sw = 5 + Math.floor(rng() * 9);
      const sh = 4 + Math.floor(rng() * 5);
      const w = Math.min(sw, S - x - 1);
      const h = Math.min(sh, S - y - 1);
      if (w < 3 || h < 3) { x += sw + 1; continue; }

      const baseShade = 0x686868 + Math.floor(rng() * 0x303030);
      // Stone face
      g.roundRect(x + rowShift % 3, y, w, h, 1.5);
      g.fill(baseShade);
      // Highlight (top-left)
      g.rect(x + rowShift % 3 + 1, y + 1, w - 2, 1);
      g.fill({ color: 0xffffff, alpha: 0.08 });
      // Shadow (bottom-right)
      g.rect(x + rowShift % 3, y + h - 1, w, 1);
      g.fill({ color: 0x000000, alpha: 0.12 });
      g.rect(x + rowShift % 3 + w - 1, y, 1, h);
      g.fill({ color: 0x000000, alpha: 0.1 });

      x += w + 1;
    }
    y += 5 + Math.floor(rng() * 4);
  }

  return TextureFactory.generate(g, S, S);
}

function drawWater(frame: number): Texture {
  const g = new Graphics();

  // Gradient base — darker at edges, lighter center
  g.rect(0, 0, S, S);
  g.fill(0x2d5e95);
  g.rect(4, 4, S - 8, S - 8);
  g.fill(0x3a6ea5);
  g.rect(8, 8, S - 16, S - 16);
  g.fill(0x4278af);

  // Sine-wave color bands
  const phase = frame * 0.7;
  for (let row = 0; row < S; row += 3) {
    const waveOffset = Math.sin((row * 0.2) + phase) * 3;
    const brightness = 0.02 + Math.sin((row * 0.15) + phase * 0.5) * 0.02;
    g.rect(0, row + waveOffset, S, 2);
    g.fill({ color: 0x88bbee, alpha: brightness });
  }

  // Specular highlights — 5 per frame, shifted positions
  for (let i = 0; i < 5; i++) {
    const hx = ((7 + i * 7 + frame * 4) % (S - 2)) + 1;
    const hy = ((3 + i * 6 + frame * 3) % (S - 2)) + 1;
    g.circle(hx, hy, 0.8);
    g.fill({ color: 0xffffff, alpha: 0.35 });
    // Small glow around highlight
    g.circle(hx, hy, 2);
    g.fill({ color: 0xaaddff, alpha: 0.1 });
  }

  return TextureFactory.generate(g, S, S);
}

function drawSand(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 5101);

  g.rect(0, 0, S, S);
  g.fill(0xc2b280);

  // Wind ripple lines
  for (let i = 0; i < 4; i++) {
    const ry = 4 + i * 7 + Math.floor(rng() * 4);
    g.moveTo(0, ry);
    for (let x = 0; x < S; x += 4) {
      g.lineTo(x, ry + Math.sin(x * 0.3 + variant) * 1.5);
    }
    g.stroke({ width: 0.5, color: 0xb8a870, alpha: 0.4 });
  }

  // Dense speckles
  const sandColors = [0xb2a270, 0xd2c290, 0xc8b888, 0xbaa878];
  for (let i = 0; i < 25; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const size = 0.5 + rng() * 1.5;
    g.rect(x, y, size, size);
    g.fill(sandColors[Math.floor(rng() * sandColors.length)]);
  }

  // Small shell/pebble on some variants
  if (variant === 0) {
    g.circle(8 + rng() * 16, 8 + rng() * 16, 1.5);
    g.fill(0xeeddcc);
  }

  return TextureFactory.generate(g, S, S);
}

function drawForest(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 8837);

  // Dark ground base
  g.rect(0, 0, S, S);
  g.fill(0x263e1e);

  // Ground cover moss dots
  for (let i = 0; i < 12; i++) {
    g.rect(rng() * S, rng() * S, 1 + rng(), 1);
    g.fill(rng() > 0.5 ? 0x1e3216 : 0x2e4e26);
  }

  // Shadow under canopy
  const tx = 8 + Math.floor(rng() * 14);
  const ty = 12 + Math.floor(rng() * 8);
  g.ellipse(tx + 2, ty + 10, 7, 3);
  g.fill({ color: 0x000000, alpha: 0.2 });

  // Tree trunk with branch
  g.rect(tx, ty, 4, 8);
  g.fill(0x5c3a1e);
  // Bark detail
  g.rect(tx + 1, ty + 2, 2, 1);
  g.fill(0x4a2e14);
  g.rect(tx + 1, ty + 5, 2, 1);
  g.fill(0x4a2e14);
  // Small branch
  g.moveTo(tx + 4, ty + 3);
  g.lineTo(tx + 7, ty + 1);
  g.stroke({ width: 1, color: 0x5c3a1e });

  // Canopy — multiple overlapping leaf clusters
  const leafColors = [0x1e5a16, 0x2a6e22, 0x1a4e12, 0x267a1e];
  for (let c = 0; c < 3; c++) {
    const lx = tx + 2 + (rng() - 0.5) * 6;
    const ly = ty - 2 + (rng() - 0.5) * 4;
    const lr = 4 + rng() * 3;
    g.circle(lx, ly, lr);
    g.fill(leafColors[Math.floor(rng() * leafColors.length)]);
  }
  // Highlight on top of canopy
  g.circle(tx + 1, ty - 3, 2);
  g.fill({ color: 0x88cc66, alpha: 0.2 });

  return TextureFactory.generate(g, S, S);
}

function drawMountain(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 2677);

  g.rect(0, 0, S, S);
  g.fill(0x606060);

  // Horizontal rock striations
  for (let y = 0; y < S; y += 3 + Math.floor(rng() * 3)) {
    const shade = 0x585858 + Math.floor(rng() * 0x282828);
    g.rect(0, y, S, 2 + Math.floor(rng() * 2));
    g.fill(shade);
  }

  // Rock face with shadow
  const peakX = 8 + rng() * 16;
  const peakY = 4 + rng() * 6;
  // Light side
  g.moveTo(peakX - 6, S);
  g.lineTo(peakX, peakY);
  g.lineTo(peakX, S);
  g.fill({ color: 0x8a8a8a, alpha: 0.4 });
  // Dark side
  g.moveTo(peakX, peakY);
  g.lineTo(peakX + 8, S);
  g.lineTo(peakX, S);
  g.fill({ color: 0x000000, alpha: 0.15 });

  // Cracks
  for (let c = 0; c < 3; c++) {
    const x1 = rng() * S;
    const y1 = rng() * S;
    g.moveTo(x1, y1);
    g.lineTo(x1 + (rng() - 0.5) * 6, y1 + rng() * 8);
    g.stroke({ width: 0.5, color: 0x3a3a3a, alpha: 0.6 });
  }

  // Snow on top ~40%
  for (let y = 0; y < S * 0.4; y++) {
    const coverage = 1 - (y / (S * 0.4));
    if (rng() < coverage * 0.6) {
      const x = rng() * S;
      const w = 2 + rng() * 4;
      g.rect(x, y, w, 1);
      g.fill({ color: 0xffffff, alpha: 0.4 + coverage * 0.3 });
    }
  }

  return TextureFactory.generate(g, S, S);
}

function drawBridge(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 1993);

  g.rect(0, 0, S, S);
  g.fill(0x7b5904);

  // Planks with grain and gaps
  for (let y = 0; y < S; y += 5) {
    const shade = 0x8b6914 + Math.floor(rng() * 0x151510);
    g.rect(0, y, S, 4);
    g.fill(shade);
    // Highlight on plank top
    g.rect(0, y, S, 1);
    g.fill({ color: 0xffffff, alpha: 0.05 });
    // Gap
    g.rect(0, y + 4, S, 1);
    g.fill(0x3a2a04);
    // Grain lines
    for (let gl = 0; gl < 2; gl++) {
      const gx = rng() * S;
      g.moveTo(gx, y);
      g.lineTo(gx + (rng() - 0.5) * 3, y + 4);
      g.stroke({ width: 0.3, color: 0x6a5004, alpha: 0.3 });
    }
  }

  // Railing posts on edges
  g.rect(1, 0, 3, S);
  g.fill({ color: 0x5c3a1e, alpha: 0.5 });
  g.rect(S - 4, 0, 3, S);
  g.fill({ color: 0x5c3a1e, alpha: 0.5 });

  // Nails
  for (let y = 2; y < S; y += 10) {
    g.circle(3, y, 0.8);
    g.fill(0x555555);
    g.circle(S - 3, y, 0.8);
    g.fill(0x555555);
  }

  return TextureFactory.generate(g, S, S);
}

function drawBuildingFloor(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 3313);

  // Grout base
  g.rect(0, 0, S, S);
  g.fill(0x6a3a1e);

  // Flagstone tiles in a grid with alternating colors
  const tileW = 8;
  const tileH = 8;
  for (let ty = 0; ty < S; ty += tileH) {
    for (let tx = 0; tx < S; tx += tileW) {
      const light = (Math.floor(tx / tileW) + Math.floor(ty / tileH)) % 2 === 0;
      const baseColor = light ? 0xa8582e : 0x954a24;
      const shade = baseColor + Math.floor(rng() * 0x0a0a0a);
      g.rect(tx + 0.5, ty + 0.5, tileW - 1, tileH - 1);
      g.fill(shade);
      // Subtle highlight
      g.rect(tx + 1, ty + 1, tileW - 2, 1);
      g.fill({ color: 0xffffff, alpha: 0.04 });
      // Shadow bottom
      g.rect(tx + 1, ty + tileH - 1.5, tileW - 2, 0.5);
      g.fill({ color: 0x000000, alpha: 0.08 });
    }
  }

  return TextureFactory.generate(g, S, S);
}

function drawPortal(frame: number): Texture {
  const g = new Graphics();

  // Dark base
  g.rect(0, 0, S, S);
  g.fill(0x1a0e30);

  // Large central glow
  g.circle(S / 2, S / 2, 10);
  g.fill({ color: 0x9b59b6, alpha: 0.2 });
  g.circle(S / 2, S / 2, 6);
  g.fill({ color: 0xc39bd3, alpha: 0.3 });
  g.circle(S / 2, S / 2, 3);
  g.fill({ color: 0xffffff, alpha: 0.5 });

  // Orbiting sparkles (6 particles)
  const angle = (frame * 50 * Math.PI) / 180;
  for (let i = 0; i < 6; i++) {
    const a = angle + (i * Math.PI * 2) / 6;
    const r = 8 + Math.sin(a * 2 + frame) * 2;
    const px = S / 2 + Math.cos(a) * r;
    const py = S / 2 + Math.sin(a) * r;
    if (px > 1 && px < S - 1 && py > 1 && py < S - 1) {
      g.circle(px, py, 1.5);
      g.fill({ color: 0xeeccff, alpha: 0.6 });
      g.circle(px, py, 3);
      g.fill({ color: 0x9b59b6, alpha: 0.15 });
    }
  }

  // Swirl arcs
  for (let i = 0; i < 3; i++) {
    const sa = angle + (i * Math.PI * 2) / 3;
    const sx = S / 2 + Math.cos(sa) * 6;
    const sy = S / 2 + Math.sin(sa) * 6;
    g.circle(sx, sy, 2);
    g.fill({ color: 0xc39bd3, alpha: 0.4 });
  }

  return TextureFactory.generate(g, S, S);
}

function drawDungeonPortal(frame: number): Texture {
  const g = new Graphics();

  g.rect(0, 0, S, S);
  g.fill(0x2e0e0e);

  // Large red glow
  g.circle(S / 2, S / 2, 10);
  g.fill({ color: 0xe74c3c, alpha: 0.2 });
  g.circle(S / 2, S / 2, 6);
  g.fill({ color: 0xff6b6b, alpha: 0.3 });
  g.circle(S / 2, S / 2, 3);
  g.fill({ color: 0xffcccc, alpha: 0.5 });

  const angle = (frame * 50 * Math.PI) / 180;
  for (let i = 0; i < 6; i++) {
    const a = angle + (i * Math.PI * 2) / 6;
    const r = 8 + Math.sin(a * 2 + frame) * 2;
    const px = S / 2 + Math.cos(a) * r;
    const py = S / 2 + Math.sin(a) * r;
    if (px > 1 && px < S - 1 && py > 1 && py < S - 1) {
      g.circle(px, py, 1.5);
      g.fill({ color: 0xffaaaa, alpha: 0.6 });
      g.circle(px, py, 3);
      g.fill({ color: 0xe74c3c, alpha: 0.15 });
    }
  }

  for (let i = 0; i < 3; i++) {
    const sa = angle + (i * Math.PI * 2) / 3;
    const sx = S / 2 + Math.cos(sa) * 6;
    const sy = S / 2 + Math.sin(sa) * 6;
    g.circle(sx, sy, 2);
    g.fill({ color: 0xff6b6b, alpha: 0.4 });
  }

  return TextureFactory.generate(g, S, S);
}

// === Public API ===

export type TileTextureSet = {
  variants: Texture[];
  frames?: Texture[][];
};

const tileSets = new Map<TileType, TileTextureSet>();

export function generateTileTextures(): void {
  const staticTiles: [TileType, (v: number) => Texture, number][] = [
    [TileType.GRASS, drawGrass, 4],
    [TileType.DIRT, drawDirt, 3],
    [TileType.COBBLESTONE, drawCobblestone, 3],
    [TileType.SAND, drawSand, 3],
    [TileType.FOREST, drawForest, 4],
    [TileType.MOUNTAIN, drawMountain, 3],
    [TileType.BRIDGE, drawBridge, 2],
    [TileType.BUILDING_FLOOR, drawBuildingFloor, 3],
  ];

  for (const [type, drawFn, count] of staticTiles) {
    const variants: Texture[] = [];
    for (let v = 0; v < count; v++) {
      variants.push(drawFn(v));
    }
    tileSets.set(type, { variants });
  }

  const animatedTiles: [TileType, (frame: number) => Texture][] = [
    [TileType.WATER, drawWater],
    [TileType.PORTAL, drawPortal],
    [TileType.DUNGEON_PORTAL, drawDungeonPortal],
  ];

  for (const [type, drawFn] of animatedTiles) {
    const frames: Texture[][] = [];
    for (let f = 0; f < 3; f++) {
      frames.push([drawFn(f)]);
    }
    tileSets.set(type, { variants: frames[0], frames });
  }
}

export function getTileTextureSet(type: TileType): TileTextureSet | undefined {
  return tileSets.get(type);
}

export function tileVariantHash(x: number, y: number): number {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}
