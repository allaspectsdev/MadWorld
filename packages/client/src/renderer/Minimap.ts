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
  [TileType.FENCE]: "#8b6914",
};

// Friendly zone name labels for portals
const ZONE_LABELS: Record<string, string> = {
  greendale: "Village",
  darkwood: "Darkwood",
  fields: "Fields",
  goblin_warren: "Dungeon",
  crypt_of_bones: "Dungeon",
};

const SIZE = 140;
const VIEW_RADIUS = 20; // Show 40x40 tile window centered on player

interface PortalInfo {
  x: number;
  y: number;
  label: string;
}

export class Minimap {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private tileData: TT[][] | null = null;
  private updateTimer = 0;
  private portals: PortalInfo[] = [];

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
    this.findPortals(tiles);
  }

  private findPortals(tiles: TT[][]): void {
    this.portals = [];
    const state = useGameStore.getState();
    const lp = state.localPlayer;
    if (!lp) return;

    // Find portal tiles and try to determine their destination
    // We scan for PORTAL/DUNGEON_PORTAL tiles and group them
    const visited = new Set<string>();

    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < (tiles[0]?.length ?? 0); x++) {
        const type = tiles[y][x];
        if (type !== TileType.PORTAL && type !== TileType.DUNGEON_PORTAL) continue;
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        visited.add(key);

        // Determine label based on edge position and current zone
        let label = type === TileType.DUNGEON_PORTAL ? "Dungeon" : "";
        if (type === TileType.PORTAL) {
          label = this.guessPortalLabel(x, y, tiles.length, tiles[0]?.length ?? 0, lp.zoneId);
        }

        if (label) {
          this.portals.push({ x, y, label });
        }
      }
    }
  }

  private guessPortalLabel(x: number, y: number, mapH: number, mapW: number, currentZone: string): string {
    // Portals at edges lead to specific zones based on current zone
    if (currentZone === "greendale") {
      if (y >= mapH - 2) return "Darkwood";
      if (x >= mapW - 2) return "Fields";
    } else if (currentZone === "darkwood") {
      if (y <= 1) return "Village";
    } else if (currentZone === "fields") {
      if (x <= 1) return "Village";
    }
    return "Exit";
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

    // Portal labels
    ctx.font = "bold 8px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const portal of this.portals) {
      const px = (portal.x - startX) * scale;
      const py = (portal.y - startY) * scale;
      if (px < -20 || px > SIZE + 20 || py < -10 || py > SIZE + 10) continue;

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      const textWidth = ctx.measureText(portal.label).width;
      ctx.fillRect(px - textWidth / 2 - 2, py - 12, textWidth + 4, 10);
      ctx.fillStyle = "#dda0dd";
      ctx.fillText(portal.label, px, py - 4);
    }

    // Local player (pulsing white with green glow)
    const ppx = (lp.x - startX) * scale;
    const ppy = (lp.y - startY) * scale;
    const pulse = Math.sin(Date.now() * 0.005) * 0.5 + 0.5;
    const playerRadius = 4 + pulse;

    // Green glow stroke
    ctx.strokeStyle = `rgba(68, 255, 136, ${0.3 + pulse * 0.4})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ppx, ppy, playerRadius + 1.5, 0, Math.PI * 2);
    ctx.stroke();

    // White fill
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ppx, ppy, playerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Compass labels
    ctx.font = "bold 7px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillText("N", SIZE / 2, 8);
    ctx.fillText("S", SIZE / 2, SIZE - 8);
    ctx.textAlign = "left";
    ctx.fillText("W", 4, SIZE / 2);
    ctx.textAlign = "right";
    ctx.fillText("E", SIZE - 4, SIZE / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, SIZE, SIZE);
  }
}
