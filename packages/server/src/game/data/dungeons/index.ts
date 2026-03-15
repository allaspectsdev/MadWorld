import { TileType, type ZoneDef, type DungeonDef } from "@madworld/shared";

export const DUNGEON_DEFS: DungeonDef[] = [
  {
    id: "goblin_warren",
    name: "Goblin Warren",
    minLevel: 10,
    entrancePortalZoneId: "darkwood",
    entrancePortalX: 30,
    entrancePortalY: 38,
    exitReturnZoneId: "darkwood",
    exitReturnX: 30,
    exitReturnY: 37,
    bossId: "goblin_chieftain",
  },
  {
    id: "crypt_of_bones",
    name: "Crypt of Bones",
    minLevel: 15,
    entrancePortalZoneId: "fields",
    entrancePortalX: 40,
    entrancePortalY: 10,
    exitReturnZoneId: "fields",
    exitReturnX: 40,
    exitReturnY: 9,
    bossId: "lich_king",
  },
];

function fill(tiles: TileType[][], x: number, y: number, w: number, h: number, type: TileType): void {
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

function buildGoblinWarren(): ZoneDef {
  const w = 50, h = 40;
  const tiles: TileType[][] = Array.from({ length: h }, () => Array(w).fill(TileType.MOUNTAIN));

  // Room 1 — Entrance (10x10)
  fill(tiles, 2, 15, 10, 10, TileType.BUILDING_FLOOR);
  // Corridor 1
  fill(tiles, 12, 19, 6, 3, TileType.COBBLESTONE);
  // Room 2 — Barracks (12x10)
  fill(tiles, 18, 14, 12, 10, TileType.BUILDING_FLOOR);
  // Corridor 2
  fill(tiles, 30, 18, 5, 3, TileType.COBBLESTONE);
  // Room 3 — Treasure (8x8)
  fill(tiles, 35, 15, 8, 8, TileType.BUILDING_FLOOR);
  // Corridor 3 (down then right)
  fill(tiles, 38, 23, 3, 5, TileType.COBBLESTONE);
  fill(tiles, 38, 28, 5, 3, TileType.COBBLESTONE);
  // Room 4 — Boss Room (12x12)
  fill(tiles, 34, 26, 14, 12, TileType.BUILDING_FLOOR);

  return {
    id: "goblin_warren",
    name: "Goblin Warren",
    width: w,
    height: h,
    tiles,
    spawnX: 6,
    spawnY: 20,
    portals: [], // Exit portal added on boss kill
    mobSpawns: [
      { mobId: "goblin_sentry", x: 8, y: 18, count: 2, wanderRadius: 3 },
      { mobId: "goblin_warrior", x: 24, y: 19, count: 4, wanderRadius: 4 },
      { mobId: "goblin_mage", x: 39, y: 18, count: 3, wanderRadius: 3 },
      { mobId: "goblin_chieftain", x: 41, y: 32, count: 1, wanderRadius: 2 },
    ],
  };
}

function buildCryptOfBones(): ZoneDef {
  const w = 60, h = 50;
  const tiles: TileType[][] = Array.from({ length: h }, () => Array(w).fill(TileType.MOUNTAIN));

  // Room 1 — Entrance (10x10)
  fill(tiles, 2, 2, 10, 10, TileType.COBBLESTONE);
  // Corridor to Room 2
  fill(tiles, 12, 5, 4, 3, TileType.COBBLESTONE);
  // Room 2 — Catacomb (14x12) with pillar obstacles
  fill(tiles, 16, 2, 14, 12, TileType.COBBLESTONE);
  fill(tiles, 20, 5, 2, 2, TileType.MOUNTAIN); // pillar
  fill(tiles, 25, 8, 2, 2, TileType.MOUNTAIN); // pillar
  // Corridor to Room 3
  fill(tiles, 30, 6, 4, 3, TileType.COBBLESTONE);
  // Room 3 — Ritual Chamber (12x12)
  fill(tiles, 34, 2, 12, 12, TileType.COBBLESTONE);
  // Corridor down
  fill(tiles, 39, 14, 3, 8, TileType.COBBLESTONE);
  // Room 4 — Ossuary (10x10)
  fill(tiles, 34, 22, 10, 10, TileType.COBBLESTONE);
  // Corridor down-left
  fill(tiles, 32, 32, 3, 4, TileType.COBBLESTONE);
  fill(tiles, 26, 34, 9, 3, TileType.COBBLESTONE);
  // Room 5 — Throne of the Lich (16x16)
  fill(tiles, 20, 32, 16, 16, TileType.BUILDING_FLOOR);

  return {
    id: "crypt_of_bones",
    name: "Crypt of Bones",
    width: w,
    height: h,
    tiles,
    spawnX: 6,
    spawnY: 7,
    portals: [],
    mobSpawns: [
      { mobId: "skeleton_soldier", x: 7, y: 6, count: 3, wanderRadius: 3 },
      { mobId: "skeleton_soldier", x: 22, y: 7, count: 3, wanderRadius: 4 },
      { mobId: "bone_archer", x: 26, y: 5, count: 2, wanderRadius: 3 },
      { mobId: "dark_cultist", x: 40, y: 7, count: 4, wanderRadius: 4 },
      { mobId: "bone_golem", x: 39, y: 27, count: 3, wanderRadius: 3 },
      { mobId: "lich_king", x: 28, y: 40, count: 1, wanderRadius: 2 },
    ],
  };
}

const BUILDERS: Record<string, () => ZoneDef> = {
  goblin_warren: buildGoblinWarren,
  crypt_of_bones: buildCryptOfBones,
};

export function buildDungeonZone(dungeonId: string): ZoneDef {
  const builder = BUILDERS[dungeonId];
  if (!builder) throw new Error(`No builder for dungeon: ${dungeonId}`);
  return builder();
}
