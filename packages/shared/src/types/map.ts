export enum TileType {
  GRASS = 0,
  DIRT = 1,
  COBBLESTONE = 2,
  WATER = 3,
  SAND = 4,
  FOREST = 5,
  MOUNTAIN = 6,
  BRIDGE = 7,
  BUILDING_FLOOR = 8,
  PORTAL = 9,
  DUNGEON_PORTAL = 10,
}

export const WALKABLE_TILES = new Set<TileType>([
  TileType.GRASS,
  TileType.DIRT,
  TileType.COBBLESTONE,
  TileType.SAND,
  TileType.BRIDGE,
  TileType.BUILDING_FLOOR,
  TileType.PORTAL,
  TileType.DUNGEON_PORTAL,
]);

export interface LightDef {
  x: number;
  y: number;
  radius: number;
  color: number;
  flicker?: boolean;
}

export interface ZoneDef {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: TileType[][];
  spawnX: number;
  spawnY: number;
  portals: Portal[];
  mobSpawns: MobSpawn[];
  lights?: LightDef[];
}

export interface Portal {
  x: number;
  y: number;
  targetZoneId: string;
  targetX: number;
  targetY: number;
  dungeonId?: string;
}

export interface MobSpawn {
  mobId: string;
  x: number;
  y: number;
  count: number;
  wanderRadius: number;
}

export interface ChunkCoord {
  cx: number;
  cy: number;
}
