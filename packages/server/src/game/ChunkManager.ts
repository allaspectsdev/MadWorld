/**
 * ChunkManager — on-demand chunk generation, caching, and persistence.
 *
 * Manages the procedural world:
 *   - Generates chunks on first access using WorldGenerator
 *   - Caches generated chunks in memory (LRU-style)
 *   - Persists chunks to DB after first generation
 *   - Loads previously-generated chunks from DB
 *   - Tracks which chunks each player has discovered
 */

import { WORLD_CHUNK_SIZE, DEFAULT_WORLD_SEED } from "@madworld/shared";
import { WorldGenerator, type GeneratedChunk } from "./WorldGenerator.js";
import { db } from "../db/index.js";
import { worldChunks, playerDiscovery } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/** Maximum chunks to keep in memory cache. */
const MAX_CACHED_CHUNKS = 512;

export class ChunkManager {
  private generator: WorldGenerator;
  private cache = new Map<string, GeneratedChunk>();
  private cacheOrder: string[] = []; // LRU tracking
  readonly worldSeed: number;

  /** Per-player discovered chunk sets (playerId → Set<"cx,cy">). */
  private discoveries = new Map<number, Set<string>>();

  constructor(seed = DEFAULT_WORLD_SEED) {
    this.worldSeed = seed;
    this.generator = new WorldGenerator(seed);
  }

  /**
   * Get a chunk, generating it if needed.
   * This is the main entry point — always returns a valid chunk.
   */
  async getChunk(cx: number, cy: number): Promise<GeneratedChunk> {
    const key = chunkKey(cx, cy);

    // 1. Check memory cache
    const cached = this.cache.get(key);
    if (cached) {
      this.touchCache(key);
      return cached;
    }

    // 2. Check DB
    const dbChunk = await this.loadFromDb(cx, cy);
    if (dbChunk) {
      this.putCache(key, dbChunk);
      return dbChunk;
    }

    // 3. Generate new chunk
    const generated = this.generator.generateChunk(cx, cy);
    this.putCache(key, generated);

    // Persist to DB (fire-and-forget, don't block the caller)
    this.persistToDb(generated).catch((err) => {
      console.error(`[ChunkManager] Failed to persist chunk ${key}:`, err);
    });

    return generated;
  }

  /**
   * Get a chunk synchronously if it's in cache.
   * Returns null if not cached (caller should use getChunk() instead).
   */
  getChunkSync(cx: number, cy: number): GeneratedChunk | null {
    const key = chunkKey(cx, cy);
    const cached = this.cache.get(key);
    if (cached) {
      this.touchCache(key);
      return cached;
    }
    return null;
  }

  /**
   * Pre-generate and cache chunks around a position.
   * Call this when a player connects to warm the cache.
   */
  async warmArea(worldX: number, worldY: number, radius = 3): Promise<void> {
    const cx = Math.floor(worldX / WORLD_CHUNK_SIZE);
    const cy = Math.floor(worldY / WORLD_CHUNK_SIZE);

    const promises: Promise<GeneratedChunk>[] = [];
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        promises.push(this.getChunk(cx + dx, cy + dy));
      }
    }
    await Promise.all(promises);
  }

  // ---- Discovery tracking ----

  /**
   * Load a player's discovered chunks from DB.
   * Call once when player connects.
   */
  async loadPlayerDiscoveries(playerId: number): Promise<Set<string>> {
    const rows = await db
      .select({ chunkX: playerDiscovery.chunkX, chunkY: playerDiscovery.chunkY })
      .from(playerDiscovery)
      .where(eq(playerDiscovery.playerId, playerId));

    const set = new Set<string>();
    for (const row of rows) {
      set.add(chunkKey(row.chunkX, row.chunkY));
    }
    this.discoveries.set(playerId, set);
    return set;
  }

  /**
   * Check if a player has discovered a chunk.
   */
  hasDiscovered(playerId: number, cx: number, cy: number): boolean {
    return this.discoveries.get(playerId)?.has(chunkKey(cx, cy)) ?? false;
  }

  /**
   * Get all discovered chunk keys for a player.
   */
  getDiscoveries(playerId: number): Set<string> {
    return this.discoveries.get(playerId) ?? new Set();
  }

  /**
   * Mark chunks as discovered for a player.
   * Returns the list of *newly* discovered chunk keys.
   */
  async discoverChunks(
    playerId: number,
    chunks: Array<{ cx: number; cy: number }>,
  ): Promise<string[]> {
    let set = this.discoveries.get(playerId);
    if (!set) {
      set = new Set();
      this.discoveries.set(playerId, set);
    }

    const newDiscoveries: string[] = [];
    const dbInserts: Array<{ playerId: number; chunkX: number; chunkY: number }> = [];

    for (const { cx, cy } of chunks) {
      const key = chunkKey(cx, cy);
      if (!set.has(key)) {
        set.add(key);
        newDiscoveries.push(key);
        dbInserts.push({ playerId, chunkX: cx, chunkY: cy });
      }
    }

    // Persist new discoveries to DB
    if (dbInserts.length > 0) {
      db.insert(playerDiscovery)
        .values(dbInserts)
        .onConflictDoNothing()
        .execute()
        .catch((err) => {
          console.error(`[ChunkManager] Failed to persist discoveries:`, err);
        });
    }

    return newDiscoveries;
  }

  /**
   * Clean up when a player disconnects.
   */
  removePlayer(playerId: number): void {
    this.discoveries.delete(playerId);
  }

  // ---- Cache management ----

  private putCache(key: string, chunk: GeneratedChunk): void {
    this.cache.set(key, chunk);
    this.cacheOrder.push(key);

    // Evict oldest if over limit
    while (this.cache.size > MAX_CACHED_CHUNKS) {
      const oldest = this.cacheOrder.shift();
      if (oldest) this.cache.delete(oldest);
    }
  }

  private touchCache(key: string): void {
    const idx = this.cacheOrder.indexOf(key);
    if (idx !== -1) {
      this.cacheOrder.splice(idx, 1);
      this.cacheOrder.push(key);
    }
  }

  // ---- DB operations ----

  private async loadFromDb(cx: number, cy: number): Promise<GeneratedChunk | null> {
    const rows = await db
      .select()
      .from(worldChunks)
      .where(
        and(
          eq(worldChunks.worldSeed, this.worldSeed),
          eq(worldChunks.chunkX, cx),
          eq(worldChunks.chunkY, cy),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      chunkX: row.chunkX,
      chunkY: row.chunkY,
      biome: row.biome as any,
      tiles: row.tileData as any,
      mobSpawns: row.mobSpawns as any,
      lights: row.lights as any,
      landmarks: (row as any).landmarks ?? [],
    };
  }

  private async persistToDb(chunk: GeneratedChunk): Promise<void> {
    await db
      .insert(worldChunks)
      .values({
        worldSeed: this.worldSeed,
        chunkX: chunk.chunkX,
        chunkY: chunk.chunkY,
        biome: chunk.biome,
        tileData: chunk.tiles,
        mobSpawns: chunk.mobSpawns,
        lights: chunk.lights,
        landmarks: chunk.landmarks,
      })
      .onConflictDoNothing();
  }
}
