import { Container, Graphics, Sprite } from "pixi.js";
import { TileType, type TileType as TT } from "@madworld/shared";
import {
  cartToIso,
  isoDepth,
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
  private foamTime = 0;

  setTiles(tileData: TT[][]): void {
    // Clear existing
    this.container.removeChildren();
    this.tiles = [];
    this.animatedTiles = [];

    this.mapHeight = tileData.length;
    this.mapWidth = tileData[0]?.length ?? 0;
    this.tileData = tileData;

    // Enable depth sorting on the container so tiles render back-to-front
    this.container.sortableChildren = true;

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const type = tileData[y][x];
        const textureSet = getTileTextureSet(type);
        if (!textureSet) continue;

        const hash = tileVariantHash(x, y);
        const variantIndex = hash % textureSet.variants.length;
        const texture = textureSet.variants[variantIndex];

        const elevation = tileElevation(type);
        const iso = cartToIso(x, y, elevation);

        const sprite = new Sprite(texture);
        // Position: iso.x is diamond center, iso.y is diamond top-center
        // Anchor at (0.5, 0.5) so the sprite is centered on the diamond
        sprite.anchor.set(0.5, 0.5);
        sprite.x = iso.x;
        sprite.y = iso.y;
        sprite.width = ISO_TILE_W;
        sprite.height = ISO_TILE_H;

        // Depth sort: tiles further from the viewer (higher x+y) render last
        sprite.zIndex = isoDepth(x, y, elevation);

        this.container.addChild(sprite);

        const ts: TileSprite = { sprite, tileType: type, textureSet, variantIndex, cartX: x, cartY: y };
        this.tiles.push(ts);

        if (textureSet.frames) {
          this.animatedTiles.push(ts);
        }
      }
    }

    // Draw edge blending overlays
    this.drawEdgeBlending(tileData);

    // Draw elevation side faces for raised tiles
    this.drawElevationFaces(tileData);

    // Add foam overlay (redrawn each frame)
    this.foamGfx = new Graphics();
    this.foamGfx.zIndex = 999999; // foam on top of tiles
    this.container.addChild(this.foamGfx);
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
          const alphas = [0.30, 0.15, 0.06];
          for (let step = 0; step < 3; step++) {
            const alpha = alphas[step];
            const inset = step * 2; // pixels inward

            if (side === "top") {
              // Top-left edge of diamond
              edgeGfx.moveTo(cx - hw + inset * 2, cy + inset);
              edgeGfx.lineTo(cx, cy - hh + inset);
              edgeGfx.stroke({ width: 1.5, color, alpha });
            } else if (side === "right") {
              // Top-right edge of diamond
              edgeGfx.moveTo(cx, cy - hh + inset);
              edgeGfx.lineTo(cx + hw - inset * 2, cy + inset);
              edgeGfx.stroke({ width: 1.5, color, alpha });
            } else if (side === "bottom") {
              // Bottom-right edge of diamond
              edgeGfx.moveTo(cx + hw - inset * 2, cy - inset);
              edgeGfx.lineTo(cx, cy + hh - inset);
              edgeGfx.stroke({ width: 1.5, color, alpha });
            } else if (side === "left") {
              // Bottom-left edge of diamond
              edgeGfx.moveTo(cx, cy + hh - inset);
              edgeGfx.lineTo(cx - hw + inset * 2, cy - inset);
              edgeGfx.stroke({ width: 1.5, color, alpha });
            }
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

    // Animate water-edge foam
    this.foamTime += dt;
    this.drawFoam();
  }

  private drawFoam(): void {
    const tiles = this.tileData;
    if (tiles.length === 0) return;

    const g = this.foamGfx;
    g.clear();

    const t = this.foamTime;

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const tileType = tiles[y][x];
        if (tileType !== TileType.WATER) continue;

        const iso = cartToIso(x, y);
        const cx = iso.x;
        const cy = iso.y;

        const foamAlpha =
          0.15 + Math.sin(t * 2 + x * 0.5 + y * 0.7) * 0.08;
        const foamOffset =
          Math.sin(t * 1.5 + x * 0.3 + y * 0.5) * 1.5;

        // Draw foam lines along diamond edges adjacent to non-water
        // Top-left edge (neighbor at x, y-1)
        if (y > 0 && tiles[y - 1]?.[x] !== TileType.WATER) {
          g.moveTo(cx - ISO_HALF_W + foamOffset, cy + foamOffset * 0.5);
          g.lineTo(cx + foamOffset * 0.5, cy - ISO_HALF_H + foamOffset);
          g.stroke({ width: 1.5, color: 0xffffff, alpha: foamAlpha });
        }
        // Top-right edge (neighbor at x+1, y)
        if (x < this.mapWidth - 1 && tiles[y]?.[x + 1] !== TileType.WATER) {
          g.moveTo(cx + foamOffset * 0.5, cy - ISO_HALF_H + foamOffset);
          g.lineTo(cx + ISO_HALF_W + foamOffset, cy + foamOffset * 0.5);
          g.stroke({ width: 1.5, color: 0xffffff, alpha: foamAlpha });
        }
        // Bottom-right edge (neighbor at x, y+1)
        if (y < tiles.length - 1 && tiles[y + 1]?.[x] !== TileType.WATER) {
          g.moveTo(cx + ISO_HALF_W + foamOffset, cy + foamOffset * 0.5);
          g.lineTo(cx + foamOffset * 0.5, cy + ISO_HALF_H + foamOffset);
          g.stroke({ width: 1.5, color: 0xffffff, alpha: foamAlpha });
        }
        // Bottom-left edge (neighbor at x-1, y)
        if (x > 0 && tiles[y]?.[x - 1] !== TileType.WATER) {
          g.moveTo(cx + foamOffset * 0.5, cy + ISO_HALF_H + foamOffset);
          g.lineTo(cx - ISO_HALF_W + foamOffset, cy + foamOffset * 0.5);
          g.stroke({ width: 1.5, color: 0xffffff, alpha: foamAlpha });
        }
      }
    }
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
