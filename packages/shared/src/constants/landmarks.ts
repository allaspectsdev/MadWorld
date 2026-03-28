/**
 * Procedural landmark definitions.
 *
 * Landmarks are rare structures placed during world generation (~5% per chunk).
 * Each has a tile footprint stamped onto the terrain, mob spawns, loot, and
 * optional interactions. First discovery per player grants major XP.
 */

import { TileType } from "../types/map.js";
import { Biome } from "../biome.js";

export interface LandmarkDef {
  id: string;
  name: string;
  /** Width in tiles. */
  width: number;
  /** Height in tiles. */
  height: number;
  /** Tile layout [y][x]. Null entries keep the underlying terrain. */
  tiles: (TileType | null)[][];
  /** Biomes where this landmark can appear. */
  biomes: Biome[];
  /** Mob spawns relative to landmark origin. */
  mobs: { mobId: string; offsetX: number; offsetY: number; wanderRadius: number }[];
  /** Light sources relative to landmark origin. */
  lights: { offsetX: number; offsetY: number; radius: number; color: number; flicker?: boolean }[];
  /** XP granted on first discovery. */
  discoveryXp: number;
  /** Optional interaction at a specific tile offset. */
  interaction?: {
    offsetX: number;
    offsetY: number;
    type: "shrine" | "chest" | "buff" | "npc";
    /** For shrines: HP restored. For buffs: effect ID. */
    value?: string | number;
  };
}

/** Placement result stored in chunk data. */
export interface LandmarkPlacement {
  landmarkId: string;
  /** Tile offset within the chunk (top-left corner of the landmark). */
  originX: number;
  originY: number;
}

// ---- Helper to build tile grids concisely ----

const _ = null;                    // Keep terrain
const G = TileType.GRASS;
const D = TileType.DIRT;
const C = TileType.COBBLESTONE;
const S = TileType.SAND;
const W = TileType.WATER;
const M = TileType.MOUNTAIN;
const F = TileType.FOREST;
const B = TileType.BUILDING_FLOOR;
const E = TileType.FENCE;          // Fence / wall

// ---- Landmark Definitions ----

export const LANDMARKS: LandmarkDef[] = [
  // --- Abandoned Mine (Mountains) ---
  {
    id: "abandoned_mine",
    name: "Abandoned Mine",
    width: 8,
    height: 8,
    tiles: [
      [M, M, M, M, M, M, M, M],
      [M, D, D, D, D, D, D, M],
      [M, D, C, C, C, C, D, M],
      [M, D, C, B, B, C, D, M],
      [M, D, C, B, B, C, D, M],
      [M, D, C, C, C, C, D, M],
      [M, D, D, D, D, D, D, M],
      [M, M, M, D, D, M, M, M],
    ],
    biomes: [Biome.MOUNTAINS, Biome.SNOW_PEAKS],
    mobs: [
      { mobId: "skeleton", offsetX: 3, offsetY: 3, wanderRadius: 2 },
      { mobId: "skeleton", offsetX: 5, offsetY: 4, wanderRadius: 2 },
      { mobId: "skeleton", offsetX: 4, offsetY: 5, wanderRadius: 2 },
    ],
    lights: [
      { offsetX: 3, offsetY: 3, radius: 4, color: 0xff6622, flicker: true },
      { offsetX: 5, offsetY: 5, radius: 3, color: 0xff6622, flicker: true },
    ],
    discoveryXp: 150,
    interaction: { offsetX: 4, offsetY: 3, type: "chest" },
  },

  // --- Ruined Tower (Plains/Forest) ---
  {
    id: "ruined_tower",
    name: "Ruined Tower",
    width: 6,
    height: 6,
    tiles: [
      [_, M, M, M, M, _],
      [M, C, C, C, C, M],
      [M, C, B, B, C, M],
      [M, C, B, B, C, M],
      [M, C, C, C, C, M],
      [_, M, D, D, M, _],
    ],
    biomes: [Biome.PLAINS, Biome.FOREST],
    mobs: [
      { mobId: "goblin", offsetX: 2, offsetY: 2, wanderRadius: 2 },
      { mobId: "goblin", offsetX: 4, offsetY: 3, wanderRadius: 2 },
      { mobId: "skeleton", offsetX: 3, offsetY: 3, wanderRadius: 1 },
    ],
    lights: [
      { offsetX: 3, offsetY: 2, radius: 5, color: 0x8888ff, flicker: false },
    ],
    discoveryXp: 120,
    interaction: { offsetX: 3, offsetY: 2, type: "chest" },
  },

  // --- Fairy Ring (Dense Forest/Jungle) ---
  {
    id: "fairy_ring",
    name: "Fairy Ring",
    width: 4,
    height: 4,
    tiles: [
      [_, G, G, _],
      [G, G, G, G],
      [G, G, G, G],
      [_, G, G, _],
    ],
    biomes: [Biome.DENSE_FOREST, Biome.JUNGLE, Biome.FOREST],
    mobs: [],
    lights: [
      { offsetX: 2, offsetY: 2, radius: 6, color: 0x88ffaa, flicker: true },
      { offsetX: 1, offsetY: 1, radius: 3, color: 0xaaffcc, flicker: true },
    ],
    discoveryXp: 100,
    interaction: { offsetX: 2, offsetY: 2, type: "buff", value: "fairy_blessing" },
  },

  // --- Shipwreck (Coast) ---
  {
    id: "shipwreck",
    name: "Shipwreck",
    width: 10,
    height: 6,
    tiles: [
      [W, W, S, B, B, B, B, S, W, W],
      [W, S, B, B, B, B, B, B, S, W],
      [S, S, B, B, B, B, B, B, S, S],
      [S, B, B, B, B, B, B, B, B, S],
      [S, S, S, B, B, B, B, S, S, S],
      [W, W, S, S, S, S, S, S, W, W],
    ],
    biomes: [Biome.COAST],
    mobs: [
      { mobId: "skeleton", offsetX: 4, offsetY: 2, wanderRadius: 3 },
      { mobId: "skeleton", offsetX: 6, offsetY: 3, wanderRadius: 3 },
    ],
    lights: [
      { offsetX: 5, offsetY: 2, radius: 4, color: 0x44aaff, flicker: false },
    ],
    discoveryXp: 180,
    interaction: { offsetX: 5, offsetY: 3, type: "chest" },
  },

  // --- Ancient Shrine (any biome) ---
  {
    id: "ancient_shrine",
    name: "Ancient Shrine",
    width: 3,
    height: 3,
    tiles: [
      [C, C, C],
      [C, B, C],
      [C, D, C],
    ],
    biomes: [
      Biome.PLAINS, Biome.FOREST, Biome.DENSE_FOREST, Biome.SWAMP,
      Biome.DESERT, Biome.MOUNTAINS, Biome.TUNDRA, Biome.JUNGLE,
      Biome.SAVANNA, Biome.COAST,
    ],
    mobs: [],
    lights: [
      { offsetX: 1, offsetY: 1, radius: 5, color: 0xffd700, flicker: true },
    ],
    discoveryXp: 80,
    interaction: { offsetX: 1, offsetY: 1, type: "shrine", value: 999 },
  },

  // --- Bandit Camp (Savanna/Plains) ---
  {
    id: "bandit_camp",
    name: "Bandit Camp",
    width: 12,
    height: 12,
    tiles: [
      [_, _, _, E, E, E, E, E, E, _, _, _],
      [_, _, E, D, D, D, D, D, D, E, _, _],
      [_, E, D, D, D, D, D, D, D, D, E, _],
      [E, D, D, D, B, B, B, D, D, D, D, E],
      [E, D, D, B, B, B, B, B, D, D, D, E],
      [E, D, D, B, B, B, B, B, D, D, D, E],
      [E, D, D, B, B, B, B, B, D, D, D, E],
      [E, D, D, D, B, B, B, D, D, D, D, E],
      [_, E, D, D, D, D, D, D, D, D, E, _],
      [_, _, E, D, D, D, D, D, D, E, _, _],
      [_, _, _, E, E, D, D, E, E, _, _, _],
      [_, _, _, _, _, D, D, _, _, _, _, _],
    ],
    biomes: [Biome.SAVANNA, Biome.PLAINS],
    mobs: [
      { mobId: "goblin", offsetX: 3, offsetY: 3, wanderRadius: 3 },
      { mobId: "goblin", offsetX: 8, offsetY: 3, wanderRadius: 3 },
      { mobId: "goblin", offsetX: 3, offsetY: 8, wanderRadius: 3 },
      { mobId: "goblin", offsetX: 8, offsetY: 8, wanderRadius: 3 },
      { mobId: "skeleton", offsetX: 6, offsetY: 5, wanderRadius: 2 },
      { mobId: "skeleton", offsetX: 5, offsetY: 6, wanderRadius: 2 },
    ],
    lights: [
      { offsetX: 5, offsetY: 5, radius: 6, color: 0xff8844, flicker: true },
      { offsetX: 3, offsetY: 3, radius: 3, color: 0xff6622, flicker: true },
      { offsetX: 8, offsetY: 8, radius: 3, color: 0xff6622, flicker: true },
    ],
    discoveryXp: 250,
    interaction: { offsetX: 6, offsetY: 5, type: "chest" },
  },
];

/** Look up a landmark by ID. */
export function getLandmark(id: string): LandmarkDef | undefined {
  return LANDMARKS.find((l) => l.id === id);
}

/** Get all landmarks that can spawn in a given biome. */
export function getLandmarksForBiome(biome: Biome): LandmarkDef[] {
  return LANDMARKS.filter((l) => l.biomes.includes(biome));
}
