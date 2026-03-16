import { Container, Graphics, Sprite } from "pixi.js";
import { TILE_SIZE, TileType, type TileType as TT } from "@madworld/shared";
import { TextureFactory } from "./TextureFactory.js";

export class DecorationRenderer {
  readonly container = new Container();

  setTiles(tiles: TT[][]): void {
    this.container.removeChildren();

    const rows = tiles.length;
    if (rows === 0) return;
    const cols = tiles[0].length;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const type = tiles[y][x];
        const seed = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        const chance = (seed % 1000) / 1000;

        // 1. Rock cluster — GRASS adjacent to MOUNTAIN or FENCE
        if (
          type === TileType.GRASS &&
          (this.hasNeighbor(tiles, x, y, TileType.MOUNTAIN) ||
            this.hasNeighbor(tiles, x, y, TileType.FENCE))
        ) {
          if (chance < 0.25) {
            this.placeRockCluster(x, y, seed);
          }
          continue;
        }

        // 2. Log / stump — GRASS with FOREST neighbor
        if (
          type === TileType.GRASS &&
          this.hasNeighbor(tiles, x, y, TileType.FOREST)
        ) {
          if (chance < 0.15) {
            this.placeLogOrStump(x, y, seed);
          }
          continue;
        }

        // 3. Barrel / crate — COBBLESTONE adjacent to BUILDING_FLOOR
        if (
          type === TileType.COBBLESTONE &&
          this.hasNeighbor(tiles, x, y, TileType.BUILDING_FLOOR)
        ) {
          if (chance < 0.2) {
            this.placeBarrelOrCrate(x, y, seed);
          }
          continue;
        }

        // 4. Lily pads — WATER adjacent to GRASS or SAND
        if (
          type === TileType.WATER &&
          (this.hasNeighbor(tiles, x, y, TileType.GRASS) ||
            this.hasNeighbor(tiles, x, y, TileType.SAND))
        ) {
          if (chance < 0.2) {
            this.placeLilyPads(x, y, seed);
          }
          continue;
        }

        // 5. Cattails — SAND adjacent to WATER
        if (
          type === TileType.SAND &&
          this.hasNeighbor(tiles, x, y, TileType.WATER)
        ) {
          if (chance < 0.2) {
            this.placeCattails(x, y, seed);
          }
          continue;
        }
      }
    }
  }

  private hasNeighbor(
    tiles: TT[][],
    x: number,
    y: number,
    type: TT,
  ): boolean {
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nx = x + dx,
        ny = y + dy;
      if (
        ny >= 0 &&
        ny < tiles.length &&
        nx >= 0 &&
        nx < tiles[0].length &&
        tiles[ny][nx] === type
      )
        return true;
    }
    return false;
  }

  private seededRand(seed: number, index: number): number {
    const s = ((seed + index * 6337) * 2654435761) >>> 0;
    return (s % 10000) / 10000;
  }

  private placeRockCluster(x: number, y: number, seed: number): void {
    const g = new Graphics();
    const count = 2 + (seed % 2); // 2 or 3 rocks

    for (let i = 0; i < count; i++) {
      const rx = 4 + this.seededRand(seed, i * 3) * 12;
      const ry = 6 + this.seededRand(seed, i * 3 + 1) * 10;
      const size = 2 + this.seededRand(seed, i * 3 + 2) * 2; // 2-4px

      // Shadow below rock
      g.ellipse(rx, ry + size * 0.6, size * 0.8, size * 0.3);
      g.fill({ color: 0x000000, alpha: 0.15 });

      // Rock body
      g.roundRect(rx - size / 2, ry - size / 2, size, size, 1);
      g.fill(0x888888);
      g.roundRect(rx - size / 2, ry - size / 2, size, size, 1);
      g.stroke({ width: 0.5, color: 0x666666, alpha: 0.5 });
      // Rock specular highlight (top-left)
      g.circle(rx - 1, ry - 1, 1);
      g.fill({ color: 0xffffff, alpha: 0.15 });
    }

    const tex = TextureFactory.generate(g, TILE_SIZE, TILE_SIZE);
    const sprite = new Sprite(tex);
    const offsetX = this.seededRand(seed, 10) * 4 - 2;
    const offsetY = this.seededRand(seed, 11) * 4 - 2;
    sprite.x = x * TILE_SIZE + offsetX;
    sprite.y = y * TILE_SIZE + offsetY;
    this.container.addChild(sprite);
  }

  private placeLogOrStump(x: number, y: number, seed: number): void {
    const g = new Graphics();
    const isLog = seed % 2 === 0;

    if (isLog) {
      // Horizontal log: brown rect 8x3 with end circles
      const lx = 8;
      const ly = 12;
      // Ground shadow under log
      g.ellipse(lx + 4, ly + 3, 5, 1.5);
      g.fill({ color: 0x000000, alpha: 0.15 });
      g.roundRect(lx, ly, 8, 3, 1);
      g.fill(0x6b4226);
      g.roundRect(lx, ly, 8, 3, 1);
      g.stroke({ width: 0.5, color: 0x4a2e1a, alpha: 0.4 });
      // End circles (cross-section)
      g.circle(lx, ly + 1.5, 1.5);
      g.fill(0x8b5a3a);
      g.circle(lx, ly + 1.5, 1.5);
      g.stroke({ width: 0.3, color: 0x4a2e1a, alpha: 0.5 });
      g.circle(lx + 8, ly + 1.5, 1.5);
      g.fill(0x8b5a3a);
      g.circle(lx + 8, ly + 1.5, 1.5);
      g.stroke({ width: 0.3, color: 0x4a2e1a, alpha: 0.5 });
    } else {
      // Stump: 4px circle with ring lines
      const sx = 14;
      const sy = 14;
      // Ground shadow under stump
      g.ellipse(sx, sy + 3, 5, 1.5);
      g.fill({ color: 0x000000, alpha: 0.15 });
      g.circle(sx, sy, 4);
      g.fill(0x7b5230);
      g.circle(sx, sy, 4);
      g.stroke({ width: 0.5, color: 0x4a2e1a, alpha: 0.5 });
      // Ring lines
      g.circle(sx, sy, 2.5);
      g.stroke({ width: 0.3, color: 0x5a3a1e, alpha: 0.4 });
      g.circle(sx, sy, 1.2);
      g.stroke({ width: 0.3, color: 0x5a3a1e, alpha: 0.4 });
    }

    const tex = TextureFactory.generate(g, TILE_SIZE, TILE_SIZE);
    const sprite = new Sprite(tex);
    const offsetX = this.seededRand(seed, 10) * 6 - 3;
    const offsetY = this.seededRand(seed, 11) * 6 - 3;
    sprite.x = x * TILE_SIZE + offsetX;
    sprite.y = y * TILE_SIZE + offsetY;
    this.container.addChild(sprite);
  }

  private placeBarrelOrCrate(x: number, y: number, seed: number): void {
    const g = new Graphics();
    const isBarrel = seed % 2 === 0;
    const bx = 12;
    const by = 10;

    if (isBarrel) {
      // Barrel: brown roundRect 5x6 with horizontal bands
      // Ground shadow under barrel
      g.ellipse(bx + 2.5, by + 4, 4, 1.5);
      g.fill({ color: 0x000000, alpha: 0.15 });
      g.roundRect(bx, by, 5, 6, 1.5);
      g.fill(0x8b6914);
      g.roundRect(bx, by, 5, 6, 1.5);
      g.stroke({ width: 0.5, color: 0x5a4008, alpha: 0.5 });
      // Bands
      g.rect(bx, by + 1, 5, 0.8);
      g.fill(0x666666);
      g.rect(bx, by + 4, 5, 0.8);
      g.fill(0x666666);
      // Barrel top-left highlight
      g.rect(bx, by, 5, 1);
      g.fill({ color: 0xffffff, alpha: 0.10 });
    } else {
      // Crate: brown roundRect 5x6 with grid lines
      // Ground shadow under crate
      g.ellipse(bx + 2.5, by + 4, 4, 1.5);
      g.fill({ color: 0x000000, alpha: 0.15 });
      g.roundRect(bx, by, 5, 6, 0.5);
      g.fill(0x9b7924);
      g.roundRect(bx, by, 5, 6, 0.5);
      g.stroke({ width: 0.5, color: 0x5a4008, alpha: 0.5 });
      // Grid lines
      g.moveTo(bx, by + 3);
      g.lineTo(bx + 5, by + 3);
      g.stroke({ width: 0.3, color: 0x5a4008, alpha: 0.4 });
      g.moveTo(bx + 2.5, by);
      g.lineTo(bx + 2.5, by + 6);
      g.stroke({ width: 0.3, color: 0x5a4008, alpha: 0.4 });
      // Crate top edge highlight
      g.rect(bx, by, 5, 1);
      g.fill({ color: 0xffffff, alpha: 0.08 });
      // Crate bottom edge shadow
      g.rect(bx, by + 5, 5, 1);
      g.fill({ color: 0x000000, alpha: 0.08 });
    }

    const tex = TextureFactory.generate(g, TILE_SIZE, TILE_SIZE);
    const sprite = new Sprite(tex);
    const offsetX = this.seededRand(seed, 10) * 6 - 3;
    const offsetY = this.seededRand(seed, 11) * 6 - 3;
    sprite.x = x * TILE_SIZE + offsetX;
    sprite.y = y * TILE_SIZE + offsetY;
    this.container.addChild(sprite);
  }

  private placeLilyPads(x: number, y: number, seed: number): void {
    const g = new Graphics();
    const count = 1 + (seed % 2); // 1 or 2 lily pads

    for (let i = 0; i < count; i++) {
      const px = 8 + this.seededRand(seed, i * 3) * 16;
      const py = 8 + this.seededRand(seed, i * 3 + 1) * 16;
      const radius = 2 + this.seededRand(seed, i * 3 + 2); // 2-3px

      // Dark circle shadow under lily pad
      g.circle(px, py + 0.5, radius + 0.5);
      g.fill({ color: 0x000000, alpha: 0.06 });
      // Green circle
      g.circle(px, py, radius);
      g.fill(0x2a8a2a);
      g.circle(px, py, radius);
      g.stroke({ width: 0.3, color: 0x1a6a1a, alpha: 0.4 });

      // Triangle cut-out (classic lily pad notch)
      g.moveTo(px, py);
      g.lineTo(px + radius, py - radius * 0.5);
      g.lineTo(px + radius, py + radius * 0.5);
      g.closePath();
      g.fill(0x1a4a7a); // Water color to simulate cut
    }

    const tex = TextureFactory.generate(g, TILE_SIZE, TILE_SIZE);
    const sprite = new Sprite(tex);
    const offsetX = this.seededRand(seed, 10) * 4 - 2;
    const offsetY = this.seededRand(seed, 11) * 4 - 2;
    sprite.x = x * TILE_SIZE + offsetX;
    sprite.y = y * TILE_SIZE + offsetY;
    this.container.addChild(sprite);
  }

  private placeCattails(x: number, y: number, seed: number): void {
    const g = new Graphics();
    const cx = 14 + this.seededRand(seed, 0) * 6;
    const cy = 8;

    // Shadow at base of cattail
    g.rect(cx - 1, cy + 6, 3, 1);
    g.fill({ color: 0x000000, alpha: 0.12 });
    // Thin vertical stem
    g.moveTo(cx, cy);
    g.lineTo(cx, cy + 6);
    g.stroke({ width: 1, color: 0x6b5a2a });

    // Dark oval at top (cattail head)
    g.ellipse(cx, cy, 1.2, 2);
    g.fill(0x3a2a1a);

    // Optional second cattail
    if (seed % 3 === 0) {
      const cx2 = cx + 4;
      const cy2 = cy + 1;
      g.moveTo(cx2, cy2);
      g.lineTo(cx2, cy2 + 5);
      g.stroke({ width: 1, color: 0x6b5a2a });
      g.ellipse(cx2, cy2, 1, 1.8);
      g.fill(0x3a2a1a);
    }

    const tex = TextureFactory.generate(g, TILE_SIZE, TILE_SIZE);
    const sprite = new Sprite(tex);
    const offsetX = this.seededRand(seed, 10) * 4 - 2;
    const offsetY = this.seededRand(seed, 11) * 4 - 2;
    sprite.x = x * TILE_SIZE + offsetX;
    sprite.y = y * TILE_SIZE + offsetY;
    this.container.addChild(sprite);
  }
}
