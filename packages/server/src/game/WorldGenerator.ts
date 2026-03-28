/**
 * Procedural world generator.
 *
 * Generates 32×32 tile chunks on demand using layered simplex noise.
 * Each chunk is deterministic given the world seed + chunk coordinates.
 *
 * Pipeline per chunk:
 *   1. Sample elevation/moisture/temperature noise at each tile
 *   2. Derive biome from noise values
 *   3. Map biome to tile types with detail noise for variation
 *   4. Apply feature placement (trees, rocks, water edges)
 *   5. Generate mob spawn points based on biome
 */

import {
  createNoise2D,
  octaveNoise,
  type Noise2D,
  deriveBiome,
  Biome,
  biomePrimaryTile,
  TileType,
  WORLD_CHUNK_SIZE,
  TERRAIN_SCALES,
  getLandmarksForBiome,
  type LandmarkDef,
  type LandmarkPlacement,
  ISLAND_CHANCE,
  ISLAND_RADIUS_MIN,
  ISLAND_RADIUS_MAX,
  SEA_CREATURES,
} from "@madworld/shared";

export interface GeneratedChunk {
  chunkX: number;
  chunkY: number;
  biome: Biome;           // Dominant biome for this chunk
  tiles: TileType[][];    // 32×32 tile grid [y][x]
  mobSpawns: ChunkMobSpawn[];
  lights: ChunkLight[];
  landmarks: LandmarkPlacement[];
}

export interface ChunkMobSpawn {
  mobId: string;
  x: number; // tile-local (0..31)
  y: number;
  count: number;
  wanderRadius: number;
}

export interface ChunkLight {
  x: number; // tile-local
  y: number;
  radius: number;
  color: number;
  flicker?: boolean;
}

// Biome → mob spawns
const BIOME_MOBS: Partial<Record<Biome, { mobId: string; density: number; wanderRadius: number }[]>> = {
  [Biome.PLAINS]: [
    { mobId: "chicken", density: 0.003, wanderRadius: 4 },
    { mobId: "cow", density: 0.002, wanderRadius: 5 },
  ],
  [Biome.FOREST]: [
    { mobId: "goblin", density: 0.004, wanderRadius: 5 },
    { mobId: "forest_spider", density: 0.002, wanderRadius: 3 },
  ],
  [Biome.DENSE_FOREST]: [
    { mobId: "forest_spider", density: 0.005, wanderRadius: 4 },
    { mobId: "skeleton", density: 0.003, wanderRadius: 5 },
  ],
  [Biome.SWAMP]: [
    { mobId: "swamp_leech", density: 0.004, wanderRadius: 3 },
    { mobId: "bog_toad", density: 0.003, wanderRadius: 4 },
  ],
  [Biome.DESERT]: [
    { mobId: "sand_scorpion", density: 0.003, wanderRadius: 5 },
  ],
  [Biome.MOUNTAINS]: [
    { mobId: "skeleton", density: 0.003, wanderRadius: 4 },
  ],
  [Biome.SAVANNA]: [
    { mobId: "goblin", density: 0.003, wanderRadius: 6 },
  ],
  [Biome.JUNGLE]: [
    { mobId: "forest_spider", density: 0.004, wanderRadius: 4 },
    { mobId: "goblin", density: 0.003, wanderRadius: 5 },
  ],
};

export class WorldGenerator {
  private elevNoise: Noise2D;
  private moistNoise: Noise2D;
  private tempNoise: Noise2D;
  private detailNoise: Noise2D;
  private featureNoise: Noise2D;
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
    // Use different seed offsets for each noise layer so they're independent
    this.elevNoise = createNoise2D(seed);
    this.moistNoise = createNoise2D(seed + 1000);
    this.tempNoise = createNoise2D(seed + 2000);
    this.detailNoise = createNoise2D(seed + 3000);
    this.featureNoise = createNoise2D(seed + 4000);
  }

  /**
   * Generate a single chunk at the given chunk coordinates.
   * Chunk (0,0) starts at world tile (0,0).
   * Chunk (1,0) starts at world tile (32,0), etc.
   */
  generateChunk(chunkX: number, chunkY: number): GeneratedChunk {
    const S = WORLD_CHUNK_SIZE;
    const baseX = chunkX * S;
    const baseY = chunkY * S;

    const tiles: TileType[][] = [];
    const biomeCounts = new Map<Biome, number>();

    // Pass 1: Generate biome + primary tile for each cell
    for (let y = 0; y < S; y++) {
      const row: TileType[] = [];
      for (let x = 0; x < S; x++) {
        const wx = baseX + x;
        const wy = baseY + y;

        const elev = octaveNoise(this.elevNoise, wx, wy, 6, 0.5, 2.0, TERRAIN_SCALES.elevation);
        const moist = octaveNoise(this.moistNoise, wx, wy, 5, 0.5, 2.0, TERRAIN_SCALES.moisture);
        const temp = octaveNoise(this.tempNoise, wx, wy, 4, 0.5, 2.0, TERRAIN_SCALES.temperature);

        const biome = deriveBiome(elev, moist, temp);
        biomeCounts.set(biome, (biomeCounts.get(biome) ?? 0) + 1);

        let tile = biomePrimaryTile(biome);

        // Detail variation within biome
        const detail = this.detailNoise(wx * TERRAIN_SCALES.detail, wy * TERRAIN_SCALES.detail);
        tile = this.applyBiomeDetail(tile, biome, detail, elev);

        row.push(tile);
      }
      tiles.push(row);
    }

    // Determine dominant biome
    let dominantBiome = Biome.PLAINS;
    let maxCount = 0;
    for (const [biome, count] of biomeCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominantBiome = biome;
      }
    }

    // Pass 2: Smooth edges — add beaches between water and land
    this.smoothWaterEdges(tiles);

    // Pass 2b: Generate islands in ocean chunks
    if (dominantBiome === Biome.OCEAN) {
      this.generateIsland(tiles, chunkX, chunkY);
    }

    // Pass 3: Place landmarks (~5% chance per chunk)
    const landmarks = this.placeLandmarks(tiles, dominantBiome, chunkX, chunkY);

    // Pass 4: Generate mob spawns (landmarks add their own mobs too)
    const mobSpawns = this.generateMobSpawns(dominantBiome, tiles, chunkX, chunkY);

    // Add landmark mob spawns
    for (const lp of landmarks) {
      const lDef = getLandmarksForBiome(dominantBiome).find(l => l.id === lp.landmarkId);
      if (!lDef) continue;
      for (const mob of lDef.mobs) {
        mobSpawns.push({
          mobId: mob.mobId,
          x: lp.originX + mob.offsetX,
          y: lp.originY + mob.offsetY,
          count: 1,
          wanderRadius: mob.wanderRadius,
        });
      }
    }

    // Pass 4b: Spawn sea creatures in ocean/coast chunks
    if (dominantBiome === Biome.OCEAN || dominantBiome === Biome.COAST) {
      this.generateSeaCreatures(mobSpawns, dominantBiome, chunkX, chunkY);
    }

    // Pass 5: Generate lights (torches in forest, campfires, etc.)
    const lights = this.generateLights(dominantBiome, tiles, chunkX, chunkY);

    // Add landmark lights
    for (const lp of landmarks) {
      const lDef = getLandmarksForBiome(dominantBiome).find(l => l.id === lp.landmarkId);
      if (!lDef) continue;
      for (const lt of lDef.lights) {
        lights.push({
          x: lp.originX + lt.offsetX,
          y: lp.originY + lt.offsetY,
          radius: lt.radius,
          color: lt.color,
          flicker: lt.flicker,
        });
      }
    }

    return {
      chunkX,
      chunkY,
      biome: dominantBiome,
      tiles,
      mobSpawns,
      lights,
      landmarks,
    };
  }

  /**
   * Apply fine-grained detail variation within a biome.
   * This creates natural-looking variation (patches of dirt in grass, etc.)
   */
  private applyBiomeDetail(tile: TileType, biome: Biome, detail: number, elev: number): TileType {
    switch (biome) {
      case Biome.PLAINS:
        if (detail > 0.5) return TileType.DIRT; // dirt patches
        if (detail > 0.4) return TileType.GRASS;
        return tile;

      case Biome.FOREST:
        if (detail > 0.6) return TileType.FOREST; // dense tree patches
        if (detail < -0.4) return TileType.DIRT;   // forest paths
        return tile;

      case Biome.SWAMP:
        if (detail > 0.3) return TileType.WATER;   // swamp pools
        if (detail < -0.3) return TileType.GRASS;   // dry patches
        return tile;

      case Biome.DESERT:
        if (detail > 0.6) return TileType.DIRT;    // rocky patches
        if (elev > 0.3) return TileType.MOUNTAIN;  // desert mesas
        return tile;

      case Biome.MOUNTAINS:
        if (detail < -0.3) return TileType.DIRT;   // mountain paths
        if (detail > 0.4 && elev < 0.5) return TileType.GRASS; // alpine meadow
        return tile;

      case Biome.COAST:
        if (detail > 0.4) return TileType.GRASS;   // coastal grass
        if (detail < -0.5) return TileType.WATER;  // tidal pools
        return tile;

      case Biome.TUNDRA:
        if (detail > 0.5) return TileType.MOUNTAIN; // rocky outcrops
        if (detail < -0.3) return TileType.GRASS;    // tundra grass
        return tile;

      case Biome.JUNGLE:
        if (detail > 0.4) return TileType.FOREST;  // thick canopy
        if (detail < -0.5) return TileType.WATER;   // jungle streams
        return tile;

      case Biome.SAVANNA:
        if (detail > 0.6) return TileType.GRASS;   // tall grass
        if (detail > 0.4) return TileType.FOREST;  // lone trees
        return tile;

      default:
        return tile;
    }
  }

  /** Add sand tiles between water and land for natural coastlines. */
  private smoothWaterEdges(tiles: TileType[][]): void {
    const S = tiles.length;
    const isWater = (y: number, x: number) =>
      y >= 0 && y < S && x >= 0 && x < S && tiles[y][x] === TileType.WATER;

    const changes: [number, number, TileType][] = [];

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (tiles[y][x] === TileType.WATER) continue;
        if (tiles[y][x] === TileType.SAND) continue;

        // Check if adjacent to water
        const adj = isWater(y - 1, x) || isWater(y + 1, x) ||
                    isWater(y, x - 1) || isWater(y, x + 1);
        if (adj) {
          changes.push([y, x, TileType.SAND]);
        }
      }
    }

    for (const [y, x, tile] of changes) {
      tiles[y][x] = tile;
    }
  }

  /** Generate mob spawn points based on biome and walkable tiles. */
  private generateMobSpawns(
    biome: Biome,
    tiles: TileType[][],
    chunkX: number,
    chunkY: number,
  ): ChunkMobSpawn[] {
    const defs = BIOME_MOBS[biome];
    if (!defs) return [];

    const S = WORLD_CHUNK_SIZE;
    const spawns: ChunkMobSpawn[] = [];

    // Use deterministic placement based on chunk position
    const rng = this.makeChunkRng(chunkX, chunkY);

    for (const def of defs) {
      const count = Math.floor(S * S * def.density);
      for (let i = 0; i < count; i++) {
        const x = Math.floor(rng() * S);
        const y = Math.floor(rng() * S);

        // Only spawn on walkable tiles
        const tile = tiles[y]?.[x];
        if (tile === undefined) continue;
        if (tile === TileType.WATER || tile === TileType.MOUNTAIN ||
            tile === TileType.FOREST || tile === TileType.FENCE) continue;

        spawns.push({
          mobId: def.mobId,
          x,
          y,
          count: 1,
          wanderRadius: def.wanderRadius,
        });
      }
    }

    return spawns;
  }

  /** Generate light sources (campfires, torches) in appropriate biomes. */
  private generateLights(
    biome: Biome,
    tiles: TileType[][],
    chunkX: number,
    chunkY: number,
  ): ChunkLight[] {
    // Only some biomes have natural light sources
    if (biome === Biome.OCEAN || biome === Biome.DESERT || biome === Biome.SNOW_PEAKS) return [];

    const rng = this.makeChunkRng(chunkX + 9999, chunkY + 9999);
    const lights: ChunkLight[] = [];
    const S = WORLD_CHUNK_SIZE;

    // Sparse campfire-like lights
    const lightCount = biome === Biome.FOREST || biome === Biome.DENSE_FOREST ? 2 : 1;
    for (let i = 0; i < lightCount; i++) {
      const x = Math.floor(rng() * S);
      const y = Math.floor(rng() * S);
      const tile = tiles[y]?.[x];
      if (tile === TileType.WATER || tile === TileType.MOUNTAIN || tile === TileType.FOREST) continue;

      lights.push({
        x,
        y,
        radius: 4 + Math.floor(rng() * 3),
        color: biome === Biome.SWAMP ? 0x44ff88 : 0xff8844,
        flicker: true,
      });
    }

    return lights;
  }

  /** Generate a small island in an ocean chunk. */
  private generateIsland(tiles: TileType[][], chunkX: number, chunkY: number): void {
    const rng = this.makeChunkRng(chunkX + 55555, chunkY + 55555);
    if (rng() > ISLAND_CHANCE) return; // 8% chance

    const S = WORLD_CHUNK_SIZE;
    const radius = ISLAND_RADIUS_MIN + Math.floor(rng() * (ISLAND_RADIUS_MAX - ISLAND_RADIUS_MIN + 1));
    const cx = Math.floor(S * 0.3 + rng() * S * 0.4); // Keep island away from chunk edges
    const cy = Math.floor(S * 0.3 + rng() * S * 0.4);

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radius - 1) {
          // Island interior — grass with random detail
          tiles[y][x] = rng() < 0.15 ? TileType.DIRT : TileType.GRASS;
        } else if (dist <= radius) {
          // Beach ring
          tiles[y][x] = TileType.SAND;
        }
      }
    }
  }

  /** Spawn sea creatures in ocean/coast chunks. */
  private generateSeaCreatures(
    spawns: ChunkMobSpawn[],
    biome: Biome,
    chunkX: number,
    chunkY: number,
  ): void {
    const S = WORLD_CHUNK_SIZE;
    const rng = this.makeChunkRng(chunkX + 88888, chunkY + 88888);
    const isDeep = biome === Biome.OCEAN;

    for (const creature of SEA_CREATURES) {
      if (creature.deepOnly && !isDeep) continue;
      const count = Math.floor(S * S * creature.density);
      for (let i = 0; i < count; i++) {
        const x = Math.floor(rng() * S);
        const y = Math.floor(rng() * S);
        spawns.push({
          mobId: creature.mobId,
          x,
          y,
          count: 1,
          wanderRadius: 6,
        });
      }
    }
  }

  /**
   * Attempt to place a landmark in this chunk.
   * ~5% of chunks get a landmark. The landmark must fit within the chunk
   * and land on mostly walkable terrain.
   */
  private placeLandmarks(
    tiles: TileType[][],
    biome: Biome,
    chunkX: number,
    chunkY: number,
  ): LandmarkPlacement[] {
    const rng = this.makeChunkRng(chunkX + 77777, chunkY + 77777);
    if (rng() > 0.05) return []; // 5% chance

    const candidates = getLandmarksForBiome(biome);
    if (candidates.length === 0) return [];

    const landmark = candidates[Math.floor(rng() * candidates.length)];
    const S = WORLD_CHUNK_SIZE;

    // Try a few random positions to find one where the landmark fits
    for (let attempt = 0; attempt < 8; attempt++) {
      const ox = Math.floor(rng() * (S - landmark.width));
      const oy = Math.floor(rng() * (S - landmark.height));

      if (this.canPlaceLandmark(tiles, landmark, ox, oy)) {
        this.stampLandmark(tiles, landmark, ox, oy);
        return [{ landmarkId: landmark.id, originX: ox, originY: oy }];
      }
    }

    return []; // Couldn't find a valid placement
  }

  /** Check if a landmark footprint fits at the given offset without colliding with water/mountains. */
  private canPlaceLandmark(
    tiles: TileType[][],
    landmark: LandmarkDef,
    ox: number,
    oy: number,
  ): boolean {
    let walkableCount = 0;
    const total = landmark.width * landmark.height;

    for (let y = 0; y < landmark.height; y++) {
      for (let x = 0; x < landmark.width; x++) {
        const landmarkTile = landmark.tiles[y]?.[x];
        if (landmarkTile === null) continue; // null = keep terrain, doesn't matter

        const existing = tiles[oy + y]?.[ox + x];
        if (existing === undefined) return false; // Out of bounds

        // Count how much of the footprint is walkable terrain
        if (existing !== TileType.WATER && existing !== TileType.MOUNTAIN) {
          walkableCount++;
        }
      }
    }

    // At least 60% of the footprint should be on walkable terrain
    return walkableCount / total >= 0.6;
  }

  /** Stamp a landmark's tile layout onto the chunk grid. */
  private stampLandmark(
    tiles: TileType[][],
    landmark: LandmarkDef,
    ox: number,
    oy: number,
  ): void {
    for (let y = 0; y < landmark.height; y++) {
      for (let x = 0; x < landmark.width; x++) {
        const landmarkTile = landmark.tiles[y]?.[x];
        if (landmarkTile === null) continue; // Keep underlying terrain
        tiles[oy + y][ox + x] = landmarkTile;
      }
    }
  }

  /** Simple seeded RNG for deterministic per-chunk placement. */
  private makeChunkRng(cx: number, cy: number): () => number {
    let s = ((cx * 73856093) ^ (cy * 19349663) ^ (this.seed * 83492791)) >>> 0;
    if (s === 0) s = 1;
    return () => {
      s ^= s << 13;
      s ^= s >> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
  }
}
