import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { TileType, type TileType as TT } from "@madworld/shared";
import {
  cartToIso,
  isoDepth,
  isoToCart,
  isoViewBounds,
  ISO_TILE_W,
  ISO_TILE_H,
  ISO_HALF_W,
  ISO_HALF_H,
  ELEVATION_PX,
} from "@madworld/shared";
import {
  getTileTextureSet,
  tileVariantHash,
  type TileTextureSet,
} from "./TileTextures.js";

interface TileSprite {
  sprite: Sprite;
  tileType: TT;
  textureSet: TileTextureSet;
  variantIndex: number;
  cartX: number;
  cartY: number;
}

// Tile type "priority" for edge blending — higher priority tiles draw edges over lower
const TILE_PRIORITY: Partial<Record<number, number>> = {
  [TileType.WATER]: 5,
  [TileType.FOREST]: 4,
  [TileType.MOUNTAIN]: 4,
  [TileType.SAND]: 3,
  [TileType.COBBLESTONE]: 2,
  [TileType.DIRT]: 1,
  [TileType.FENCE]: 3,
};

// Default edge blend colors (used when no pair-specific color exists)
const EDGE_COLORS: Partial<Record<number, number>> = {
  [TileType.WATER]: 0x1a4a7a,
  [TileType.FOREST]: 0x1a3a15,
  [TileType.MOUNTAIN]: 0x333333,
  [TileType.SAND]: 0x9a9060,
  [TileType.FENCE]: 0x5a4020,
};

// Pair-specific edge colors: `(myType << 8) | neighborType` → color
const PAIR_EDGE_COLORS: Record<number, number> = {
  [(TileType.GRASS << 8) | TileType.WATER]: 0x2a5a7a,
  [(TileType.DIRT << 8) | TileType.WATER]: 0x4a5a6a,
  [(TileType.GRASS << 8) | TileType.DIRT]: 0x5a6a40,
  [(TileType.GRASS << 8) | TileType.FOREST]: 0x1e4a1e,
  [(TileType.SAND << 8) | TileType.WATER]: 0x3a6080,
  [(TileType.GRASS << 8) | TileType.SAND]: 0x7a9060,
  [(TileType.GRASS << 8) | TileType.MOUNTAIN]: 0x4a5a4a,
  [(TileType.DIRT << 8) | TileType.FOREST]: 0x3a4a28,
};

/** Rich base colors for smooth terrain rendering. Each type maps to [R, G, B]. */
const TERRAIN_RGB: Partial<Record<number, [number, number, number]>> = {
  [TileType.GRASS]:          [58, 138, 69],
  [TileType.DIRT]:           [138, 104, 66],
  [TileType.COBBLESTONE]:    [120, 115, 110],
  [TileType.WATER]:          [26, 85, 136],
  [TileType.SAND]:           [194, 178, 128],
  [TileType.FOREST]:         [26, 51, 24],
  [TileType.MOUNTAIN]:       [88, 88, 88],
  [TileType.BRIDGE]:         [139, 105, 20],
  [TileType.BUILDING_FLOOR]: [130, 100, 65],
  [TileType.PORTAL]:         [155, 89, 182],
  [TileType.DUNGEON_PORTAL]: [180, 50, 50],
  [TileType.FENCE]:          [90, 64, 32],
};

const DEFAULT_RGB: [number, number, number] = [60, 60, 60];

/** Height map: some tile types sit at a higher elevation. */
function tileElevation(type: TT): number {
  switch (type) {
    case TileType.MOUNTAIN: return 1;
    case TileType.FENCE: return 1;
    default: return 0;
  }
}

export class TilemapRenderer {
  readonly container = new Container();
  private tiles: TileSprite[] = [];
  private animatedTiles: TileSprite[] = [];
  private animTimer = 0;
  private animFrame = 0;
  mapWidth = 0;
  mapHeight = 0;
  private tileData: TT[][] = [];
  private foamGfx = new Graphics();
  private shimmerGfx = new Graphics();
  private shadingGfx = new Graphics();
  private foamTime = 0;
  private sunDirection = 0.3; // 0-1 sweeps left to right across tiles
  private lastShadingDir = -1; // track to avoid redundant redraws

  setTiles(tileData: TT[][]): void {
    // Clear existing
    this.container.removeChildren();
    this.tiles = [];
    this.animatedTiles = [];

    this.mapHeight = tileData.length;
    this.mapWidth = tileData[0]?.length ?? 0;
    this.tileData = tileData;

    this.container.sortableChildren = true;

    // === SMOOTH CANVAS TERRAIN ===
    // Render terrain as a single smooth canvas with bilinear color blending
    // This eliminates the visible diamond grid entirely

    // Calculate isometric bounds
    const topLeft = cartToIso(0, 0);
    const topRight = cartToIso(this.mapWidth, 0);
    const bottomLeft = cartToIso(0, this.mapHeight);
    const bottomRight = cartToIso(this.mapWidth, this.mapHeight);

    const minX = Math.floor(Math.min(topLeft.x, bottomLeft.x) - ISO_HALF_W);
    const maxX = Math.ceil(Math.max(topRight.x, bottomRight.x) + ISO_HALF_W);
    const minY = Math.floor(Math.min(topLeft.y, topRight.y) - ISO_HALF_H);
    const maxY = Math.ceil(Math.max(bottomLeft.y, bottomRight.y) + ISO_HALF_H);

    const canvasW = maxX - minX;
    const canvasH = maxY - minY;

    // Render at 3/4 resolution for smooth edges with good performance
    const scale = 0.75;
    const cw = Math.ceil(canvasW * scale);
    const ch = Math.ceil(canvasH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;

    // Simple seeded noise for terrain variation
    const noise = (x: number, y: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    // Sample tile color with bilinear blending from neighbors
    const sampleColor = (cx: number, cy: number): [number, number, number] | null => {
      const tx = Math.floor(cx);
      const ty = Math.floor(cy);
      const fx = cx - tx;
      const fy = cy - ty;

      // Sample 4 corners
      const getCol = (x: number, y: number): [number, number, number] | null => {
        if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) return null;
        return TERRAIN_RGB[tileData[y][x]] ?? DEFAULT_RGB;
      };

      const c00 = getCol(tx, ty);
      const c10 = getCol(tx + 1, ty);
      const c01 = getCol(tx, ty + 1);
      const c11 = getCol(tx + 1, ty + 1);

      if (!c00) return null;

      // Bilinear interpolation
      const blend = (a: [number, number, number], b: [number, number, number] | null, t: number): [number, number, number] => {
        if (!b) return a;
        return [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
          a[2] + (b[2] - a[2]) * t,
        ];
      };

      const top = blend(c00, c10, fx);
      const bot = blend(c01 ?? c00, c11 ?? (c10 ?? c00), fx);
      return blend(top, bot, fy);
    };

    // Draw each pixel
    const imageData = ctx.createImageData(cw, ch);
    const pixels = imageData.data;

    for (let py = 0; py < ch; py++) {
      for (let px = 0; px < cw; px++) {
        // Convert pixel position back to iso space, then to cartesian
        const isoX = minX + px / scale;
        const isoY = minY + py / scale;
        const cart = isoToCart(isoX, isoY);

        const color = sampleColor(cart.x, cart.y);
        if (!color) continue;

        // Add subtle noise for organic variation
        const n = noise(cart.x * 3.7, cart.y * 3.7) * 16 - 8;

        const idx = (py * cw + px) * 4;
        pixels[idx]     = Math.max(0, Math.min(255, color[0] + n));
        pixels[idx + 1] = Math.max(0, Math.min(255, color[1] + n));
        pixels[idx + 2] = Math.max(0, Math.min(255, color[2] + n));
        pixels[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Scale up to full resolution with smoothing (bilinear filter)
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = canvasW;
    fullCanvas.height = canvasH;
    const fullCtx = fullCanvas.getContext("2d")!;
    fullCtx.imageSmoothingEnabled = true;
    fullCtx.imageSmoothingQuality = "high";
    fullCtx.drawImage(canvas, 0, 0, canvasW, canvasH);

    // Convert to PixiJS sprite
    const terrainTexture = Texture.from(fullCanvas);
    const terrainSprite = new Sprite(terrainTexture);
    terrainSprite.x = minX;
    terrainSprite.y = minY;
    terrainSprite.zIndex = -10;
    this.container.addChild(terrainSprite);

    // Water and portals still need per-tile animation frames,
    // but we render them as diamonds clipped to the smooth terrain style
    // so they don't stick out as blocky tiles.
    // (They're already part of the smooth canvas above — skip individual sprites)

    // Draw elevation side faces for raised tiles
    this.drawElevationFaces(tileData);

    // Add foam overlay (redrawn each frame)
    this.foamGfx = new Graphics();
    this.foamGfx.zIndex = 999999;
    this.container.addChild(this.foamGfx);

    // Add water shimmer overlay
    this.shimmerGfx = new Graphics();
    this.shimmerGfx.zIndex = 999998;
    this.container.addChild(this.shimmerGfx);

    // Shading graphics (unused but kept for API compat)
    this.shadingGfx = new Graphics();
    this.shadingGfx.zIndex = 999996;
    this.container.addChild(this.shadingGfx);
  }

  private drawEdgeBlending(tileData: TT[][]): void {
    const edgeGfx = new Graphics();
    edgeGfx.zIndex = 999998; // above tiles, below foam

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const type = tileData[y][x];
        const myPri = TILE_PRIORITY[type] ?? 0;
        const elevation = tileElevation(type);
        const iso = cartToIso(x, y, elevation);

        const neighbors: [number, number, string][] = [
          [x, y - 1, "top"],
          [x, y + 1, "bottom"],
          [x - 1, y, "left"],
          [x + 1, y, "right"],
        ];

        for (const [nx, ny, side] of neighbors) {
          if (nx < 0 || nx >= this.mapWidth || ny < 0 || ny >= this.mapHeight) continue;
          const nType = tileData[ny][nx];
          if (nType === type) continue;

          const nPri = TILE_PRIORITY[nType] ?? 0;
          if (nPri <= myPri) continue;

          const pairKey = (type << 8) | nType;
          const color = PAIR_EDGE_COLORS[pairKey] ?? EDGE_COLORS[nType];
          if (color === undefined) continue;

          // Draw a subtle gradient line along the edge of the diamond
          // In isometric, edges run diagonally. We'll draw a thin line on
          // the relevant half of the diamond.
          const hw = ISO_HALF_W;
          const hh = ISO_HALF_H;
          const cx = iso.x;
          const cy = iso.y;

          // Diamond corners: top=(cx, cy-hh), right=(cx+hw, cy), bottom=(cx, cy+hh), left=(cx-hw, cy)
          // Draw filled gradient triangles for wide, soft blending
          if (side === "top") {
            // Fill top-left quadrant of diamond
            edgeGfx.moveTo(cx - hw, cy);
            edgeGfx.lineTo(cx, cy - hh);
            edgeGfx.lineTo(cx, cy);
            edgeGfx.closePath();
            edgeGfx.fill({ color, alpha: 0.18 });
          } else if (side === "right") {
            // Fill top-right quadrant
            edgeGfx.moveTo(cx, cy - hh);
            edgeGfx.lineTo(cx + hw, cy);
            edgeGfx.lineTo(cx, cy);
            edgeGfx.closePath();
            edgeGfx.fill({ color, alpha: 0.18 });
          } else if (side === "bottom") {
            // Fill bottom-right quadrant
            edgeGfx.moveTo(cx + hw, cy);
            edgeGfx.lineTo(cx, cy + hh);
            edgeGfx.lineTo(cx, cy);
            edgeGfx.closePath();
            edgeGfx.fill({ color, alpha: 0.18 });
          } else if (side === "left") {
            // Fill bottom-left quadrant
            edgeGfx.moveTo(cx, cy + hh);
            edgeGfx.lineTo(cx - hw, cy);
            edgeGfx.lineTo(cx, cy);
            edgeGfx.closePath();
            edgeGfx.fill({ color, alpha: 0.18 });
          }
        }
      }
    }

    this.container.addChild(edgeGfx);
  }

  /** Draw visible "side faces" for elevated tiles (mountains, fences). */
  private drawElevationFaces(tileData: TT[][]): void {
    const faceGfx = new Graphics();
    // Elevation faces should render just behind the top surface
    faceGfx.zIndex = 999997;

    const ELEVATED = new Set([TileType.MOUNTAIN, TileType.FENCE]);

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const type = tileData[y][x];
        if (!ELEVATED.has(type)) continue;

        const elev = tileElevation(type);
        const iso = cartToIso(x, y, elev);
        const isoBase = cartToIso(x, y, 0);

        const hw = ISO_HALF_W;
        const hh = ISO_HALF_H;
        const drop = elev * ELEVATION_PX;

        // Draw south-facing side (bottom-left edge, visible to viewer)
        // From diamond's left corner down to base, across to bottom corner down to base
        faceGfx.moveTo(iso.x - hw, iso.y);            // left corner (elevated)
        faceGfx.lineTo(iso.x, iso.y + hh);             // bottom corner (elevated)
        faceGfx.lineTo(isoBase.x, isoBase.y + hh);     // bottom corner (ground)
        faceGfx.lineTo(isoBase.x - hw, isoBase.y);     // left corner (ground)
        faceGfx.closePath();
        faceGfx.fill({ color: 0x555555, alpha: 0.6 });

        // Draw east-facing side (bottom-right edge)
        faceGfx.moveTo(iso.x, iso.y + hh);             // bottom corner (elevated)
        faceGfx.lineTo(iso.x + hw, iso.y);             // right corner (elevated)
        faceGfx.lineTo(isoBase.x + hw, isoBase.y);     // right corner (ground)
        faceGfx.lineTo(isoBase.x, isoBase.y + hh);     // bottom corner (ground)
        faceGfx.closePath();
        faceGfx.fill({ color: 0x444444, alpha: 0.5 });
      }
    }

    this.container.addChild(faceGfx);
  }

  update(dt: number): void {
    // Animate water/portals
    this.animTimer += dt;
    if (this.animTimer >= 0.5) {
      this.animTimer -= 0.5;
      this.animFrame = (this.animFrame + 1) % 6;

      for (const ts of this.animatedTiles) {
        if (!ts.textureSet.frames) continue;
        const frameVariants = ts.textureSet.frames[this.animFrame];
        if (frameVariants) {
          ts.sprite.texture = frameVariants[ts.variantIndex % frameVariants.length];
        }
      }
    }

    // Animate water-edge foam, shimmer, and wave overlay
    this.foamTime += dt;
    this.drawFoam();
    this.drawWaterShimmer();
    this.drawWaterWaves();
  }

  private drawFoam(): void {
    const tiles = this.tileData;
    if (tiles.length === 0) return;

    const g = this.foamGfx;
    g.clear();

    const t = this.foamTime;

    // Draw subtle foam dots at water-land boundary (not diamond-edge lines)
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        if (tiles[y][x] !== TileType.WATER) continue;

        // Check if this water tile is adjacent to land
        let isEdge = false;
        for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= this.mapWidth || ny < 0 || ny >= this.mapHeight) { isEdge = true; break; }
          if (tiles[ny][nx] !== TileType.WATER) { isEdge = true; break; }
        }
        if (!isEdge) continue;

        const iso = cartToIso(x, y);
        // Scatter a few foam dots at the edge (not along diamond lines)
        for (let i = 0; i < 3; i++) {
          const seed = ((x * 73856 + y * 19349 + i * 6337) >>> 0) % 10000 / 10000;
          const seed2 = ((x * 45678 + y * 98765 + i * 1234) >>> 0) % 10000 / 10000;
          const fx = iso.x + (seed - 0.5) * ISO_TILE_W * 0.5;
          const fy = iso.y + (seed2 - 0.5) * ISO_TILE_H * 0.5;
          const foamPulse = 0.15 + Math.sin(t * 2 + seed * 10) * 0.08;
          const foamSize = 1.5 + Math.sin(t * 1.5 + seed2 * 8) * 0.5;

          g.circle(fx, fy, foamSize);
          g.fill({ color: 0xffffff, alpha: foamPulse });
        }
      }
    }
  }

  /** Set sun direction for directional tile shading (0=dawn/east, 0.5=noon, 1=dusk/west). */
  setSunDirection(timeOfDay: number): void {
    // Map time of day (0-24) to sun direction (0-1)
    if (timeOfDay < 15) {
      this.sunDirection = timeOfDay / 15; // 0 → 1 through the day
    } else {
      this.sunDirection = 0.5; // Night: neutral
    }
  }

  /** Per-tile directional shading that makes terrain appear 3D. */
  private drawDirectionalShading(): void {
    const tiles = this.tileData;
    if (tiles.length === 0) return;

    // Only redraw when sun direction changes significantly (saves perf)
    const quantized = Math.round(this.sunDirection * 20) / 20;
    if (quantized === this.lastShadingDir) return;
    this.lastShadingDir = quantized;

    const g = this.shadingGfx;
    g.clear();

    const hw = ISO_HALF_W;
    const hh = ISO_HALF_H;
    // Sun comes from upper-left (dawn) to upper-right (dusk)
    // Highlight faces pointing toward sun, darken faces away
    const highlightAlpha = 0.06;
    const shadowAlpha = 0.10;
    const sunX = this.sunDirection; // 0=left, 1=right

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const type = tiles[y][x];
        if (type === TileType.WATER) continue; // Water has its own shimmer

        const elevation = tileElevation(type);
        const iso = cartToIso(x, y, elevation);
        const cx = iso.x;
        const cy = iso.y;

        // Top-left face of diamond (lit when sun is from left)
        const topLeftAlpha = highlightAlpha * (1 - sunX);
        if (topLeftAlpha > 0.01) {
          g.moveTo(cx - hw, cy);
          g.lineTo(cx, cy - hh);
          g.lineTo(cx, cy);
          g.closePath();
          g.fill({ color: 0xffffff, alpha: topLeftAlpha });
        }

        // Top-right face (lit when sun is from right)
        const topRightAlpha = highlightAlpha * sunX;
        if (topRightAlpha > 0.01) {
          g.moveTo(cx, cy - hh);
          g.lineTo(cx + hw, cy);
          g.lineTo(cx, cy);
          g.closePath();
          g.fill({ color: 0xffffff, alpha: topRightAlpha });
        }

        // Bottom-left face (shadow when sun is from right)
        const botLeftAlpha = shadowAlpha * sunX;
        if (botLeftAlpha > 0.01) {
          g.moveTo(cx - hw, cy);
          g.lineTo(cx, cy);
          g.lineTo(cx, cy + hh);
          g.closePath();
          g.fill({ color: 0x000000, alpha: botLeftAlpha });
        }

        // Bottom-right face (shadow when sun is from left)
        const botRightAlpha = shadowAlpha * (1 - sunX);
        if (botRightAlpha > 0.01) {
          g.moveTo(cx, cy);
          g.lineTo(cx + hw, cy);
          g.lineTo(cx, cy + hh);
          g.closePath();
          g.fill({ color: 0x000000, alpha: botRightAlpha });
        }
      }
    }
  }

  /** Draw animated wave lines and specular highlights over water areas. */
  private drawWaterWaves(): void {
    const tiles = this.tileData;
    if (tiles.length === 0) return;

    const t = this.foamTime;
    const fg = this.foamGfx;

    // Draw long continuous wave lines that span the whole water body
    // instead of per-tile waves that create a grid pattern
    for (let waveIdx = 0; waveIdx < 12; waveIdx++) {
      const wavePhase = t * 1.2 + waveIdx * 2.1;
      // Each wave sweeps diagonally across the map (isometric direction)
      const baseOffset = waveIdx * 18 + Math.sin(wavePhase * 0.3) * 8;

      // Scan rows to find contiguous water stretches
      for (let y = 0; y < this.mapHeight; y++) {
        let startX = -1;
        for (let x = 0; x <= this.mapWidth; x++) {
          const isWater = x < this.mapWidth && tiles[y][x] === TileType.WATER;
          if (isWater && startX === -1) {
            startX = x;
          } else if (!isWater && startX !== -1) {
            // Draw a wave line across this water stretch
            const waveRow = (y * ISO_HALF_H + baseOffset) % (this.mapHeight * ISO_HALF_H);
            if (Math.abs(waveRow - y * ISO_HALF_H) < ISO_HALF_H) {
              const isoStart = cartToIso(startX, y);
              const isoEnd = cartToIso(x - 1, y);
              const waveY = (isoStart.y + isoEnd.y) / 2;
              const alpha = 0.08 + Math.sin(wavePhase + y * 0.3) * 0.04;

              fg.moveTo(isoStart.x, waveY + Math.sin(wavePhase + startX * 0.5) * 2);
              for (let wx = startX; wx < x; wx++) {
                const wIso = cartToIso(wx + 0.5, y);
                fg.lineTo(wIso.x, waveY + Math.sin(wavePhase + wx * 0.5) * 2.5);
              }
              fg.stroke({ width: 1.2, color: 0x88ccee, alpha });
            }
            startX = -1;
          }
        }
      }
    }

    // Scattered specular highlights (not per-tile — random positions across water)
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        if (tiles[y][x] !== TileType.WATER) continue;
        // Only ~15% of water tiles get a highlight each frame
        const sparkleChance = Math.sin(t * 2.3 + x * 7.7 + y * 13.3);
        if (sparkleChance < 0.7) continue;

        const iso = cartToIso(x, y);
        const hx = iso.x + Math.sin(t * 0.8 + x * 1.3) * ISO_HALF_W * 0.3;
        const hy = iso.y + Math.cos(t * 0.6 + y * 1.1) * ISO_HALF_H * 0.3;
        const brightness = (sparkleChance - 0.7) / 0.3;
        fg.circle(hx, hy, 1.5 + brightness);
        fg.fill({ color: 0xffffff, alpha: brightness * 0.25 });
      }
    }

    // Animated portal glow
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const type = tiles[y][x];
        if (type !== TileType.PORTAL && type !== TileType.DUNGEON_PORTAL) continue;

        const iso = cartToIso(x, y);
        const cx = iso.x;
        const cy = iso.y;
        const color = type === TileType.PORTAL ? 0x9b59b6 : 0xe74c3c;
        const pulse = 0.2 + Math.sin(t * 2.5 + x + y) * 0.1;

        // Pulsing glow circle
        this.foamGfx.circle(cx, cy, ISO_HALF_H * 0.8);
        this.foamGfx.fill({ color, alpha: pulse });
        this.foamGfx.circle(cx, cy, ISO_HALF_H * 0.5);
        this.foamGfx.fill({ color: 0xffffff, alpha: pulse * 0.4 });

        // Rotating ring particles
        for (let i = 0; i < 4; i++) {
          const angle = t * 1.5 + (i / 4) * Math.PI * 2;
          const rx = cx + Math.cos(angle) * ISO_HALF_H * 0.6;
          const ry = cy + Math.sin(angle) * ISO_HALF_H * 0.3;
          this.foamGfx.circle(rx, ry, 1.5);
          this.foamGfx.fill({ color: 0xffffff, alpha: pulse * 0.6 });
        }
      }
    }
  }

  /** Water shimmer is now handled by drawWaterWaves(). */
  private drawWaterShimmer(): void {
    this.shimmerGfx.clear();
  }

  /** Cull tiles outside the viewport for performance. */
  cullViewport(left: number, top: number, right: number, bottom: number): void {
    // Compute cartesian tile bounds from iso-pixel viewport
    const bounds = isoViewBounds(left, top, right, bottom, this.mapWidth, this.mapHeight, 3);

    for (const ts of this.tiles) {
      ts.sprite.visible =
        ts.cartX >= bounds.minX && ts.cartX <= bounds.maxX &&
        ts.cartY >= bounds.minY && ts.cartY <= bounds.maxY;
    }
  }
}
