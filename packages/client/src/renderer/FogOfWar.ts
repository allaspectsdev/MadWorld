/**
 * Fog-of-war overlay for undiscovered chunks.
 *
 * Renders a dark overlay over the entire map, with holes cut out
 * for discovered chunks. Uses a Graphics object that is updated
 * when discoveries change, not every frame.
 */

import { Container, Graphics } from "pixi.js";
import {
  cartToIso,
  isoDepth,
  WORLD_CHUNK_SIZE,
  ISO_HALF_W,
  ISO_HALF_H,
} from "@madworld/shared";

export class FogOfWar {
  readonly container = new Container();
  private fogGfx = new Graphics();
  private discovered = new Set<string>();
  private dirty = true;

  // Viewport bounds for determining render area
  private viewMinCX = 0;
  private viewMaxCX = 0;
  private viewMinCY = 0;
  private viewMaxCY = 0;

  constructor() {
    this.fogGfx.zIndex = 1000000; // on top of everything in the camera container
    this.container.addChild(this.fogGfx);
  }

  /** Initialize with full set of discovered chunks from server. */
  setDiscoveries(chunks: string[]): void {
    this.discovered = new Set(chunks);
    this.dirty = true;
  }

  /** Add newly discovered chunks (from S_DISCOVERY_UPDATE). */
  addDiscoveries(chunks: string[]): void {
    for (const key of chunks) {
      this.discovered.add(key);
    }
    this.dirty = true;
  }

  /** Check if a chunk has been discovered. */
  isDiscovered(cx: number, cy: number): boolean {
    return this.discovered.has(`${cx},${cy}`);
  }

  /** Update the viewport bounds for efficient rendering. */
  setViewBounds(minCX: number, minCY: number, maxCX: number, maxCY: number): void {
    if (minCX !== this.viewMinCX || minCY !== this.viewMinCY ||
        maxCX !== this.viewMaxCX || maxCY !== this.viewMaxCY) {
      this.viewMinCX = minCX;
      this.viewMinCY = minCY;
      this.viewMaxCX = maxCX;
      this.viewMaxCY = maxCY;
      this.dirty = true;
    }
  }

  /** Redraw the fog overlay if discoveries or viewport changed. */
  update(): void {
    if (!this.dirty) return;
    this.dirty = false;

    const g = this.fogGfx;
    g.clear();

    const S = WORLD_CHUNK_SIZE;
    const margin = 2; // extra chunks outside viewport to avoid pop-in

    // Draw fog (dark rectangles) for each undiscovered chunk in view range
    for (let cy = this.viewMinCY - margin; cy <= this.viewMaxCY + margin; cy++) {
      for (let cx = this.viewMinCX - margin; cx <= this.viewMaxCX + margin; cx++) {
        if (this.discovered.has(`${cx},${cy}`)) continue;

        // Draw an isometric diamond covering this chunk
        const baseX = cx * S;
        const baseY = cy * S;

        // Get the four corners of the chunk in iso space
        const topLeft = cartToIso(baseX, baseY);
        const topRight = cartToIso(baseX + S, baseY);
        const bottomRight = cartToIso(baseX + S, baseY + S);
        const bottomLeft = cartToIso(baseX, baseY + S);

        // Draw filled polygon covering the chunk
        g.moveTo(topLeft.x, topLeft.y);
        g.lineTo(topRight.x, topRight.y);
        g.lineTo(bottomRight.x, bottomRight.y);
        g.lineTo(bottomLeft.x, bottomLeft.y);
        g.closePath();
        g.fill({ color: 0x0a0a15, alpha: 0.92 });
      }
    }

    // Draw soft edges at discovery boundaries
    for (let cy = this.viewMinCY - margin; cy <= this.viewMaxCY + margin; cy++) {
      for (let cx = this.viewMinCX - margin; cx <= this.viewMaxCX + margin; cx++) {
        if (!this.discovered.has(`${cx},${cy}`)) continue;

        // Check if any neighbor is undiscovered — draw edge fade
        const neighbors = [
          [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (this.discovered.has(`${nx},${ny}`)) continue;

          // Draw a subtle gradient at this edge
          const baseX = cx * S;
          const baseY = cy * S;

          // Determine which edge faces the undiscovered neighbor
          if (nx < cx) {
            // Left edge fade
            const top = cartToIso(baseX, baseY);
            const bottom = cartToIso(baseX, baseY + S);
            const inTop = cartToIso(baseX + 4, baseY + 2);
            const inBottom = cartToIso(baseX + 4, baseY + S - 2);
            g.moveTo(top.x, top.y);
            g.lineTo(inTop.x, inTop.y);
            g.lineTo(inBottom.x, inBottom.y);
            g.lineTo(bottom.x, bottom.y);
            g.closePath();
            g.fill({ color: 0x0a0a15, alpha: 0.4 });
          } else if (nx > cx) {
            // Right edge
            const top = cartToIso(baseX + S, baseY);
            const bottom = cartToIso(baseX + S, baseY + S);
            const inTop = cartToIso(baseX + S - 4, baseY + 2);
            const inBottom = cartToIso(baseX + S - 4, baseY + S - 2);
            g.moveTo(top.x, top.y);
            g.lineTo(inTop.x, inTop.y);
            g.lineTo(inBottom.x, inBottom.y);
            g.lineTo(bottom.x, bottom.y);
            g.closePath();
            g.fill({ color: 0x0a0a15, alpha: 0.4 });
          } else if (ny < cy) {
            // Top edge
            const left = cartToIso(baseX, baseY);
            const right = cartToIso(baseX + S, baseY);
            const inLeft = cartToIso(baseX + 2, baseY + 4);
            const inRight = cartToIso(baseX + S - 2, baseY + 4);
            g.moveTo(left.x, left.y);
            g.lineTo(right.x, right.y);
            g.lineTo(inRight.x, inRight.y);
            g.lineTo(inLeft.x, inLeft.y);
            g.closePath();
            g.fill({ color: 0x0a0a15, alpha: 0.4 });
          } else {
            // Bottom edge
            const left = cartToIso(baseX, baseY + S);
            const right = cartToIso(baseX + S, baseY + S);
            const inLeft = cartToIso(baseX + 2, baseY + S - 4);
            const inRight = cartToIso(baseX + S - 2, baseY + S - 4);
            g.moveTo(left.x, left.y);
            g.lineTo(right.x, right.y);
            g.lineTo(inRight.x, inRight.y);
            g.lineTo(inLeft.x, inLeft.y);
            g.closePath();
            g.fill({ color: 0x0a0a15, alpha: 0.4 });
          }
        }
      }
    }
  }
}
