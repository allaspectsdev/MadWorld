/**
 * WorldMap — full-screen overlay showing all discovered chunks.
 *
 * Toggled with 'M' key. Renders discovered chunks as biome-colored
 * rectangles, party members as dots, local player as a pulsing marker.
 */

import { useGameStore } from "../../state/GameStore.js";
import { biomeColor, WORLD_CHUNK_SIZE, type Biome } from "@madworld/shared";

const CHUNK_PX = 14;    // Pixels per chunk on the map
const MAP_PADDING = 60;  // Padding from screen edges

export class WorldMap {
  private overlay: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private visible = false;
  private animTime = 0;

  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.id = "world-map-overlay";
    Object.assign(this.overlay.style, {
      position: "absolute",
      top: "0", left: "0", width: "100%", height: "100%",
      background: "rgba(8, 6, 14, 0.92)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      zIndex: "80",
      display: "none",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "auto",
    });

    // Title
    const title = document.createElement("div");
    Object.assign(title.style, {
      fontSize: "18px", fontWeight: "700",
      color: "var(--color-gold, #daa520)",
      textTransform: "uppercase", letterSpacing: "3px",
      marginBottom: "10px",
      textShadow: "0 2px 6px rgba(0,0,0,0.6)",
    });
    title.textContent = "World Map";
    this.overlay.appendChild(title);

    // Hint
    const hint = document.createElement("div");
    Object.assign(hint.style, {
      fontSize: "11px", color: "rgba(232,228,220,0.4)",
      marginBottom: "14px", letterSpacing: "1px",
    });
    hint.textContent = "Press M or Escape to close";
    this.overlay.appendChild(hint);

    // Canvas
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      border: "1px solid rgba(180,160,120,0.25)",
      borderRadius: "4px",
      imageRendering: "pixelated",
    });
    this.overlay.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    // Legend
    const legend = document.createElement("div");
    Object.assign(legend.style, {
      display: "flex", gap: "18px", marginTop: "12px",
      fontSize: "11px", color: "rgba(232,228,220,0.55)",
    });
    const dot = (color: string, label: string) =>
      `<span style="display:inline-flex;align-items:center;gap:4px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>${label}</span>`;
    legend.innerHTML = [
      dot("#ffffff", "You"),
      dot("#44aaff", "Party"),
    ].join("");
    this.overlay.appendChild(legend);

    document.getElementById("ui-root")?.appendChild(this.overlay);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.overlay.style.display = this.visible ? "flex" : "none";
    if (this.visible) this.render();
  }

  isOpen(): boolean {
    return this.visible;
  }

  update(dt: number): void {
    if (!this.visible) return;
    this.animTime += dt;
    this.render();
  }

  private render(): void {
    const state = useGameStore.getState();
    const discovered = state.discoveredChunks;
    const chunkBiomes = state.chunkBiomes;
    const lp = state.localPlayer;
    if (!lp || discovered.size === 0) return;

    // Find bounds of discovered area
    let minCX = Infinity, maxCX = -Infinity;
    let minCY = Infinity, maxCY = -Infinity;
    for (const key of discovered) {
      const sep = key.indexOf(",");
      const cx = parseInt(key.substring(0, sep), 10);
      const cy = parseInt(key.substring(sep + 1), 10);
      if (cx < minCX) minCX = cx;
      if (cx > maxCX) maxCX = cx;
      if (cy < minCY) minCY = cy;
      if (cy > maxCY) maxCY = cy;
    }

    // Add 1 chunk margin
    minCX -= 1; minCY -= 1;
    maxCX += 1; maxCY += 1;

    const cols = maxCX - minCX + 1;
    const rows = maxCY - minCY + 1;
    const rawW = cols * CHUNK_PX;
    const rawH = rows * CHUNK_PX;

    // Scale to fit screen
    const maxW = window.innerWidth - MAP_PADDING * 2;
    const maxH = window.innerHeight - MAP_PADDING * 2 - 120;
    const scale = Math.min(1.5, maxW / rawW, maxH / rawH);
    const canvasW = Math.ceil(rawW * scale);
    const canvasH = Math.ceil(rawH * scale);

    if (this.canvas.width !== canvasW || this.canvas.height !== canvasH) {
      this.canvas.width = canvasW;
      this.canvas.height = canvasH;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.save();
    ctx.scale(scale, scale);

    // Background (undiscovered)
    ctx.fillStyle = "rgba(15, 12, 25, 0.8)";
    ctx.fillRect(0, 0, rawW, rawH);

    // Draw discovered chunks with biome colors
    for (const key of discovered) {
      const sep = key.indexOf(",");
      const cx = parseInt(key.substring(0, sep), 10);
      const cy = parseInt(key.substring(sep + 1), 10);
      const px = (cx - minCX) * CHUNK_PX;
      const py = (cy - minCY) * CHUNK_PX;

      const biome = chunkBiomes.get(key);
      if (biome) {
        const rgb = biomeColor(biome as Biome);
        ctx.fillStyle = `#${rgb.toString(16).padStart(6, "0")}`;
      } else {
        // Discovered but biome not yet seen — muted olive
        ctx.fillStyle = "#2a3020";
      }
      ctx.fillRect(px, py, CHUNK_PX, CHUNK_PX);

      // Grid line
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px + 0.25, py + 0.25, CHUNK_PX - 0.5, CHUNK_PX - 0.5);
    }

    // Discovered-chunk border highlight (subtle glow at exploration frontier)
    for (const key of discovered) {
      const sep = key.indexOf(",");
      const cx = parseInt(key.substring(0, sep), 10);
      const cy = parseInt(key.substring(sep + 1), 10);
      // Check if any neighbor is undiscovered
      const neighbors = [
        `${cx - 1},${cy}`, `${cx + 1},${cy}`,
        `${cx},${cy - 1}`, `${cx},${cy + 1}`,
      ];
      const isFrontier = neighbors.some((n) => !discovered.has(n));
      if (isFrontier) {
        const px = (cx - minCX) * CHUNK_PX;
        const py = (cy - minCY) * CHUNK_PX;
        ctx.strokeStyle = "rgba(180,160,120,0.2)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, CHUNK_PX, CHUNK_PX);
      }
    }

    // Draw party members (blue dots with name labels)
    const party = state.party;
    if (party) {
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      for (const member of party.members) {
        if (member.eid === lp.eid) continue;
        if (member.worldX == null || member.worldY == null) continue;
        const mcx = member.worldX / WORLD_CHUNK_SIZE;
        const mcy = member.worldY / WORLD_CHUNK_SIZE;
        const mpx = (mcx - minCX) * CHUNK_PX;
        const mpy = (mcy - minCY) * CHUNK_PX;

        // Glow
        ctx.fillStyle = "rgba(68,170,255,0.25)";
        ctx.beginPath();
        ctx.arc(mpx, mpy, 5, 0, Math.PI * 2);
        ctx.fill();

        // Dot
        ctx.fillStyle = "#44aaff";
        ctx.beginPath();
        ctx.arc(mpx, mpy, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Name
        ctx.fillStyle = "rgba(150,200,255,0.7)";
        ctx.font = "bold 6px sans-serif";
        ctx.fillText(member.name, mpx, mpy - 6);
      }
    }

    // Draw local player (pulsing white dot)
    const playerCX = lp.x / WORLD_CHUNK_SIZE;
    const playerCY = lp.y / WORLD_CHUNK_SIZE;
    const ppx = (playerCX - minCX) * CHUNK_PX;
    const ppy = (playerCY - minCY) * CHUNK_PX;

    // Outer pulse ring
    const pulseR = 4 + Math.sin(this.animTime * 5) * 2;
    const pulseA = 0.15 + Math.sin(this.animTime * 5) * 0.1;
    ctx.strokeStyle = `rgba(255,255,255,${pulseA})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ppx, ppy, pulseR, 0, Math.PI * 2);
    ctx.stroke();

    // Glow
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.arc(ppx, ppy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Solid dot
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ppx, ppy, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Player name
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "bold 6px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(lp.name, ppx, ppy - 6);

    ctx.restore();
  }
}
