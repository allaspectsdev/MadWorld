import * as THREE from "three";
import { TileType, WORLD_CHUNK_SIZE } from "@madworld/shared";
import type { WaterMesh } from "./WaterShader.js";
import { createWaterMesh } from "./WaterShader.js";

/** Base colors for each tile type [R, G, B] 0-1 range */
const TERRAIN_COLOR: Partial<Record<number, [number, number, number]>> = {
  [TileType.GRASS]:          [58/255, 138/255, 69/255],
  [TileType.DIRT]:           [138/255, 104/255, 66/255],
  [TileType.COBBLESTONE]:    [120/255, 115/255, 110/255],
  [TileType.WATER]:          [50/255, 120/255, 180/255],
  [TileType.SAND]:           [194/255, 178/255, 128/255],
  [TileType.FOREST]:         [35/255, 70/255, 32/255],
  [TileType.MOUNTAIN]:       [88/255, 88/255, 88/255],
  [TileType.BRIDGE]:         [139/255, 105/255, 20/255],
  [TileType.BUILDING_FLOOR]: [130/255, 100/255, 65/255],
  [TileType.PORTAL]:         [155/255, 89/255, 182/255],
  [TileType.DUNGEON_PORTAL]: [180/255, 50/255, 50/255],
  [TileType.FENCE]:          [90/255, 64/255, 32/255],
};

const DEFAULT_COLOR: [number, number, number] = [60/255, 60/255, 60/255];

function tileElevation(type: TileType): number {
  switch (type) {
    case TileType.MOUNTAIN: return 1.2;
    case TileType.FENCE: return 0.6;
    default: return 0;
  }
}

function getTileColor(type: TileType): [number, number, number] {
  return TERRAIN_COLOR[type] ?? DEFAULT_COLOR;
}

/**
 * A single terrain chunk mesh. Each chunk covers WORLD_CHUNK_SIZE x WORLD_CHUNK_SIZE
 * tiles, rendered as a subdivided PlaneGeometry with vertex colors and Y displacement.
 */
export class TerrainChunk {
  readonly mesh: THREE.Mesh;
  readonly waterMesh: WaterMesh | null;
  readonly chunkX: number;
  readonly chunkY: number;

  private static terrainMaterial: THREE.MeshLambertMaterial | null = null;

  private static getTerrainMaterial(): THREE.MeshLambertMaterial {
    if (!TerrainChunk.terrainMaterial) {
      TerrainChunk.terrainMaterial = new THREE.MeshLambertMaterial({
        vertexColors: true,
      });
    }
    return TerrainChunk.terrainMaterial;
  }

  constructor(tiles: TileType[][], chunkX: number, chunkY: number) {
    this.chunkX = chunkX;
    this.chunkY = chunkY;

    const size = WORLD_CHUNK_SIZE;
    // Create a plane subdivided to match tile grid
    // +1 subdivisions so each tile quad maps to 4 vertices
    const geo = new THREE.PlaneGeometry(size, size, size, size);
    geo.rotateX(-Math.PI / 2); // Lay flat on XZ plane

    const positions = geo.attributes.position as THREE.BufferAttribute;
    const vertexCount = positions.count;
    const colors = new Float32Array(vertexCount * 3);

    // Track which tiles are water for water mesh generation
    let hasWater = false;
    const waterTiles: boolean[][] = [];
    for (let row = 0; row < size; row++) {
      waterTiles[row] = [];
      for (let col = 0; col < size; col++) {
        const tile = tiles[row]?.[col] ?? TileType.GRASS;
        const isWater = tile === TileType.WATER;
        waterTiles[row][col] = isWater;
        if (isWater) hasWater = true;
      }
    }

    for (let i = 0; i < vertexCount; i++) {
      // PlaneGeometry vertices range from -size/2 to +size/2
      const localX = positions.getX(i) + size / 2;
      const localZ = positions.getZ(i) + size / 2;

      // Map to tile indices (clamp to valid range)
      const tileCol = Math.min(size - 1, Math.max(0, Math.floor(localX)));
      const tileRow = Math.min(size - 1, Math.max(0, Math.floor(localZ)));
      const tile = tiles[tileRow]?.[tileCol] ?? TileType.GRASS;

      // Y displacement from elevation
      const elev = tileElevation(tile);
      positions.setY(i, elev);

      // Vertex color with slight noise for visual interest
      const [r, g, b] = getTileColor(tile);
      const noise = (Math.sin(localX * 7.3 + localZ * 11.7) * 0.5 + 0.5) * 0.06 - 0.03;
      colors[i * 3] = Math.max(0, Math.min(1, r + noise));
      colors[i * 3 + 1] = Math.max(0, Math.min(1, g + noise));
      colors[i * 3 + 2] = Math.max(0, Math.min(1, b + noise));

      // Slightly depress water vertices
      if (tile === TileType.WATER) {
        positions.setY(i, -0.15);
      }
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    this.mesh = new THREE.Mesh(geo, TerrainChunk.getTerrainMaterial());

    // Position the chunk in world space
    // Chunk (0,0) covers tiles 0..31 on both axes
    const worldOffsetX = chunkX * size + size / 2;
    const worldOffsetZ = chunkY * size + size / 2;
    this.mesh.position.set(worldOffsetX, 0, worldOffsetZ);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;

    // Water is rendered via vertex colors on the terrain mesh for now.
    // The full water shader (createWaterMesh) can be re-enabled once
    // it's been updated to only generate geometry for water tiles.
    this.waterMesh = null;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    if (this.waterMesh) {
      this.waterMesh.mesh.geometry.dispose();
      (this.waterMesh.mesh.material as THREE.Material).dispose();
    }
  }
}

/**
 * Create a simplified LOD mesh for distant chunks -- a single flat quad
 * with biome color, extremely cheap to render.
 */
export function createFarLODMesh(biomeColor: number, chunkX: number, chunkY: number): THREE.Mesh {
  const size = WORLD_CHUNK_SIZE;
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: biomeColor,
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(
    chunkX * size + size / 2,
    -0.1,
    chunkY * size + size / 2,
  );
  return mesh;
}
