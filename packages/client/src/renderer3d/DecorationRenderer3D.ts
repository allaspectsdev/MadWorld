import * as THREE from "three";
import { TileType, WORLD_CHUNK_SIZE } from "@madworld/shared";
import { getMobTexture3D } from "./SpriteBakery.js";
import type { ThreeApp } from "./ThreeApp.js";

// Seeded RNG for deterministic placement (matches PixiJS DecorationRenderer)
function decorHash(x: number, y: number): number {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

function seededRandom(seed: number): number {
  let s = seed;
  s = (s ^ (s << 13)) >>> 0;
  s = (s ^ (s >> 17)) >>> 0;
  s = (s ^ (s << 5)) >>> 0;
  return (s % 10000) / 10000;
}

type DecoType = "tree" | "rock" | "flower" | "tallgrass" | "mushroom" | "lilypad" | "torch";

interface DecoInstance {
  type: DecoType;
  worldX: number;
  worldZ: number;
  scale: number;
  color: number;
}

/**
 * Renders environmental decorations (trees, rocks, flowers, etc.) as
 * billboarded sprites. Uses instancing concepts for efficiency.
 */
export class DecorationRenderer3D {
  private app: ThreeApp;
  private chunkDecos = new Map<string, THREE.Group>();

  // Pre-generated textures
  private treeTexture: THREE.CanvasTexture | null = null;
  private rockTexture: THREE.CanvasTexture | null = null;
  private flowerTexture: THREE.CanvasTexture | null = null;

  constructor(app: ThreeApp) {
    this.app = app;
    this.generateTextures();
  }

  private generateTextures(): void {
    this.treeTexture = this.createTreeTexture();
    this.rockTexture = this.createRockTexture();
    this.flowerTexture = this.createFlowerTexture();
  }

  /** Add decorations for a chunk */
  addChunk(cx: number, cy: number, tiles: TileType[][]): void {
    const key = `${cx},${cy}`;
    if (this.chunkDecos.has(key)) return;

    const group = new THREE.Group();
    const size = tiles.length;

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const tile = tiles[row]?.[col] ?? TileType.GRASS;
        const worldX = cx * WORLD_CHUNK_SIZE + col;
        const worldZ = cy * WORLD_CHUNK_SIZE + row;
        const hash = decorHash(worldX, worldZ);
        const r = seededRandom(hash);

        this.placeDecoration(group, tile, worldX, worldZ, r, hash, tiles, row, col);
      }
    }

    this.chunkDecos.set(key, group);
    this.app.decorationGroup.add(group);
  }

  /** Remove decorations for a chunk */
  removeChunk(cx: number, cy: number): void {
    const key = `${cx},${cy}`;
    const group = this.chunkDecos.get(key);
    if (!group) return;
    this.app.decorationGroup.remove(group);
    // Dispose sprites
    group.traverse((child) => {
      if (child instanceof THREE.Sprite) {
        child.material.dispose();
      }
    });
    this.chunkDecos.delete(key);
  }

  private placeDecoration(
    group: THREE.Group,
    tile: TileType,
    wx: number,
    wz: number,
    r: number,
    hash: number,
    tiles: TileType[][],
    row: number,
    col: number,
  ): void {
    // Tall trees on FOREST tiles
    if (tile === TileType.FOREST && r < 0.55) {
      this.addSprite(group, this.treeTexture!, wx, wz, 2.5 + seededRandom(hash + 1) * 1.5, 0x2a5a2a);
      return;
    }

    // Wildflowers on GRASS
    if (tile === TileType.GRASS && r > 0.88) {
      const colors = [0xffdd44, 0xff88aa, 0xffffff, 0xcc66ff, 0xff9944];
      const count = 2 + Math.floor(seededRandom(hash + 2) * 3);
      for (let i = 0; i < count; i++) {
        const offX = (seededRandom(hash + i * 3 + 10) - 0.5) * 0.8;
        const offZ = (seededRandom(hash + i * 3 + 11) - 0.5) * 0.8;
        const color = colors[Math.floor(seededRandom(hash + i * 3 + 12) * colors.length)];
        this.addSprite(group, this.flowerTexture!, wx + offX, wz + offZ, 0.3 + seededRandom(hash + i) * 0.15, color);
      }
      return;
    }

    // Tall grass on GRASS
    if (tile === TileType.GRASS && r > 0.75) {
      const count = 3 + Math.floor(seededRandom(hash + 5) * 4);
      for (let i = 0; i < count; i++) {
        const offX = (seededRandom(hash + i * 7 + 20) - 0.5) * 0.9;
        const offZ = (seededRandom(hash + i * 7 + 21) - 0.5) * 0.9;
        this.addSprite(group, this.flowerTexture!, wx + offX, wz + offZ, 0.4, 0x3a8a3a);
      }
      return;
    }

    // Rocks near mountains
    if (tile === TileType.GRASS && r < 0.4) {
      const hasNeighborMtn = this.hasNeighbor(tiles, row, col, TileType.MOUNTAIN);
      if (hasNeighborMtn) {
        const count = 1 + Math.floor(seededRandom(hash + 3) * 2);
        for (let i = 0; i < count; i++) {
          const offX = (seededRandom(hash + i * 5 + 30) - 0.5) * 0.6;
          const offZ = (seededRandom(hash + i * 5 + 31) - 0.5) * 0.6;
          this.addSprite(group, this.rockTexture!, wx + offX, wz + offZ, 0.3 + seededRandom(hash + i * 5) * 0.2, 0x888888);
        }
      }
    }

    // Mushrooms near forest
    if (tile === TileType.GRASS && r > 0.55 && r < 0.75) {
      const hasForest = this.hasNeighbor(tiles, row, col, TileType.FOREST);
      if (hasForest) {
        this.addSprite(group, this.flowerTexture!, wx, wz, 0.25, 0xcc6633);
      }
    }

    // Lily pads on water near land
    if (tile === TileType.WATER && r < 0.35) {
      const hasLand = this.hasNeighbor(tiles, row, col, TileType.GRASS) ||
                      this.hasNeighbor(tiles, row, col, TileType.SAND);
      if (hasLand) {
        this.addFlatSprite(group, wx, wz, 0.4, 0x2a8a2a);
      }
    }

    // Torch stands on cobblestone
    if (tile === TileType.COBBLESTONE && r < 0.35) {
      const hasBldg = this.hasNeighbor(tiles, row, col, TileType.BUILDING_FLOOR);
      if (hasBldg) {
        this.addSprite(group, this.rockTexture!, wx, wz, 0.8, 0x5c3a1e);
        // Could add a point light here in Phase 4
      }
    }
  }

  private hasNeighbor(tiles: TileType[][], row: number, col: number, type: TileType): boolean {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        if (tiles[row + dr]?.[col + dc] === type) return true;
      }
    }
    return false;
  }

  private addSprite(
    group: THREE.Group,
    texture: THREE.CanvasTexture,
    wx: number,
    wz: number,
    scale: number,
    tint: number,
  ): void {
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      color: tint,
      depthWrite: true,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale, scale, 1);
    sprite.position.set(wx, scale / 2, wz);
    group.add(sprite);
  }

  private addFlatSprite(
    group: THREE.Group,
    wx: number,
    wz: number,
    scale: number,
    color: number,
  ): void {
    const geo = new THREE.CircleGeometry(scale * 0.5, 8);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(wx, 0.05, wz);
    group.add(mesh);
  }

  // ── Procedural texture generation ──

  private createTreeTexture(): THREE.CanvasTexture {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Trunk
    ctx.fillStyle = "#5c3a1e";
    ctx.fillRect(28, 35, 8, 29);
    // Dark side
    ctx.fillStyle = "#4a2e16";
    ctx.fillRect(28, 35, 3, 29);

    // Canopy (overlapping circles)
    const greens = ["#2a5a1a", "#336622", "#1e4a15", "#2e6620", "#3a7a2a"];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = greens[i % greens.length];
      const cx = 32 + (Math.sin(i * 1.5) * 12);
      const cy = 20 + (Math.cos(i * 1.2) * 8);
      const r = 12 + (i % 3) * 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Highlight blob
    ctx.fillStyle = "rgba(100,180,80,0.25)";
    ctx.beginPath();
    ctx.arc(26, 14, 8, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  private createRockTexture(): THREE.CanvasTexture {
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#777777";
    ctx.beginPath();
    ctx.arc(16, 18, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#999999";
    ctx.beginPath();
    ctx.arc(14, 15, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#555555";
    ctx.beginPath();
    ctx.arc(20, 22, 4, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  private createFlowerTexture(): THREE.CanvasTexture {
    const size = 16;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Simple circle (tinted per-instance)
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(8, 8, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,128,0.8)";
    ctx.beginPath();
    ctx.arc(8, 8, 2, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  dispose(): void {
    for (const [key] of this.chunkDecos) {
      const [cx, cy] = key.split(",").map(Number);
      this.removeChunk(cx, cy);
    }
  }
}
