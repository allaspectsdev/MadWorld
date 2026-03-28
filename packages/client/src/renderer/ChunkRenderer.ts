/**
 * ChunkRenderer — manages rendering of multiple procedural chunks with LOD.
 *
 * Two-pass rendering approach:
 *   - Near chunks (within LOD_NEAR_RANGE): Full tile sprites via TilemapRenderer
 *   - Far chunks (within LOD_FAR_RANGE): Simplified biome-colored blocks
 *
 * Chunks are loaded/unloaded as the camera moves. The server sends
 * S_CHUNK_DATA as the player discovers new areas.
 */

import { Container, Graphics } from "pixi.js";
import {
  cartToIso,
  isoDepth,
  isoViewBounds,
  biomeColor,
  type Biome,
  type TileType,
  WORLD_CHUNK_SIZE,
  ISO_HALF_W,
  ISO_HALF_H,
} from "@madworld/shared";
import { TilemapRenderer } from "./TilemapRenderer.js";
import { DecorationRenderer } from "./DecorationRenderer.js";

interface ChunkData {
  chunkX: number;
  chunkY: number;
  biome: string;
  tiles: TileType[][];
  lights?: any[];
}

interface LoadedChunk {
  chunkX: number;
  chunkY: number;
  biome: string;
  tiles: TileType[][];
  /** Near-detail renderer (lazily created). */
  tilemap: TilemapRenderer | null;
  decorations: DecorationRenderer | null;
  /** Far-LOD simplified graphics. */
  farGfx: Graphics | null;
  /** Whether this chunk is currently in near range. */
  isNear: boolean;
}

/** Chunks within this range (in chunks) get full detail tiles. */
const LOD_NEAR_RANGE = 2;

/** Chunks within this range get simplified biome coloring. */
const LOD_FAR_RANGE = 5;

function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export class ChunkRenderer {
  /** Container for near-detail chunks. */
  readonly nearContainer = new Container();
  /** Container for far-LOD chunks (rendered behind near). */
  readonly farContainer = new Container();

  private chunks = new Map<string, LoadedChunk>();
  private playerChunkX = 0;
  private playerChunkY = 0;

  constructor() {
    this.nearContainer.sortableChildren = true;
    this.farContainer.sortableChildren = true;
  }

  /** Add a chunk received from the server. */
  addChunk(data: ChunkData): void {
    const key = chunkKey(data.chunkX, data.chunkY);

    // If already loaded, skip
    if (this.chunks.has(key)) return;

    const chunk: LoadedChunk = {
      chunkX: data.chunkX,
      chunkY: data.chunkY,
      biome: data.biome,
      tiles: data.tiles,
      tilemap: null,
      decorations: null,
      farGfx: null,
      isNear: false,
    };

    this.chunks.set(key, chunk);

    // Immediately create the appropriate representation
    this.updateChunkLOD(chunk);
  }

  /** Remove a chunk (e.g., server tells us to unload). */
  removeChunk(cx: number, cy: number): void {
    const key = chunkKey(cx, cy);
    const chunk = this.chunks.get(key);
    if (!chunk) return;

    this.destroyChunkRenderers(chunk);
    this.chunks.delete(key);
  }

  /** Update which chunks are near/far based on player position. */
  setPlayerPosition(worldX: number, worldY: number): void {
    const cx = Math.floor(worldX / WORLD_CHUNK_SIZE);
    const cy = Math.floor(worldY / WORLD_CHUNK_SIZE);

    if (cx === this.playerChunkX && cy === this.playerChunkY) return;
    this.playerChunkX = cx;
    this.playerChunkY = cy;

    // Update LOD for all loaded chunks
    for (const chunk of this.chunks.values()) {
      this.updateChunkLOD(chunk);
    }

    // Unload chunks that are too far away
    for (const [key, chunk] of this.chunks) {
      const dx = Math.abs(chunk.chunkX - cx);
      const dy = Math.abs(chunk.chunkY - cy);
      if (dx > LOD_FAR_RANGE + 1 || dy > LOD_FAR_RANGE + 1) {
        this.destroyChunkRenderers(chunk);
        this.chunks.delete(key);
      }
    }
  }

  /** Cull invisible tiles within near-detail chunks. */
  cullViewport(left: number, top: number, right: number, bottom: number): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.tilemap) {
        chunk.tilemap.cullViewport(left, top, right, bottom);
      }
    }
  }

  /** Update animated tiles in near chunks. */
  update(dt: number): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.tilemap && chunk.isNear) {
        chunk.tilemap.update(dt);
      }
    }
  }

  /** Clear all chunks (zone change, etc). */
  clear(): void {
    for (const chunk of this.chunks.values()) {
      this.destroyChunkRenderers(chunk);
    }
    this.chunks.clear();
  }

  /** Get the tile type at a world position across all loaded chunks. */
  getTileAt(worldX: number, worldY: number): TileType | null {
    const cx = Math.floor(worldX / WORLD_CHUNK_SIZE);
    const cy = Math.floor(worldY / WORLD_CHUNK_SIZE);
    const key = chunkKey(cx, cy);
    const chunk = this.chunks.get(key);
    if (!chunk) return null;

    const localX = Math.floor(worldX) - cx * WORLD_CHUNK_SIZE;
    const localY = Math.floor(worldY) - cy * WORLD_CHUNK_SIZE;
    return chunk.tiles[localY]?.[localX] ?? null;
  }

  /** Get combined tile grid for pathfinding within a region. */
  getTilesInArea(minX: number, minY: number, maxX: number, maxY: number): (TileType | null)[][] {
    const rows: (TileType | null)[][] = [];
    for (let y = minY; y <= maxY; y++) {
      const row: (TileType | null)[] = [];
      for (let x = minX; x <= maxX; x++) {
        row.push(this.getTileAt(x, y));
      }
      rows.push(row);
    }
    return rows;
  }

  // ---- LOD management ----

  private updateChunkLOD(chunk: LoadedChunk): void {
    const dx = Math.abs(chunk.chunkX - this.playerChunkX);
    const dy = Math.abs(chunk.chunkY - this.playerChunkY);
    const dist = Math.max(dx, dy);

    const shouldBeNear = dist <= LOD_NEAR_RANGE;
    const shouldBeFar = dist > LOD_NEAR_RANGE && dist <= LOD_FAR_RANGE;
    const shouldBeHidden = dist > LOD_FAR_RANGE;

    if (shouldBeHidden) {
      this.destroyChunkRenderers(chunk);
      return;
    }

    if (shouldBeNear && !chunk.isNear) {
      // Switch to near-detail
      this.destroyFarRenderer(chunk);
      this.createNearRenderer(chunk);
      chunk.isNear = true;
    } else if (shouldBeFar && chunk.isNear) {
      // Switch to far-LOD
      this.destroyNearRenderer(chunk);
      this.createFarRenderer(chunk);
      chunk.isNear = false;
    } else if (shouldBeFar && !chunk.farGfx) {
      // Initialize far renderer
      this.createFarRenderer(chunk);
      chunk.isNear = false;
    } else if (shouldBeNear && !chunk.tilemap) {
      // Initialize near renderer
      this.createNearRenderer(chunk);
      chunk.isNear = true;
    }
  }

  private createNearRenderer(chunk: LoadedChunk): void {
    const tilemap = new TilemapRenderer();
    tilemap.setTiles(chunk.tiles);

    // Offset the tilemap container to the chunk's world position
    const baseX = chunk.chunkX * WORLD_CHUNK_SIZE;
    const baseY = chunk.chunkY * WORLD_CHUNK_SIZE;
    const iso = cartToIso(baseX, baseY);
    // TilemapRenderer positions tiles relative to its container,
    // but individual tiles use cartToIso internally, so no offset needed
    // (tiles already placed at absolute iso positions in setTiles)

    this.nearContainer.addChild(tilemap.container);
    chunk.tilemap = tilemap;

    // Also create decorations
    const decorations = new DecorationRenderer();
    decorations.setTiles(chunk.tiles);
    this.nearContainer.addChild(decorations.container);
    chunk.decorations = decorations;
  }

  private createFarRenderer(chunk: LoadedChunk): void {
    const g = new Graphics();
    const S = WORLD_CHUNK_SIZE;
    const baseX = chunk.chunkX * S;
    const baseY = chunk.chunkY * S;
    const color = biomeColor(chunk.biome as Biome);

    // Draw a single colored diamond for the whole chunk
    const top = cartToIso(baseX, baseY);
    const right = cartToIso(baseX + S, baseY);
    const bottom = cartToIso(baseX + S, baseY + S);
    const left = cartToIso(baseX, baseY + S);

    g.moveTo(top.x, top.y);
    g.lineTo(right.x, right.y);
    g.lineTo(bottom.x, bottom.y);
    g.lineTo(left.x, left.y);
    g.closePath();
    g.fill(color);

    // Subtle border
    g.moveTo(top.x, top.y);
    g.lineTo(right.x, right.y);
    g.lineTo(bottom.x, bottom.y);
    g.lineTo(left.x, left.y);
    g.closePath();
    g.stroke({ width: 0.5, color: 0x000000, alpha: 0.15 });

    g.zIndex = isoDepth(baseX, baseY) - 1;
    this.farContainer.addChild(g);
    chunk.farGfx = g;
  }

  private destroyNearRenderer(chunk: LoadedChunk): void {
    if (chunk.tilemap) {
      this.nearContainer.removeChild(chunk.tilemap.container);
      chunk.tilemap.container.destroy({ children: true });
      chunk.tilemap = null;
    }
    if (chunk.decorations) {
      this.nearContainer.removeChild(chunk.decorations.container);
      chunk.decorations.container.destroy({ children: true });
      chunk.decorations = null;
    }
  }

  private destroyFarRenderer(chunk: LoadedChunk): void {
    if (chunk.farGfx) {
      this.farContainer.removeChild(chunk.farGfx);
      chunk.farGfx.destroy();
      chunk.farGfx = null;
    }
  }

  private destroyChunkRenderers(chunk: LoadedChunk): void {
    this.destroyNearRenderer(chunk);
    this.destroyFarRenderer(chunk);
  }
}
