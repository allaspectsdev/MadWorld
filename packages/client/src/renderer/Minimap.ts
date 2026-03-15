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

const SIZE = 140;
const VIEW_RADIUS = 20; // Show 40x40 tile window centered on player

export class Minimap {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private tileData: TT[][] | null = null;
  private updateTimer = 0;

  constructor() {
    const container = document.getElementById("minimap-container");
    if (!container) return;

    // Background wrapper
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px;
      padding: 4px;
      position: relative;
    `;

    // Label
    const label = document.createElement("div");
    label.textContent = "Map";
    label.style.cssText = `
      position: absolute; top: 6px; left: 8px;
      font-size: 9px; color: rgba(255,255,255,0.5);
      font-family: 'Segoe UI', system-ui, sans-serif;
      pointer-events: none;
    `;
    wrapper.appendChild(label);

    this.canvas = document.createElement("canvas");
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.canvas.style.borderRadius = "4px";
    this.canvas.style.display = "block";
    this.ctx = this.canvas.getContext("2d")!;
    wrapper.appendChild(this.canvas);
    container.appendChild(wrapper);
  }

  renderTiles(tiles: TT[][]): void {
    this.tileData = tiles;
  }

  update(dt: number): void {
    this.updateTimer += dt;
    if (this.updateTimer < 0.25) return;
    this.updateTimer = 0;
    this.render();
  }

  private render(): void {
    if (!this.tileData) return;
    const ctx = this.ctx;
    const state = useGameStore.getState();
    const lp = state.localPlayer;
    if (!lp) return;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, SIZE, SIZE);

    const mapH = this.tileData.length;
    const mapW = this.tileData[0]?.length ?? 0;

    // Center on player, show VIEW_RADIUS tiles in each direction
    const centerX = Math.floor(lp.x);
    const centerY = Math.floor(lp.y);
    const startX = centerX - VIEW_RADIUS;
    const startY = centerY - VIEW_RADIUS;
    const viewSize = VIEW_RADIUS * 2;
    const scale = SIZE / viewSize;

    // Draw tiles
    ctx.imageSmoothingEnabled = false;
    for (let dy = 0; dy < viewSize; dy++) {
      for (let dx = 0; dx < viewSize; dx++) {
        const tx = startX + dx;
        const ty = startY + dy;
        if (tx < 0 || tx >= mapW || ty < 0 || ty >= mapH) {
          ctx.fillStyle = "#111";
        } else {
          ctx.fillStyle = TILE_COLORS[this.tileData[ty][tx]] ?? "#333";
        }
        ctx.fillRect(dx * scale, dy * scale, Math.ceil(scale), Math.ceil(scale));
      }
    }

    // Fog of war — darken edges
    const gradient = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.25, SIZE / 2, SIZE / 2, SIZE * 0.5);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Draw entities
    for (const [, entity] of state.entities) {
      const ex = (entity.nextX - startX) * scale;
      const ey = (entity.nextY - startY) * scale;
      if (ex < 0 || ex > SIZE || ey < 0 || ey > SIZE) continue;

      if (entity.type === EntityType.PLAYER) {
        ctx.fillStyle = "#3498db";
        ctx.beginPath();
        ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (entity.type === EntityType.MOB) {
        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(ex - 1, ey - 1, 2.5, 2.5);
      }
    }

    // Local player (white with outline, larger)
    const px = (lp.x - startX) * scale;
    const py = (lp.y - startY) * scale;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, SIZE, SIZE);
  }
}
