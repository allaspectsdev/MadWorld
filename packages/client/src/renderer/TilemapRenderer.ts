import { Container, Graphics } from "pixi.js";
import { TILE_SIZE, TileType, type TileType as TT } from "@madworld/shared";

// Color mapping for tile types
const TILE_COLORS: Record<number, number> = {
  [TileType.GRASS]: 0x4a7c59,
  [TileType.DIRT]: 0x8b7355,
  [TileType.COBBLESTONE]: 0x808080,
  [TileType.WATER]: 0x3a6ea5,
  [TileType.SAND]: 0xc2b280,
  [TileType.FOREST]: 0x2d5a27,
  [TileType.MOUNTAIN]: 0x696969,
  [TileType.BRIDGE]: 0x8b6914,
  [TileType.BUILDING_FLOOR]: 0xa0522d,
  [TileType.PORTAL]: 0x9b59b6,
};

export class TilemapRenderer {
  readonly container = new Container();
  private graphics = new Graphics();
  private currentTiles: TT[][] | null = null;

  constructor() {
    this.container.addChild(this.graphics);
  }

  setTiles(tiles: TT[][]): void {
    this.currentTiles = tiles;
    this.render();
  }

  private render(): void {
    if (!this.currentTiles) return;

    this.graphics.clear();

    for (let y = 0; y < this.currentTiles.length; y++) {
      const row = this.currentTiles[y];
      for (let x = 0; x < row.length; x++) {
        const tile = row[x];
        const color = TILE_COLORS[tile] ?? 0x333333;
        this.graphics.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        this.graphics.fill(color);
      }
    }

    // Grid lines (subtle)
    this.graphics.setStrokeStyle({ width: 0.5, color: 0x000000, alpha: 0.1 });
    for (let y = 0; y <= this.currentTiles.length; y++) {
      this.graphics.moveTo(0, y * TILE_SIZE);
      this.graphics.lineTo(this.currentTiles[0].length * TILE_SIZE, y * TILE_SIZE);
      this.graphics.stroke();
    }
    for (let x = 0; x <= this.currentTiles[0].length; x++) {
      this.graphics.moveTo(x * TILE_SIZE, 0);
      this.graphics.lineTo(x * TILE_SIZE, this.currentTiles.length * TILE_SIZE);
      this.graphics.stroke();
    }
  }
}
