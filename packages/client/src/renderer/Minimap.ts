import { TileType, EntityType, type TileType as TT } from "@madworld/shared";
import { useGameStore } from "../state/GameStore.js";

const TILE_COLORS: Record<number, string> = {
  [TileType.GRASS]: "#4a7c59",
  [TileType.DIRT]: "#8b7355",
  [TileType.COBBLESTONE]: "#808080",
  [TileType.WATER]: "#3a6ea5",
  [TileType.SAND]: "#c2b280",
  [TileType.FOREST]: "#2d5a27",
  [TileType.MOUNTAIN]: "#555555",
  [TileType.BRIDGE]: "#8b6914",
  [TileType.BUILDING_FLOOR]: "#a0522d",
  [TileType.PORTAL]: "#9b59b6",
  [TileType.DUNGEON_PORTAL]: "#e74c3c",
};

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tileCanvas: HTMLCanvasElement | null = null;
  private updateTimer = 0;

  constructor() {
    const container = document.getElementById("minimap-container");
    this.canvas = document.createElement("canvas");
    this.canvas.width = 120;
    this.canvas.height = 120;
    this.canvas.style.borderRadius = "4px";
    this.ctx = this.canvas.getContext("2d")!;
    container?.appendChild(this.canvas);
  }

  renderTiles(tiles: TT[][]): void {
    if (!tiles.length) return;

    const h = tiles.length;
    const w = tiles[0].length;

    // Render tiles to an offscreen canvas (1px per tile)
    this.tileCanvas = document.createElement("canvas");
    this.tileCanvas.width = w;
    this.tileCanvas.height = h;
    const tctx = this.tileCanvas.getContext("2d")!;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        tctx.fillStyle = TILE_COLORS[tiles[y][x]] ?? "#333333";
        tctx.fillRect(x, y, 1, 1);
      }
    }
  }

  update(dt: number): void {
    this.updateTimer += dt;
    if (this.updateTimer < 0.5) return;
    this.updateTimer = 0;

    this.render();
  }

  private render(): void {
    const ctx = this.ctx;
    const size = 120;
    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, size, size);

    if (!this.tileCanvas) return;

    const state = useGameStore.getState();
    const lp = state.localPlayer;
    if (!lp) return;

    // Scale to fit
    const scaleX = size / this.tileCanvas.width;
    const scaleY = size / this.tileCanvas.height;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (size - this.tileCanvas.width * scale) / 2;
    const offsetY = (size - this.tileCanvas.height * scale) / 2;

    // Draw tile canvas scaled
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.tileCanvas,
      offsetX, offsetY,
      this.tileCanvas.width * scale,
      this.tileCanvas.height * scale,
    );

    // Draw entities
    for (const [, entity] of state.entities) {
      const ex = offsetX + entity.nextX * scale;
      const ey = offsetY + entity.nextY * scale;

      if (entity.type === EntityType.PLAYER) {
        ctx.fillStyle = "#3498db";
        ctx.fillRect(ex - 1, ey - 1, 3, 3);
      } else if (entity.type === EntityType.MOB) {
        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(ex, ey, 2, 2);
      }
    }

    // Draw local player (white, larger)
    const px = offsetX + lp.x * scale;
    const py = offsetY + lp.y * scale;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(px - 1.5, py - 1.5, 4, 4);

    // Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);
  }
}
