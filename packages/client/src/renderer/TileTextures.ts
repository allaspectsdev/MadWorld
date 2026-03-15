import { Graphics, Texture } from "pixi.js";
import { TileType, TILE_SIZE } from "@madworld/shared";
import { TextureFactory } from "./TextureFactory.js";

const S = TILE_SIZE;

function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) / 4294967296);
  };
}

function drawGrass(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 7919);

  // Base
  g.rect(0, 0, S, S);
  g.fill(0x4a7c59);

  // Grass blades / detail
  const colors = [0x5a8c69, 0x3a6c49, 0x6a9c79, 0x4a8c55];
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rng() * S);
    const y = Math.floor(rng() * S);
    const c = colors[Math.floor(rng() * colors.length)];
    g.rect(x, y, 1 + Math.floor(rng() * 2), 1);
    g.fill(c);
  }

  // Flower on variant 0
  if (variant === 0) {
    g.circle(8 + rng() * 16, 8 + rng() * 16, 1.5);
    g.fill(0xffff99);
  }

  // Edge darkening
  if (rng() > 0.5) {
    g.rect(0, 0, S, 2);
    g.fill({ color: 0x000000, alpha: 0.06 });
  }

  return TextureFactory.generate(g, S, S);
}

function drawDirt(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 6271);

  g.rect(0, 0, S, S);
  g.fill(0x8b7355);

  // Speckles
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rng() * S);
    const y = Math.floor(rng() * S);
    g.rect(x, y, 1, 1);
    g.fill(rng() > 0.5 ? 0x7b6345 : 0x9b8365);
  }

  // Pebble
  if (variant < 2) {
    g.circle(8 + rng() * 16, 8 + rng() * 16, 1.5);
    g.fill(0x999999);
  }

  return TextureFactory.generate(g, S, S);
}

function drawCobblestone(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 4391);

  // Mortar background
  g.rect(0, 0, S, S);
  g.fill(0x444444);

  // Stones
  let y = 1;
  while (y < S - 2) {
    let x = 1;
    const rowOffset = Math.floor(rng() * 4);
    while (x < S - 2) {
      const sw = 6 + Math.floor(rng() * 8);
      const sh = 5 + Math.floor(rng() * 5);
      const shade = 0x707070 + Math.floor(rng() * 0x282828);
      g.roundRect(x + rowOffset, y, Math.min(sw, S - x - 2), Math.min(sh, S - y - 2), 1);
      g.fill(shade);
      x += sw + 1;
    }
    y += 6 + Math.floor(rng() * 4);
  }

  return TextureFactory.generate(g, S, S);
}

function drawWater(frame: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(frame * 3571);

  // Base
  g.rect(0, 0, S, S);
  g.fill(0x3a6ea5);

  // Wave highlights
  const offset = frame * 4;
  for (let i = 0; i < 3; i++) {
    const y = 8 + i * 9 + (offset % 6);
    g.moveTo(0, y);
    g.bezierCurveTo(8 + frame * 3, y - 3, 24 - frame * 2, y + 3, S, y);
    g.stroke({ width: 1, color: 0x5a8ec5, alpha: 0.5 });
  }

  // Specular dots
  for (let i = 0; i < 3; i++) {
    const x = (10 + i * 10 + frame * 5) % S;
    const y = (6 + i * 11 + frame * 3) % S;
    g.circle(x, y, 1);
    g.fill({ color: 0xffffff, alpha: 0.4 });
  }

  return TextureFactory.generate(g, S, S);
}

function drawSand(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 5101);

  g.rect(0, 0, S, S);
  g.fill(0xc2b280);

  for (let i = 0; i < 18; i++) {
    const x = Math.floor(rng() * S);
    const y = Math.floor(rng() * S);
    g.rect(x, y, 1, 1);
    g.fill(rng() > 0.5 ? 0xb2a270 : 0xd2c290);
  }

  return TextureFactory.generate(g, S, S);
}

function drawForest(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 8837);

  // Dark ground
  g.rect(0, 0, S, S);
  g.fill(0x2a4a22);

  // Undergrowth
  for (let i = 0; i < 6; i++) {
    g.rect(Math.floor(rng() * S), Math.floor(rng() * S), 1, 1);
    g.fill(0x1a3a12);
  }

  // Tree trunk + canopy
  const tx = 10 + Math.floor(rng() * 12);
  const ty = 14 + Math.floor(rng() * 6);
  g.rect(tx, ty, 3, 6);
  g.fill(0x5c3a1e);
  g.circle(tx + 1.5, ty - 2, 5 + rng() * 2);
  g.fill(0x1e5a16);

  // Darker shadow at tree base
  g.ellipse(tx + 1.5, ty + 6, 4, 1.5);
  g.fill({ color: 0x000000, alpha: 0.15 });

  return TextureFactory.generate(g, S, S);
}

function drawMountain(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 2677);

  g.rect(0, 0, S, S);
  g.fill(0x696969);

  // Rock face highlight
  g.moveTo(4 + rng() * 8, S);
  g.lineTo(S / 2, 4 + rng() * 6);
  g.lineTo(S - 4 - rng() * 8, S);
  g.fill({ color: 0x898989, alpha: 0.6 });

  // Cracks
  for (let i = 0; i < 2; i++) {
    const x1 = Math.floor(rng() * S);
    const y1 = Math.floor(rng() * S);
    g.moveTo(x1, y1);
    g.lineTo(x1 + rng() * 8 - 4, y1 + rng() * 8);
    g.stroke({ width: 0.5, color: 0x444444 });
  }

  // Snow caps on variant 0
  if (variant === 0) {
    g.circle(S / 2, 6, 3);
    g.fill({ color: 0xffffff, alpha: 0.5 });
  }

  return TextureFactory.generate(g, S, S);
}

function drawBridge(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 1993);

  g.rect(0, 0, S, S);
  g.fill(0x8b6914);

  // Planks
  for (let y = 0; y < S; y += 6) {
    const shade = 0x7b5904 + Math.floor(rng() * 0x202020);
    g.rect(0, y, S, 5);
    g.fill(shade);
    g.rect(0, y + 5, S, 1);
    g.fill(0x3a2a04);
  }

  // Nails
  for (let y = 2; y < S; y += 12) {
    g.circle(4, y, 1);
    g.fill(0x555555);
    g.circle(S - 4, y, 1);
    g.fill(0x555555);
  }

  return TextureFactory.generate(g, S, S);
}

function drawBuildingFloor(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 3313);

  g.rect(0, 0, S, S);
  g.fill(0xa0522d);

  // Wood planks
  for (let y = 0; y < S; y += 5) {
    const shade = 0x904220 + Math.floor(rng() * 0x201810);
    g.rect(0, y, S, 4);
    g.fill(shade);
  }

  // Grain lines
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(rng() * S);
    g.moveTo(x, 0);
    g.lineTo(x + rng() * 4 - 2, S);
    g.stroke({ width: 0.3, color: 0x703a1a, alpha: 0.4 });
  }

  return TextureFactory.generate(g, S, S);
}

function drawPortal(frame: number): Texture {
  const g = new Graphics();

  // Dark base
  g.rect(0, 0, S, S);
  g.fill(0x2d1b4e);

  // Swirling arcs
  const angle = (frame * 40 * Math.PI) / 180;
  for (let i = 0; i < 3; i++) {
    const a = angle + (i * Math.PI * 2) / 3;
    const cx = S / 2 + Math.cos(a) * 8;
    const cy = S / 2 + Math.sin(a) * 8;
    g.circle(cx, cy, 3);
    g.fill({ color: 0xc39bd3, alpha: 0.5 });
  }

  // Center glow
  g.circle(S / 2, S / 2, 6);
  g.fill({ color: 0xffffff, alpha: 0.25 });
  g.circle(S / 2, S / 2, 3);
  g.fill({ color: 0xffffff, alpha: 0.4 });

  // Edge sparkles
  for (let i = 0; i < 4; i++) {
    const a2 = angle * 1.5 + (i * Math.PI) / 2;
    const ex = S / 2 + Math.cos(a2) * 12;
    const ey = S / 2 + Math.sin(a2) * 12;
    if (ex > 0 && ex < S && ey > 0 && ey < S) {
      g.circle(ex, ey, 1);
      g.fill({ color: 0x9b59b6, alpha: 0.7 });
    }
  }

  return TextureFactory.generate(g, S, S);
}

function drawDungeonPortal(frame: number): Texture {
  const g = new Graphics();

  g.rect(0, 0, S, S);
  g.fill(0x4e1b1b);

  const angle = (frame * 40 * Math.PI) / 180;
  for (let i = 0; i < 3; i++) {
    const a = angle + (i * Math.PI * 2) / 3;
    const cx = S / 2 + Math.cos(a) * 8;
    const cy = S / 2 + Math.sin(a) * 8;
    g.circle(cx, cy, 3);
    g.fill({ color: 0xff6b6b, alpha: 0.5 });
  }

  g.circle(S / 2, S / 2, 6);
  g.fill({ color: 0xffffff, alpha: 0.2 });
  g.circle(S / 2, S / 2, 3);
  g.fill({ color: 0xffcccc, alpha: 0.4 });

  for (let i = 0; i < 4; i++) {
    const a2 = angle * 1.5 + (i * Math.PI) / 2;
    const ex = S / 2 + Math.cos(a2) * 12;
    const ey = S / 2 + Math.sin(a2) * 12;
    if (ex > 0 && ex < S && ey > 0 && ey < S) {
      g.circle(ex, ey, 1);
      g.fill({ color: 0xe74c3c, alpha: 0.7 });
    }
  }

  return TextureFactory.generate(g, S, S);
}

// === Public API ===

export type TileTextureSet = {
  variants: Texture[];
  frames?: Texture[][];  // animated tiles: frames[frameIndex] = variants
};

const tileSets = new Map<TileType, TileTextureSet>();

export function generateTileTextures(): void {
  // Static tiles (3-4 variants each)
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

  // Animated tiles (3 frames, each with 1 variant since animation provides variation)
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
