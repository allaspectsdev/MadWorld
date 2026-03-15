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

// --- Greendale Village (Starter Zone) ---
function createGreendale(): ZoneDef {
  const w = 60, h = 60;
  const tiles = generateTiles(w, h, TileType.GRASS);

  // Central cobblestone area (village center)
  applyFeature(tiles, 20, 20, 20, 20, TileType.COBBLESTONE);

  // Dirt roads
  applyFeature(tiles, 28, 0, 4, 20, TileType.DIRT); // north road
  applyFeature(tiles, 28, 40, 4, 20, TileType.DIRT); // south road
  applyFeature(tiles, 0, 28, 20, 4, TileType.DIRT);  // west road
  applyFeature(tiles, 40, 28, 20, 4, TileType.DIRT);  // east road

  // Pond
  applyFeature(tiles, 5, 5, 8, 6, TileType.WATER);

  // Buildings (non-walkable)
  applyFeature(tiles, 22, 22, 5, 4, TileType.BUILDING_FLOOR); // shop
  applyFeature(tiles, 33, 22, 5, 4, TileType.BUILDING_FLOOR); // inn

  // Forest edges
  applyFeature(tiles, 0, 50, 20, 10, TileType.FOREST);
  applyFeature(tiles, 45, 0, 15, 15, TileType.FOREST);

  // Mountains (impassable)
  applyFeature(tiles, 50, 50, 10, 10, TileType.MOUNTAIN);

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
      { mobId: "chicken", x: 15, y: 35, count: 5, wanderRadius: 5 },
      { mobId: "cow", x: 45, y: 35, count: 3, wanderRadius: 4 },
    ],
  };
}

// --- Darkwood Forest ---
function createDarkwood(): ZoneDef {
  const w = 80, h = 80;
  const tiles = generateTiles(w, h, TileType.FOREST);

  // Clear paths through the forest
  applyFeature(tiles, 28, 0, 4, 80, TileType.DIRT); // main path N-S
  applyFeature(tiles, 0, 38, 80, 4, TileType.DIRT);  // cross path E-W

  // Clearings
  applyFeature(tiles, 10, 10, 12, 12, TileType.GRASS); // north clearing
  applyFeature(tiles, 55, 55, 15, 15, TileType.GRASS); // south clearing
  applyFeature(tiles, 50, 10, 10, 10, TileType.GRASS); // east clearing

  // Lake
  applyFeature(tiles, 12, 50, 10, 8, TileType.WATER);

  // Mountains
  applyFeature(tiles, 0, 70, 25, 10, TileType.MOUNTAIN);

  // Portal back to Greendale at north edge
  tiles[0][29] = TileType.PORTAL;
  tiles[0][30] = TileType.PORTAL;

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
    ],
    mobSpawns: [
      { mobId: "goblin", x: 15, y: 15, count: 4, wanderRadius: 5 },
      { mobId: "forest_spider", x: 60, y: 60, count: 3, wanderRadius: 6 },
      { mobId: "skeleton", x: 55, y: 12, count: 2, wanderRadius: 4 },
      { mobId: "goblin", x: 40, y: 50, count: 3, wanderRadius: 5 },
    ],
  };
}

// --- Fields ---
function createFields(): ZoneDef {
  const w = 60, h = 60;
  const tiles = generateTiles(w, h, TileType.GRASS);

  // Dirt path
  applyFeature(tiles, 0, 28, 60, 4, TileType.DIRT);

  // Sand area (south)
  applyFeature(tiles, 0, 50, 60, 10, TileType.SAND);

  // Water (river)
  applyFeature(tiles, 25, 0, 3, 28, TileType.WATER);
  applyFeature(tiles, 25, 32, 3, 18, TileType.WATER);
  tiles[29][26] = TileType.BRIDGE;
  tiles[29][27] = TileType.BRIDGE;
  tiles[30][26] = TileType.BRIDGE;
  tiles[30][27] = TileType.BRIDGE;

  // Portal back to Greendale at west edge
  tiles[29][0] = TileType.PORTAL;
  tiles[30][0] = TileType.PORTAL;

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
    ],
    mobSpawns: [
      { mobId: "cow", x: 10, y: 15, count: 4, wanderRadius: 6 },
      { mobId: "goblin", x: 40, y: 15, count: 3, wanderRadius: 5 },
      { mobId: "chicken", x: 10, y: 45, count: 6, wanderRadius: 4 },
    ],
  };
}

export const ZONE_DEFS: ZoneDef[] = [
  createGreendale(),
  createDarkwood(),
  createFields(),
];
