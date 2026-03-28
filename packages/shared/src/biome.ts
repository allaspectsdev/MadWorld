/**
 * Biome derivation from noise layers.
 *
 * Biome is determined by three noise values:
 *   elevation  (-1..1) → vertical height
 *   moisture   (-1..1) → wetness
 *   temperature(-1..1) → heat (latitude-influenced)
 *
 * The combination produces one of the biome types below.
 */

import { TileType } from "./types/map.js";

// ---- Biome IDs ----

export enum Biome {
  OCEAN = "ocean",
  COAST = "coast",
  PLAINS = "plains",
  FOREST = "forest",
  DENSE_FOREST = "dense_forest",
  SWAMP = "swamp",
  DESERT = "desert",
  MOUNTAINS = "mountains",
  SNOW_PEAKS = "snow_peaks",
  TUNDRA = "tundra",
  JUNGLE = "jungle",
  SAVANNA = "savanna",
}

// ---- Biome derivation ----

/**
 * Derive biome from noise values.
 * All inputs should be in [-1, 1] range.
 */
export function deriveBiome(
  elevation: number,
  moisture: number,
  temperature: number,
): Biome {
  // Deep water
  if (elevation < -0.3) return Biome.OCEAN;

  // Shallow water / coast
  if (elevation < -0.1) return Biome.COAST;

  // High elevation → mountains or snow
  if (elevation > 0.6) {
    if (temperature < -0.2) return Biome.SNOW_PEAKS;
    return Biome.MOUNTAINS;
  }

  // Mid-high elevation + cold → tundra
  if (elevation > 0.35 && temperature < -0.1) return Biome.TUNDRA;

  // Low elevation + wet → swamp
  if (elevation < 0.1 && moisture > 0.3) return Biome.SWAMP;

  // Hot + dry → desert
  if (temperature > 0.3 && moisture < -0.1) return Biome.DESERT;

  // Hot + wet → jungle
  if (temperature > 0.2 && moisture > 0.2) return Biome.JUNGLE;

  // Hot + moderate → savanna
  if (temperature > 0.2 && moisture < 0.2) return Biome.SAVANNA;

  // Moderate + wet → forest
  if (moisture > 0.1) {
    if (moisture > 0.4) return Biome.DENSE_FOREST;
    return Biome.FOREST;
  }

  // Default — plains/grassland
  return Biome.PLAINS;
}

// ---- Biome → tile type mapping ----

/** Primary ground tile for a biome. */
export function biomePrimaryTile(biome: Biome): TileType {
  switch (biome) {
    case Biome.OCEAN: return TileType.WATER;
    case Biome.COAST: return TileType.SAND;
    case Biome.PLAINS: return TileType.GRASS;
    case Biome.FOREST: return TileType.GRASS;
    case Biome.DENSE_FOREST: return TileType.FOREST;
    case Biome.SWAMP: return TileType.DIRT;
    case Biome.DESERT: return TileType.SAND;
    case Biome.MOUNTAINS: return TileType.MOUNTAIN;
    case Biome.SNOW_PEAKS: return TileType.MOUNTAIN;
    case Biome.TUNDRA: return TileType.DIRT;
    case Biome.JUNGLE: return TileType.GRASS;
    case Biome.SAVANNA: return TileType.DIRT;
  }
}

/** Biome display color for minimap / LOD far rendering (RGB hex). */
export function biomeColor(biome: Biome): number {
  switch (biome) {
    case Biome.OCEAN: return 0x1a4a7a;
    case Biome.COAST: return 0xc2b280;
    case Biome.PLAINS: return 0x7ab648;
    case Biome.FOREST: return 0x3a7a3a;
    case Biome.DENSE_FOREST: return 0x1a4a1a;
    case Biome.SWAMP: return 0x4a6a3a;
    case Biome.DESERT: return 0xd4b96a;
    case Biome.MOUNTAINS: return 0x8a8a8a;
    case Biome.SNOW_PEAKS: return 0xe8e8f0;
    case Biome.TUNDRA: return 0x9ab0a0;
    case Biome.JUNGLE: return 0x2a6a2a;
    case Biome.SAVANNA: return 0xb8a848;
  }
}

// ---- World chunk constants ----

/** Tiles per world chunk (one axis). */
export const WORLD_CHUNK_SIZE = 32;

/** Default world seed for development. */
export const DEFAULT_WORLD_SEED = 42;

/** Noise scale factors for terrain generation. */
export const TERRAIN_SCALES = {
  elevation: 0.008,   // Large-scale landmass shapes
  moisture: 0.012,    // Medium-scale wetness variation
  temperature: 0.005, // Very large-scale climate zones
  detail: 0.05,       // Fine-grained tile variation within biome
} as const;
