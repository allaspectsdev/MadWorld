import { Container, Sprite } from "pixi.js";
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
  }

  update(dt: number): void {
    // Animate water/portals
    this.animTimer += dt;
    if (this.animTimer >= 0.5) {
      this.animTimer -= 0.5;
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
