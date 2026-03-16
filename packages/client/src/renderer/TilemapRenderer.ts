import { Container, Graphics, Sprite } from "pixi.js";
import { TILE_SIZE, TileType, type TileType as TT } from "@madworld/shared";
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

export class TilemapRenderer {
  readonly container = new Container();
  private tiles: TileSprite[] = [];
  private animatedTiles: TileSprite[] = [];
  private animTimer = 0;
  private animFrame = 0;
  private mapWidth = 0;
  private mapHeight = 0;

  setTiles(tileData: TT[][]): void {
    // Clear existing
    this.container.removeChildren();
    this.tiles = [];
    this.animatedTiles = [];

    this.mapHeight = tileData.length;
    this.mapWidth = tileData[0]?.length ?? 0;

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const type = tileData[y][x];
        const textureSet = getTileTextureSet(type);
        if (!textureSet) continue;

        const hash = tileVariantHash(x, y);
        const variantIndex = hash % textureSet.variants.length;
        const texture = textureSet.variants[variantIndex];

        const sprite = new Sprite(texture);
        sprite.x = x * TILE_SIZE;
        sprite.y = y * TILE_SIZE;
        sprite.width = TILE_SIZE;
        sprite.height = TILE_SIZE;

        this.container.addChild(sprite);

        const ts: TileSprite = { sprite, tileType: type, textureSet, variantIndex };
        this.tiles.push(ts);

        if (textureSet.frames) {
          this.animatedTiles.push(ts);
        }
      }
    }

    // Draw edge blending overlays
    this.drawEdgeBlending(tileData);
  }

  private drawEdgeBlending(tileData: TT[][]): void {
    const edgeGfx = new Graphics();
    const STEPS = [0.35, 0.20, 0.08]; // alpha per gradient step

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const type = tileData[y][x];
        const myPri = TILE_PRIORITY[type] ?? 0;
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        // Track which sides have higher-priority neighbors (for corner blending)
        let hasTop = false, hasBottom = false, hasLeft = false, hasRight = false;
        let topColor = 0, bottomColor = 0, leftColor = 0, rightColor = 0;

        const neighbors: [number, number, "top" | "bottom" | "left" | "right"][] = [
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

          // Use pair-specific color if available, else default
          const pairKey = (type << 8) | nType;
          const color = PAIR_EDGE_COLORS[pairKey] ?? EDGE_COLORS[nType];
          if (color === undefined) continue;

          // Track for corner blending
          if (side === "top") { hasTop = true; topColor = color; }
          else if (side === "bottom") { hasBottom = true; bottomColor = color; }
          else if (side === "left") { hasLeft = true; leftColor = color; }
          else { hasRight = true; rightColor = color; }

          // Draw 3-step gradient fade instead of single rect
          for (let step = 0; step < 3; step++) {
            const alpha = STEPS[step];
            let rx: number, ry: number, rw: number, rh: number;

            if (side === "top") {
              rx = px; ry = py + step; rw = TILE_SIZE; rh = 1;
            } else if (side === "bottom") {
              rx = px; ry = py + TILE_SIZE - 1 - step; rw = TILE_SIZE; rh = 1;
            } else if (side === "left") {
              rx = px + step; ry = py; rw = 1; rh = TILE_SIZE;
            } else {
              rx = px + TILE_SIZE - 1 - step; ry = py; rw = 1; rh = TILE_SIZE;
            }

            edgeGfx.rect(rx, ry, rw, rh);
            edgeGfx.fill({ color, alpha });
          }
        }

        // Corner blending: where two perpendicular edges meet
        const corners: [boolean, boolean, number, number, number, number][] = [
          [hasTop, hasLeft, px, py, 1, 1],
          [hasTop, hasRight, px + TILE_SIZE - 3, py, -1, 1],
          [hasBottom, hasLeft, px, py + TILE_SIZE - 3, 1, -1],
          [hasBottom, hasRight, px + TILE_SIZE - 3, py + TILE_SIZE - 3, -1, -1],
        ];

        for (const [sideA, sideB, cx, cy] of corners) {
          if (!sideA || !sideB) continue;
          // Blend the two edge colors (just use the first)
          const cColor = sideA ? topColor || bottomColor : leftColor || rightColor;
          edgeGfx.moveTo(cx, cy);
          edgeGfx.lineTo(cx + 3, cy);
          edgeGfx.lineTo(cx, cy + 3);
          edgeGfx.fill({ color: cColor || 0x333333, alpha: 0.25 });
        }
      }
    }

    this.container.addChild(edgeGfx);
  }

  update(dt: number): void {
    // Animate water/portals
    this.animTimer += dt;
    if (this.animTimer >= 0.8) {
      this.animTimer -= 0.8;
      this.animFrame = (this.animFrame + 1) % 3;

      for (const ts of this.animatedTiles) {
        if (!ts.textureSet.frames) continue;
        const frameVariants = ts.textureSet.frames[this.animFrame];
        if (frameVariants) {
          ts.sprite.texture = frameVariants[ts.variantIndex % frameVariants.length];
        }
      }
    }
  }

  /** Cull tiles outside the viewport for performance */
  cullViewport(left: number, top: number, right: number, bottom: number): void {
    const margin = 2;
    const tLeft = Math.floor(left / TILE_SIZE) - margin;
    const tTop = Math.floor(top / TILE_SIZE) - margin;
    const tRight = Math.ceil(right / TILE_SIZE) + margin;
    const tBottom = Math.ceil(bottom / TILE_SIZE) + margin;

    let idx = 0;
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        if (idx < this.tiles.length) {
          this.tiles[idx].sprite.visible =
            x >= tLeft && x <= tRight && y >= tTop && y <= tBottom;
        }
        idx++;
      }
    }
  }
}
