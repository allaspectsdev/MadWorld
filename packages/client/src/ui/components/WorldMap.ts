/**
 * WorldMap — full-screen overlay showing all discovered chunks.
 *
 * Toggled with 'M' key. Renders discovered chunks as biome-colored
 * rectangles, camp locations as icons, party members as dots,
 * and the local player as a pulsing marker.
 */

import { useGameStore } from "../../state/GameStore.js";
import { biomeColor, WORLD_CHUNK_SIZE, type Biome } from "@madworld/shared";

const CHUNK_PX = 12;  // Pixels per chunk on the map
const PADDING = 40;

export class WorldMap {
  private overlay: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private visible = false;
  private animFrame = 0;

  constructor() {
    // Create overlay
    this.overlay = document.createElement("div");
    this.overlay.id = "world-map-overlay";
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(8, 6, 14, 0.92);
      backdrop-filter: blur(8px);
      z-index: 80; display: none;
      flex-direction: column; align-items: center; justify-content: center;
      pointer-events: auto;
    `;

    // Title
    const title = document.createElement("div");
    title.style.cssText = `
      font-size: 18px; font-weight: 700; color: var(--color-gold, #daa520);
      text-transform: uppercase; letter-spacing: 3px; margin-bottom: 12px;
      text-shadow: 0 2px 6px rgba(0,0,0,0.6);
    `;
    title.textContent = "World Map";
    this.overlay.appendChild(title);

    // Hint
    const hint = document.createElement("div");
    hint.style.cssText = `
      font-size: 11px; color: rgba(232,228,220,0.4); margin-bottom: 16px;
      letter-spacing: 1px;
    `;
    hint.textContent = "Press M to close";
    this.overlay.appendChild(hint);

    // Canvas
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = `
      border: 1px solid rgba(180,160,120,0.2);
      border-radius: 4px;
      image-rendering: pixelated;
    `;
    this.overlay.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    // Legend
    const legend = document.createElement("div");
    legend.style.cssText = `
      display: flex; gap: 16px; margin-top: 12px; font-size: 10px;
      color: rgba(232,228,220,0.5);
    `;
    legend.innerHTML = `
      <span>\u25CF <span style="color:#fff">You</span></span>
      <span>\u25CF <span style="color:#44aaff">Party</span></span>
      <span>\u25B2 <span style="color:#ff8844">Camps</span></span>
      <span>\u25C6 <span style="color:#ffd700">Landmarks</span></span>
    `;
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
    this.animFrame += dt;
    // Re-render periodically for party member movement
    if (Math.floor(this.animFrame * 2) % 2 === 0) {
      this.render();
    }
  }

  private render(): void {
    const state = useGameStore.getState();
    const discovered = state.discoveredChunks;
    const loadedChunks = state.loadedChunks;
    const lp = state.localPlayer;
    if (!lp) return;

    // Find bounds of discovered area
    let minCX = Infinity, maxCX = -Infinity;
    let minCY = Infinity, maxCY = -Infinity;
    for (const key of discovered) {
      const [cx, cy] = key.split(",").map(Number);
      if (cx < minCX) minCX = cx;
      if (cx > maxCX) maxCX = cx;
      if (cy < minCY) minCY = cy;
      if (cy > maxCY) maxCY = cy;
    }

    if (minCX === Infinity) return; // Nothing discovered

    // Add margin
    minCX -= 2; minCY -= 2;
    maxCX += 2; maxCY += 2;

    const w = (maxCX - minCX + 1) * CHUNK_PX;
    const h = (maxCY - minCY + 1) * CHUNK_PX;

    // Clamp to screen
    const maxW = window.innerWidth - PADDING * 2;
    const maxH = window.innerHeight - PADDING * 2 - 100; // room for title/legend
    const scale = Math.min(1, maxW / w, maxH / h);
    this.canvas.width = Math.ceil(w * scale);
    this.canvas.height = Math.ceil(h * scale);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(scale, scale);

    // Draw undiscovered background
    ctx.fillStyle = "rgba(10, 8, 16, 0.6)";
    ctx.fillRect(0, 0, w, h);

    // Draw discovered chunks
    for (const key of discovered) {
      const [cx, cy] = key.split(",").map(Number);
      const px = (cx - minCX) * CHUNK_PX;
      const py = (cy - minCY) * CHUNK_PX;

      // Get biome color from loaded chunk data
      const chunkData = loadedChunks.get(key);
      if (chunkData) {
        const color = biomeColor(chunkData.biome as Biome);
        ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
      } else {
        ctx.fillStyle = "#334433"; // Discovered but not loaded = dim green
      }
      ctx.fillRect(px, py, CHUNK_PX, CHUNK_PX);

      // Subtle grid line
      ctx.strokeStyle = "rgba(180,160,120,0.08)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px, py, CHUNK_PX, CHUNK_PX);
    }

    // Draw landmarks (gold diamonds)
    for (const [, chunkData] of loadedChunks) {
      if (!chunkData.lights || !(chunkData as any).landmarks) continue;
      // We don't have landmarks in the loaded chunk store currently,
      // but if available they'd be drawn here
    }

    // Draw camps
    const party = state.party;
    if (party) {
      for (const member of party.members) {
        // Camp markers would come from S_CAMP_LIST data
      }
    }

    // Draw party members (blue dots)
    if (party) {
      for (const member of party.members) {
        if (member.eid === lp.eid) continue;
        if (member.worldX === undefined || member.worldY === undefined) continue;
        const mcx = Math.floor(member.worldX / WORLD_CHUNK_SIZE);
        const mcy = Math.floor(member.worldY / WORLD_CHUNK_SIZE);
        const mpx = (mcx - minCX) * CHUNK_PX + CHUNK_PX / 2;
        const mpy = (mcy - minCY) * CHUNK_PX + CHUNK_PX / 2;
        ctx.fillStyle = "#44aaff";
        ctx.beginPath();
        ctx.arc(mpx, mpy, 3, 0, Math.PI * 2);
        ctx.fill();
        // Name label
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "7px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(member.name, mpx, mpy - 5);
      }
    }

    // Draw player (pulsing white dot)
    const playerCX = Math.floor(lp.x / WORLD_CHUNK_SIZE);
    const playerCY = Math.floor(lp.y / WORLD_CHUNK_SIZE);
    const ppx = (playerCX - minCX) * CHUNK_PX + CHUNK_PX / 2;
    const ppy = (playerCY - minCY) * CHUNK_PX + CHUNK_PX / 2;
    const pulse = 3 + Math.sin(this.animFrame * 4) * 1.5;
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.arc(ppx, ppy, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ppx, ppy, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
