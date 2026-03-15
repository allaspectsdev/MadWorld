import { TileType, type ZoneDef } from "@madworld/shared";

function generateTiles(
  width: number,
  height: number,
  fill: TileType = TileType.GRASS,
): TileType[][] {
  return Array.from({ length: height }, () => Array(width).fill(fill));
}

function applyFeature(
  tiles: TileType[][],
  x: number,
  y: number,
  w: number,
  h: number,
  type: TileType,
): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const ty = y + dy;
      const tx = x + dx;
      if (ty >= 0 && ty < tiles.length && tx >= 0 && tx < tiles[0].length) {
        tiles[ty][tx] = type;
      }
    }
  }
}

function setTile(tiles: TileType[][], x: number, y: number, type: TileType): void {
  if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
    tiles[y][x] = type;
  }
}

// --- Greendale Village (Starter Zone) ---
function createGreendale(): ZoneDef {
  const w = 60, h = 60;
  const tiles = generateTiles(w, h, TileType.GRASS);

  // === Market Square (cobblestone center) ===
  applyFeature(tiles, 22, 22, 16, 16, TileType.COBBLESTONE);

  // === Dirt roads (4 cardinal directions) ===
  applyFeature(tiles, 28, 0, 4, 22, TileType.DIRT);  // north road
  applyFeature(tiles, 28, 38, 4, 22, TileType.DIRT);  // south road
  applyFeature(tiles, 0, 28, 22, 4, TileType.DIRT);   // west road
  applyFeature(tiles, 38, 28, 22, 4, TileType.DIRT);  // east road

  // === Well in market center (small water tile surrounded by cobblestone) ===
  setTile(tiles, 30, 29, TileType.WATER);
  setTile(tiles, 30, 30, TileType.WATER);

  // === Buildings ===
  // General store (NW of market)
  applyFeature(tiles, 23, 23, 5, 4, TileType.BUILDING_FLOOR);
  // Inn (NE of market)
  applyFeature(tiles, 32, 23, 5, 4, TileType.BUILDING_FLOOR);
  // Blacksmith (SW of market)
  applyFeature(tiles, 23, 33, 4, 4, TileType.BUILDING_FLOOR);
  // Town hall (SE of market, larger)
  applyFeature(tiles, 31, 33, 6, 4, TileType.BUILDING_FLOOR);

  // === Farm area (NW) with fences (mountain tiles as fences) ===
  // Fences around the farm
  applyFeature(tiles, 4, 14, 12, 1, TileType.MOUNTAIN);  // top fence
  applyFeature(tiles, 4, 24, 12, 1, TileType.MOUNTAIN);  // bottom fence
  applyFeature(tiles, 4, 14, 1, 11, TileType.MOUNTAIN);   // left fence
  applyFeature(tiles, 15, 14, 1, 11, TileType.MOUNTAIN);  // right fence
  // Farmland strips inside
  applyFeature(tiles, 5, 15, 10, 1, TileType.DIRT);
  applyFeature(tiles, 5, 17, 10, 1, TileType.DIRT);
  applyFeature(tiles, 5, 19, 10, 1, TileType.DIRT);
  applyFeature(tiles, 5, 21, 10, 1, TileType.DIRT);
  applyFeature(tiles, 5, 23, 10, 1, TileType.DIRT);
  // Gate opening in bottom fence
  setTile(tiles, 9, 24, TileType.DIRT);
  setTile(tiles, 10, 24, TileType.DIRT);

  // === Pond (NE area, larger with sand edge) ===
  applyFeature(tiles, 44, 4, 10, 2, TileType.SAND);
  applyFeature(tiles, 43, 6, 12, 1, TileType.SAND);
  applyFeature(tiles, 43, 13, 12, 1, TileType.SAND);
  applyFeature(tiles, 44, 14, 10, 1, TileType.SAND);
  applyFeature(tiles, 44, 6, 10, 7, TileType.WATER);

  // === Gardens / flower patches (decorative dirt patches near buildings) ===
  // Garden behind general store
  applyFeature(tiles, 24, 27, 3, 1, TileType.DIRT);
  // Garden behind inn
  applyFeature(tiles, 33, 27, 3, 1, TileType.DIRT);

  // === Forest edges ===
  applyFeature(tiles, 0, 50, 15, 10, TileType.FOREST);
  applyFeature(tiles, 0, 45, 5, 5, TileType.FOREST);
  applyFeature(tiles, 45, 0, 15, 3, TileType.FOREST);
  // Small decorative tree patches
  applyFeature(tiles, 0, 0, 3, 4, TileType.FOREST);
  applyFeature(tiles, 18, 0, 4, 3, TileType.FOREST);
  applyFeature(tiles, 0, 35, 3, 5, TileType.FOREST);

  // === Mountains (impassable, SE corner) ===
  applyFeature(tiles, 50, 50, 10, 10, TileType.MOUNTAIN);
  applyFeature(tiles, 48, 52, 2, 6, TileType.MOUNTAIN);

  // === Signpost areas (cobblestone markers at road exits) ===
  setTile(tiles, 27, 2, TileType.COBBLESTONE);
  setTile(tiles, 32, 2, TileType.COBBLESTONE);
  setTile(tiles, 2, 27, TileType.COBBLESTONE);
  setTile(tiles, 2, 32, TileType.COBBLESTONE);

  // === Portals ===
  // Portal to Darkwood at south edge
  tiles[59][29] = TileType.PORTAL;
  tiles[59][30] = TileType.PORTAL;

  // Portal to fields at east edge
  tiles[29][59] = TileType.PORTAL;
  tiles[30][59] = TileType.PORTAL;

  return {
    id: "greendale",
    name: "Greendale Village",
    width: w,
    height: h,
    tiles,
    spawnX: 30,
    spawnY: 30,
    portals: [
      { x: 29, y: 59, targetZoneId: "darkwood", targetX: 29, targetY: 1 },
      { x: 30, y: 59, targetZoneId: "darkwood", targetX: 30, targetY: 1 },
      { x: 59, y: 29, targetZoneId: "fields", targetX: 1, targetY: 29 },
      { x: 59, y: 30, targetZoneId: "fields", targetX: 1, targetY: 30 },
    ],
    mobSpawns: [
      { mobId: "chicken", x: 8, y: 18, count: 4, wanderRadius: 3 },
      { mobId: "chicken", x: 15, y: 42, count: 3, wanderRadius: 4 },
      { mobId: "cow", x: 42, y: 40, count: 3, wanderRadius: 5 },
      { mobId: "cow", x: 20, y: 48, count: 2, wanderRadius: 4 },
    ],
    lights: [
      // Market center campfire
      { x: 30, y: 30, radius: 5, color: 0xff9944, flicker: true },
      // General store torch
      { x: 25, y: 22, radius: 3, color: 0xffaa55, flicker: true },
      // Inn torch
      { x: 34, y: 22, radius: 3, color: 0xffaa55, flicker: true },
      // Blacksmith forge glow
      { x: 25, y: 33, radius: 3, color: 0xff6622, flicker: true },
      // Town hall torch
      { x: 34, y: 33, radius: 3, color: 0xffaa55, flicker: true },
      // Road exit signposts
      { x: 29, y: 2, radius: 2, color: 0xffcc66, flicker: true },
      { x: 2, y: 29, radius: 2, color: 0xffcc66, flicker: true },
      // Portal glow
      { x: 29, y: 59, radius: 4, color: 0x9b59b6 },
      { x: 59, y: 29, radius: 4, color: 0x9b59b6 },
    ],
  };
}

// --- Darkwood Forest ---
function createDarkwood(): ZoneDef {
  const w = 80, h = 80;
  const tiles = generateTiles(w, h, TileType.FOREST);

  // === Winding main path N-S (not perfectly straight) ===
  // Segment 1: north entry
  applyFeature(tiles, 28, 0, 4, 15, TileType.DIRT);
  // Curve east
  applyFeature(tiles, 30, 14, 8, 4, TileType.DIRT);
  // Segment 2: south from curve
  applyFeature(tiles, 36, 17, 4, 10, TileType.DIRT);
  // Curve back west
  applyFeature(tiles, 28, 26, 12, 4, TileType.DIRT);
  // Segment 3: straight south
  applyFeature(tiles, 28, 29, 4, 12, TileType.DIRT);
  // Cross path E-W
  applyFeature(tiles, 0, 38, 80, 4, TileType.DIRT);
  // Continue south from cross
  applyFeature(tiles, 28, 42, 4, 38, TileType.DIRT);

  // === Clearings (grass patches in forest) ===
  // North clearing — larger, more organic shape
  applyFeature(tiles, 8, 8, 14, 14, TileType.GRASS);
  applyFeature(tiles, 6, 10, 2, 10, TileType.GRASS);
  applyFeature(tiles, 22, 10, 2, 10, TileType.GRASS);

  // East clearing with ruins
  applyFeature(tiles, 50, 8, 14, 12, TileType.GRASS);
  // Ruined building fragments
  applyFeature(tiles, 53, 10, 3, 2, TileType.BUILDING_FLOOR);
  applyFeature(tiles, 58, 12, 2, 3, TileType.BUILDING_FLOOR);
  setTile(tiles, 55, 14, TileType.BUILDING_FLOOR);

  // South clearing
  applyFeature(tiles, 52, 52, 18, 18, TileType.GRASS);
  applyFeature(tiles, 50, 55, 2, 12, TileType.GRASS);

  // Small mysterious clearing
  applyFeature(tiles, 10, 55, 8, 8, TileType.GRASS);
  applyFeature(tiles, 13, 58, 2, 2, TileType.COBBLESTONE); // old stone circle

  // === Lake ===
  applyFeature(tiles, 10, 48, 2, 8, TileType.SAND); // west shore
  applyFeature(tiles, 22, 48, 2, 8, TileType.SAND); // east shore
  applyFeature(tiles, 10, 47, 14, 1, TileType.SAND); // north shore
  applyFeature(tiles, 10, 56, 14, 1, TileType.SAND); // south shore
  applyFeature(tiles, 12, 48, 10, 8, TileType.WATER);

  // === Mountains ===
  applyFeature(tiles, 0, 70, 25, 10, TileType.MOUNTAIN);
  applyFeature(tiles, 70, 65, 10, 15, TileType.MOUNTAIN);

  // === Portals ===
  // Portal back to Greendale at north edge
  tiles[0][29] = TileType.PORTAL;
  tiles[0][30] = TileType.PORTAL;

  // Dungeon portal — Goblin Warren entrance
  tiles[38][30] = TileType.DUNGEON_PORTAL;

  return {
    id: "darkwood",
    name: "Darkwood Forest",
    width: w,
    height: h,
    tiles,
    spawnX: 30,
    spawnY: 2,
    portals: [
      { x: 29, y: 0, targetZoneId: "greendale", targetX: 29, targetY: 58 },
      { x: 30, y: 0, targetZoneId: "greendale", targetX: 30, targetY: 58 },
      { x: 30, y: 38, targetZoneId: "goblin_warren", targetX: 6, targetY: 20, dungeonId: "goblin_warren" },
    ],
    mobSpawns: [
      { mobId: "goblin", x: 14, y: 14, count: 4, wanderRadius: 5 },
      { mobId: "goblin", x: 36, y: 22, count: 3, wanderRadius: 4 },
      { mobId: "forest_spider", x: 56, y: 58, count: 4, wanderRadius: 6 },
      { mobId: "skeleton", x: 55, y: 12, count: 3, wanderRadius: 4 },
      { mobId: "goblin", x: 40, y: 50, count: 3, wanderRadius: 5 },
      { mobId: "forest_spider", x: 12, y: 58, count: 2, wanderRadius: 3 },
    ],
    lights: [
      // Mysterious clearing glow
      { x: 14, y: 59, radius: 4, color: 0x44ff88 },
      // Stone circle eerie light
      { x: 14, y: 59, radius: 2, color: 0x88ffaa },
      // Dungeon portal red glow
      { x: 30, y: 38, radius: 5, color: 0xe74c3c },
      // Portal back to Greendale
      { x: 29, y: 0, radius: 4, color: 0x9b59b6 },
    ],
  };
}

// --- Fields ---
function createFields(): ZoneDef {
  const w = 60, h = 60;
  const tiles = generateTiles(w, h, TileType.GRASS);

  // === Dirt paths ===
  applyFeature(tiles, 0, 28, 60, 4, TileType.DIRT);   // main E-W road
  applyFeature(tiles, 38, 0, 4, 28, TileType.DIRT);   // north road to dungeon area

  // === Farmland areas (alternating dirt/grass strips) ===
  for (let row = 0; row < 6; row++) {
    applyFeature(tiles, 5, 8 + row * 3, 15, 1, TileType.DIRT);
  }
  // Farm fences
  applyFeature(tiles, 4, 7, 1, 13, TileType.MOUNTAIN);
  applyFeature(tiles, 21, 7, 1, 13, TileType.MOUNTAIN);
  applyFeature(tiles, 4, 7, 18, 1, TileType.MOUNTAIN);
  applyFeature(tiles, 4, 20, 18, 1, TileType.MOUNTAIN);
  // Gate
  setTile(tiles, 12, 20, TileType.DIRT);
  setTile(tiles, 13, 20, TileType.DIRT);

  // === Sandy beach (south) with gradual transition ===
  applyFeature(tiles, 0, 47, 60, 3, TileType.SAND);   // transition strip
  applyFeature(tiles, 0, 50, 60, 10, TileType.SAND);

  // === Water (river) — wider, with more bridges ===
  applyFeature(tiles, 25, 0, 3, 28, TileType.WATER);
  applyFeature(tiles, 25, 32, 3, 15, TileType.WATER);
  // Main bridge on road
  tiles[29][25] = TileType.BRIDGE;
  tiles[29][26] = TileType.BRIDGE;
  tiles[29][27] = TileType.BRIDGE;
  tiles[30][25] = TileType.BRIDGE;
  tiles[30][26] = TileType.BRIDGE;
  tiles[30][27] = TileType.BRIDGE;
  // Second bridge (north)
  tiles[12][25] = TileType.BRIDGE;
  tiles[12][26] = TileType.BRIDGE;
  tiles[12][27] = TileType.BRIDGE;
  tiles[13][25] = TileType.BRIDGE;
  tiles[13][26] = TileType.BRIDGE;
  tiles[13][27] = TileType.BRIDGE;

  // === Small forest patches ===
  applyFeature(tiles, 45, 5, 8, 6, TileType.FOREST);
  applyFeature(tiles, 0, 40, 6, 7, TileType.FOREST);

  // === Portals ===
  // Portal back to Greendale at west edge
  tiles[29][0] = TileType.PORTAL;
  tiles[30][0] = TileType.PORTAL;

  // Dungeon portal — Crypt of Bones entrance
  tiles[10][40] = TileType.DUNGEON_PORTAL;

  return {
    id: "fields",
    name: "Open Fields",
    width: w,
    height: h,
    tiles,
    spawnX: 2,
    spawnY: 30,
    portals: [
      { x: 0, y: 29, targetZoneId: "greendale", targetX: 58, targetY: 29 },
      { x: 0, y: 30, targetZoneId: "greendale", targetX: 58, targetY: 30 },
      { x: 40, y: 10, targetZoneId: "crypt_of_bones", targetX: 6, targetY: 7, dungeonId: "crypt_of_bones" },
    ],
    mobSpawns: [
      { mobId: "cow", x: 10, y: 12, count: 4, wanderRadius: 4 },
      { mobId: "goblin", x: 35, y: 8, count: 3, wanderRadius: 5 },
      { mobId: "chicken", x: 10, y: 42, count: 5, wanderRadius: 4 },
      { mobId: "cow", x: 45, y: 35, count: 3, wanderRadius: 5 },
    ],
    lights: [
      // Portal back to Greendale
      { x: 0, y: 29, radius: 4, color: 0x9b59b6 },
      // Dungeon portal
      { x: 40, y: 10, radius: 5, color: 0xe74c3c },
    ],
  };
}

export const ZONE_DEFS: ZoneDef[] = [
  createGreendale(),
  createDarkwood(),
  createFields(),
];
