import * as THREE from "three";
import { TileType, WORLD_CHUNK_SIZE } from "@madworld/shared";
import { TerrainChunk, createFarLODMesh } from "./TerrainChunk.js";
import type { WaterMesh } from "./WaterShader.js";
import type { ThreeApp } from "./ThreeApp.js";

/** Distance thresholds for LOD (in chunks) */
const LOD_NEAR = 2;
const LOD_FAR = 5;

interface ChunkEntry {
  cx: number;
  cy: number;
  tiles: TileType[][];
  biomeColor: number;
  terrain: TerrainChunk | null;
  farMesh: THREE.Mesh | null;
  waterMesh: WaterMesh | null;
  isNear: boolean;
}

/**
 * Manages terrain chunk loading, unloading, and LOD transitions.
 * Receives chunk data from the game store and creates/destroys
 * TerrainChunk meshes based on player distance.
 */
export class TerrainManager {
  private app: ThreeApp;
  private chunks = new Map<string, ChunkEntry>();
  private playerChunkX = 0;
  private playerChunkZ = 0;

  constructor(app: ThreeApp) {
    this.app = app;
  }

  private static key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  /** Add or replace a chunk's tile data */
  addChunk(cx: number, cy: number, tiles: TileType[][], biomeColor = 0x3a7a3a): void {
    const key = TerrainManager.key(cx, cy);
    const existing = this.chunks.get(key);
    if (existing) {
      this.removeChunkVisuals(existing);
    }

    const entry: ChunkEntry = {
      cx, cy, tiles, biomeColor,
      terrain: null,
      farMesh: null,
      waterMesh: null,
      isNear: false,
    };
    this.chunks.set(key, entry);
    this.updateChunkLOD(entry);
  }

  /** Remove a chunk entirely */
  removeChunk(cx: number, cy: number): void {
    const key = TerrainManager.key(cx, cy);
    const entry = this.chunks.get(key);
    if (!entry) return;
    this.removeChunkVisuals(entry);
    this.chunks.delete(key);
  }

  /** Update player position (for LOD decisions) */
  setPlayerPosition(worldX: number, worldZ: number): void {
    const newCX = Math.floor(worldX / WORLD_CHUNK_SIZE);
    const newCZ = Math.floor(worldZ / WORLD_CHUNK_SIZE);
    if (newCX === this.playerChunkX && newCZ === this.playerChunkZ) return;

    this.playerChunkX = newCX;
    this.playerChunkZ = newCZ;

    // Update LOD for all chunks and unload distant ones
    const toRemove: string[] = [];
    for (const [key, entry] of this.chunks) {
      const dist = Math.max(
        Math.abs(entry.cx - this.playerChunkX),
        Math.abs(entry.cy - this.playerChunkZ),
      );
      if (dist > LOD_FAR + 1) {
        toRemove.push(key);
      } else {
        this.updateChunkLOD(entry);
      }
    }
    for (const key of toRemove) {
      const entry = this.chunks.get(key)!;
      this.removeChunkVisuals(entry);
      this.chunks.delete(key);
    }
  }

  /** Update water animations */
  update(dt: number): void {
    for (const entry of this.chunks.values()) {
      if (entry.waterMesh) {
        entry.waterMesh.update(dt);
      }
    }
  }

  /** Get the tile type at a world position */
  getTileAt(worldX: number, worldZ: number): TileType | null {
    const cx = Math.floor(worldX / WORLD_CHUNK_SIZE);
    const cz = Math.floor(worldZ / WORLD_CHUNK_SIZE);
    const entry = this.chunks.get(TerrainManager.key(cx, cz));
    if (!entry) return null;

    const localX = Math.floor(worldX - cx * WORLD_CHUNK_SIZE);
    const localZ = Math.floor(worldZ - cz * WORLD_CHUNK_SIZE);
    return entry.tiles[localZ]?.[localX] ?? null;
  }

  /** Get tiles in an area (for pathfinding) */
  getTilesInArea(minX: number, minZ: number, maxX: number, maxZ: number): (TileType | null)[][] {
    const result: (TileType | null)[][] = [];
    for (let z = minZ; z <= maxZ; z++) {
      const row: (TileType | null)[] = [];
      for (let x = minX; x <= maxX; x++) {
        row.push(this.getTileAt(x, z));
      }
      result.push(row);
    }
    return result;
  }

  private updateChunkLOD(entry: ChunkEntry): void {
    const dist = Math.max(
      Math.abs(entry.cx - this.playerChunkX),
      Math.abs(entry.cy - this.playerChunkZ),
    );

    const shouldBeNear = dist <= LOD_NEAR;

    if (shouldBeNear && !entry.isNear) {
      // Upgrade to full detail
      this.removeFarVisuals(entry);
      this.createNearVisuals(entry);
      entry.isNear = true;
    } else if (!shouldBeNear && entry.isNear) {
      // Downgrade to far LOD
      this.removeNearVisuals(entry);
      if (dist <= LOD_FAR) {
        this.createFarVisuals(entry);
      }
      entry.isNear = false;
    } else if (!shouldBeNear && !entry.isNear && !entry.farMesh && dist <= LOD_FAR) {
      this.createFarVisuals(entry);
    }
  }

  private createNearVisuals(entry: ChunkEntry): void {
    entry.terrain = new TerrainChunk(entry.tiles, entry.cx, entry.cy);
    this.app.terrainGroup.add(entry.terrain.mesh);

    if (entry.terrain.waterMesh) {
      entry.waterMesh = entry.terrain.waterMesh;
      this.app.waterGroup.add(entry.waterMesh.mesh);
    }
  }

  private removeNearVisuals(entry: ChunkEntry): void {
    if (entry.terrain) {
      this.app.terrainGroup.remove(entry.terrain.mesh);
      entry.terrain.dispose();
      entry.terrain = null;
    }
    if (entry.waterMesh) {
      this.app.waterGroup.remove(entry.waterMesh.mesh);
      entry.waterMesh = null;
    }
  }

  private createFarVisuals(entry: ChunkEntry): void {
    entry.farMesh = createFarLODMesh(entry.biomeColor, entry.cx, entry.cy);
    this.app.terrainGroup.add(entry.farMesh);
  }

  private removeFarVisuals(entry: ChunkEntry): void {
    if (entry.farMesh) {
      this.app.terrainGroup.remove(entry.farMesh);
      (entry.farMesh.geometry as THREE.BufferGeometry).dispose();
      (entry.farMesh.material as THREE.Material).dispose();
      entry.farMesh = null;
    }
  }

  private removeChunkVisuals(entry: ChunkEntry): void {
    this.removeNearVisuals(entry);
    this.removeFarVisuals(entry);
  }

  dispose(): void {
    for (const entry of this.chunks.values()) {
      this.removeChunkVisuals(entry);
    }
    this.chunks.clear();
  }
}
