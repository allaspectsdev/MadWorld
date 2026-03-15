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
};

// Edge blend colors for tiles that should darken/tint adjacent tiles
const EDGE_COLORS: Partial<Record<number, number>> = {
  [TileType.WATER]: 0x1a4a7a,
  [TileType.FOREST]: 0x1a3a15,
  [TileType.MOUNTAIN]: 0x333333,
  [TileType.SAND]: 0x9a9060,
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
    const EDGE_W = 3; // edge overlay width in pixels

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const type = tileData[y][x];
        const myPri = TILE_PRIORITY[type] ?? 0;

        // Check each neighbor (N, S, E, W)
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

          const color = EDGE_COLORS[nType];
          if (color === undefined) continue;

          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;

          edgeGfx.rect(
            side === "right" ? px + TILE_SIZE - EDGE_W : side === "left" ? px : px,
            side === "bottom" ? py + TILE_SIZE - EDGE_W : side === "top" ? py : py,
            side === "left" || side === "right" ? EDGE_W : TILE_SIZE,
            side === "top" || side === "bottom" ? EDGE_W : TILE_SIZE,
          );
          edgeGfx.fill({ color, alpha: 0.35 });
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
