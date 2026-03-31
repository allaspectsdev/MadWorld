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
    // Tall trees on FOREST tiles (sparse — only 15%)
    if (tile === TileType.FOREST && r < 0.15) {
      const treeScale = 2.0 + seededRandom(hash + 1) * 2.0;
      // Vary the green tint slightly per tree
      const greenVar = Math.floor(seededRandom(hash + 7) * 40);
      const tint = (0xbb + greenVar) << 8 | (0xff) << 16 | (0xbb + greenVar);
      const offX = (seededRandom(hash + 8) - 0.5) * 0.4;
      const offZ = (seededRandom(hash + 9) - 0.5) * 0.4;
      this.addSprite(group, this.treeTexture!, wx + offX, wz + offZ, treeScale, tint);
      return;
    }

    // Wildflowers on GRASS (sparse — only 5% of tiles, 1-2 per tile)
    if (tile === TileType.GRASS && r > 0.95) {
      const colors = [0xffdd44, 0xff88aa, 0xffffff, 0xcc66ff, 0xff9944];
      const count = 1 + Math.floor(seededRandom(hash + 2) * 2);
      for (let i = 0; i < count; i++) {
        const offX = (seededRandom(hash + i * 3 + 10) - 0.5) * 0.7;
        const offZ = (seededRandom(hash + i * 3 + 11) - 0.5) * 0.7;
        const color = colors[Math.floor(seededRandom(hash + i * 3 + 12) * colors.length)];
        this.addSprite(group, this.flowerTexture!, wx + offX, wz + offZ, 0.2, color);
      }
      return;
    }

    // Rocks near mountains (sparse)
    if (tile === TileType.GRASS && r < 0.15) {
      const hasNeighborMtn = this.hasNeighbor(tiles, row, col, TileType.MOUNTAIN);
      if (hasNeighborMtn) {
        this.addSprite(group, this.rockTexture!, wx, wz, 0.4, 0xaaaaaa);
      }
    }

    // Lily pads on water near land
    if (tile === TileType.WATER && r < 0.15) {
      const hasLand = this.hasNeighbor(tiles, row, col, TileType.GRASS) ||
                      this.hasNeighbor(tiles, row, col, TileType.SAND);
      if (hasLand) {
        this.addFlatSprite(group, wx, wz, 0.3, 0x2a8a2a);
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
    ctx.fillStyle = "#8b6914";
    ctx.fillRect(28, 38, 8, 26);
    // Light side
    ctx.fillStyle = "#a07820";
    ctx.fillRect(32, 38, 4, 26);

    // Canopy (overlapping circles — bright greens)
    const greens = ["#4a9a3a", "#55aa44", "#3d8832", "#4daa40", "#5abb4a"];
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = greens[i % greens.length];
      const cx = 32 + (Math.sin(i * 1.5) * 12);
      const cy = 20 + (Math.cos(i * 1.2) * 8);
      const r = 12 + (i % 3) * 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Highlight blobs (sun-lit side)
    ctx.fillStyle = "rgba(140,220,100,0.4)";
    ctx.beginPath();
    ctx.arc(24, 14, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(180,240,120,0.3)";
    ctx.beginPath();
    ctx.arc(28, 10, 6, 0, Math.PI * 2);
    ctx.fill();

    // Shadow on bottom-right
    ctx.fillStyle = "rgba(20,50,10,0.25)";
    ctx.beginPath();
    ctx.arc(38, 28, 10, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
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
