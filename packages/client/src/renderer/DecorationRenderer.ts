import { Container, Graphics, Sprite } from "pixi.js";
import { TILE_SIZE, TileType, type TileType as TT, cartToIso, isoDepth, ISO_TILE_W, ISO_TILE_H } from "@madworld/shared";
import { TextureFactory } from "./TextureFactory.js";

export class DecorationRenderer {
  readonly container = new Container();

  /** Place a decoration sprite at the given tile position in isometric space. */
  private placeSprite(sprite: Sprite, x: number, y: number, offsetX = 0, offsetY = 0): void {
    const iso = cartToIso(x, y);
    sprite.anchor.set(0.5, 0.5);
    sprite.x = iso.x + offsetX;
    sprite.y = iso.y + offsetY;
    sprite.zIndex = isoDepth(x, y) + 0.0001; // slightly above tile
    this.container.addChild(sprite);
  }

  setTiles(tiles: TT[][]): void {
    this.container.removeChildren();
    this.container.sortableChildren = true;

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
          if (chance < 0.40) {
            this.placeRockCluster(x, y, seed);
          }
          continue;
        }

        // 2. Log / stump — GRASS with FOREST neighbor
        if (
          type === TileType.GRASS &&
          this.hasNeighbor(tiles, x, y, TileType.FOREST)
        ) {
          if (chance < 0.30) {
            this.placeLogOrStump(x, y, seed);
          } else if (chance >= 0.30 && chance < 0.45) {
            this.placeMushroomCluster(x, y, seed);
          }
          continue;
        }

        // 3. Barrel / crate — COBBLESTONE adjacent to BUILDING_FLOOR
        if (
          type === TileType.COBBLESTONE &&
          this.hasNeighbor(tiles, x, y, TileType.BUILDING_FLOOR)
        ) {
          if (chance < 0.35) {
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
          if (chance < 0.35) {
            this.placeLilyPads(x, y, seed);
          }
          continue;
        }

        // 5. Cattails — SAND adjacent to WATER
        if (
          type === TileType.SAND &&
          this.hasNeighbor(tiles, x, y, TileType.WATER)
        ) {
          if (chance < 0.30) {
            this.placeCattails(x, y, seed);
          }
          continue;
        }

        // 5b. Small rocks/shells on sand tiles (not near water)
        if (type === TileType.SAND && !this.hasNeighbor(tiles, x, y, TileType.WATER) && chance >= 0.80 && chance < 0.92) {
          this.placeSandRocks(x, y, seed);
        }

        // 6. Wildflowers on plain grass tiles (sparse — 8% of tiles)
        if (type === TileType.GRASS && chance >= 0.88 && chance < 0.96) {
          this.placeWildflowers(x, y, seed);
        }

        // 7. Tall grass on plain grass tiles (4% of tiles)
        if (type === TileType.GRASS && chance >= 0.96) {
          this.placeTallGrass(x, y, seed);
        }

        // Fallen leaves near forest
        if (type === TileType.GRASS && this.hasNeighbor(tiles, x, y, TileType.FOREST) && chance >= 0.45 && chance < 0.60) {
          this.placeFallenLeaves(x, y, seed);
        }

        // 8. Pebble scatter on plain dirt
        if (type === TileType.DIRT && chance >= 0.70 && chance < 0.85) {
          this.placePebbleScatter(x, y, seed);
        }

        // Torch stand near buildings
        if (type === TileType.COBBLESTONE && this.hasNeighbor(tiles, x, y, TileType.BUILDING_FLOOR) && chance >= 0.35 && chance < 0.50) {
          this.placeTorchStand(x, y, seed);
        }

        // 9. Tall trees on forest tiles — gives vertical 3D height
        if (type === TileType.FOREST && chance < 0.55) {
          this.placeTallTree(x, y, seed);
        }

        // 10. Building wall faces on building_floor tiles
        if (type === TileType.BUILDING_FLOOR && chance < 0.30) {
          this.placeBuildingPost(x, y, seed);
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
      // Upper-left lighter face
      g.roundRect(rx - size / 2, ry - size / 2, size * 0.6, size * 0.6, 1);
      g.fill({ color: 0xaaaaaa, alpha: 0.15 });
    }

    const tex = TextureFactory.generate(g, TILE_SIZE, TILE_SIZE);
    const sprite = new Sprite(tex);
    const offsetX = this.seededRand(seed, 10) * 4 - 2;
    const offsetY = this.seededRand(seed, 11) * 4 - 2;
    this.placeSprite(sprite, x, y, offsetX, offsetY);
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
    this.placeSprite(sprite, x, y, offsetX, offsetY);
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
      // Lighter top third
      g.rect(bx, by, 5, 2);
      g.fill({ color: 0xffffff, alpha: 0.06 });
    } else {
      // Crate: brown roundRect 5x6 with grid lines
      // Ground shadow under crate
      g.ellipse(bx + 2.5, by + 4, 4, 1.5);
      g.fill({ color: 0x000000, alpha: 0.15 });
      g.roundRect(bx, by, 5, 6, 0.5);
      g.fill(0x9b7924);
      g.roundRect(bx, by, 5, 6, 0.5);
      g.stroke({ width: 0.5, color: 0x5a4008, alpha: 0.5 });
      // Plank lines (like barrel bands)
      g.rect(bx, by + 2, 5, 0.5);
      g.fill({ color: 0x5a4008, alpha: 0.3 });
      g.rect(bx, by + 4, 5, 0.5);
      g.fill({ color: 0x5a4008, alpha: 0.3 });
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
    this.placeSprite(sprite, x, y, offsetX, offsetY);
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
      g.lineTo(px + radius * 0.8, py - radius * 0.4);
      g.lineTo(px + radius * 0.8, py + radius * 0.4);
      g.closePath();
      g.fill(0x1a4a7a); // Water color to simulate cut

      // Blend notch edge
      g.moveTo(px, py);
      g.lineTo(px + radius * 0.8, py - radius * 0.4);
      g.lineTo(px + radius * 0.8, py + radius * 0.4);
      g.closePath();
      g.stroke({ width: 0.5, color: 0x2a8a2a, alpha: 0.4 });
    }

    const tex = TextureFactory.generate(g, TILE_SIZE, TILE_SIZE);
    const sprite = new Sprite(tex);
    const offsetX = this.seededRand(seed, 10) * 4 - 2;
    const offsetY = this.seededRand(seed, 11) * 4 - 2;
    this.placeSprite(sprite, x, y, offsetX, offsetY);
  }

  private placeWildflowers(x: number, y: number, seed: number): void {
    const g = new Graphics();
    const flowerColors = [0xffff44, 0xff88bb, 0xffffff, 0xcc77ff, 0xffaa33];
    const count = 3 + (seed % 3); // 3-5 flowers

    for (let i = 0; i < count; i++) {
      const fx = 4 + this.seededRand(seed, i * 2) * 24;
      const fy = 4 + this.seededRand(seed, i * 2 + 1) * 24;
      const color = flowerColors[(seed + i) % flowerColors.length];
      const petalR = 1.8 + this.seededRand(seed, i * 2 + 10) * 1.0;

      // Stem
      g.moveTo(fx, fy + 1);
      g.lineTo(fx, fy + 4);
      g.stroke({ width: 1, color: 0x3a7a3a, alpha: 0.7 });

      // 4 petals (bigger)
      g.circle(fx - petalR, fy, petalR * 0.7);
      g.fill({ color, alpha: 0.8 });
      g.circle(fx + petalR, fy, petalR * 0.7);
      g.fill({ color, alpha: 0.8 });
      g.circle(fx, fy - petalR, petalR * 0.7);
      g.fill({ color, alpha: 0.8 });
      g.circle(fx, fy + petalR * 0.4, petalR * 0.7);
      g.fill({ color, alpha: 0.8 });

      // Bright center
      g.circle(fx, fy, 1.2);
      g.fill(0xffdd00);
    }

    const tex = TextureFactory.generate(g, TILE_SIZE, TILE_SIZE);
    const sprite = new Sprite(tex);
    this.placeSprite(sprite, x, y);
  }

  private placeMushroomCluster(x: number, y: number, seed: number): void {
    const g = new Graphics();
    const capColors = [0xc8a050, 0xb03030, 0xd4a060, 0x8855aa];
    const count = 2 + (seed % 2); // 2-3 mushrooms

    for (let i = 0; i < count; i++) {
      const mx = 6 + this.seededRand(seed, i * 3) * 20;
      const my = 8 + this.seededRand(seed, i * 3 + 1) * 16;
      const capColor = capColors[(seed + i) % capColors.length];
      const size = 1.2 + this.seededRand(seed, i * 3 + 2) * 0.8;

      // Stem
      g.rect(mx - 0.5, my, 1, 2.5);
      g.fill(0xe8dcc8);

      // Cap
      g.ellipse(mx, my, size * 1.5, size);
      g.fill(capColor);

      // Cap highlight
      g.ellipse(mx - 0.5, my - 0.3, size * 0.6, size * 0.4);
      g.fill({ color: 0xffffff, alpha: 0.12 });
    }

    const tex = TextureFactory.generate(g, TILE_SIZE, TILE_SIZE);
    const sprite = new Sprite(tex);
    const offsetX = this.seededRand(seed, 10) * 4 - 2;
    const offsetY = this.seededRand(seed, 11) * 4 - 2;
    this.placeSprite(sprite, x, y, offsetX, offsetY);
  }

  private placeTallGrass(x: number, y: number, seed: number): void {
    const g = new Graphics();
    const greens = [0x2d7a3a, 0x3a8a48, 0x4a9a58, 0x35854a];
    const count = 5 + (seed % 3);
    const windLean = 0.3 + this.seededRand(seed, 20) * 0.5;
    for (let i = 0; i < count; i++) {
      const bx = 3 + this.seededRand(seed, i * 2) * 26;
      const by = TILE_SIZE - 1;
      const bh = 6 + this.seededRand(seed, i * 2 + 1) * 5;
      const color = greens[(seed + i) % greens.length];
      g.moveTo(bx, by);
      g.quadraticCurveTo(bx + windLean * bh, by - bh * 0.6, bx + windLean * bh * 1.2, by - bh);
      g.stroke({ width: 1.5, color, alpha: 0.8 });
    }
    const tex = TextureFactory.generate(g, TILE_SIZE, TILE_SIZE);
    const sprite = new Sprite(tex);
    this.placeSprite(sprite, x, y);
  }

  private placePebbleScatter(x: number, y: number, seed: number): void {
    const g = new Graphics();
    const count = 3 + (seed % 3);
    const grays = [0x777777, 0x888888, 0x999999, 0xaaaaaa];
    for (let i = 0; i < count; i++) {
      const px = 3 + this.seededRand(seed, i * 2) * 26;
      const py = 3 + this.seededRand(seed, i * 2 + 1) * 26;
      const r = 0.5 + this.seededRand(seed, i * 2 + 10) * 1.0;
      g.circle(px, py, r);
      g.fill(grays[(seed + i) % grays.length]);
    }
    const tex = TextureFactory.generate(g, TILE_SIZE, TILE_SIZE);
    const sprite = new Sprite(tex);
    this.placeSprite(sprite, x, y);
  }

  private placeTorchStand(x: number, y: number, seed: number): void {
    const g = new Graphics();
    const tx = 10 + this.seededRand(seed, 0) * 12;
    const ty = 8;
    // Shadow
    g.ellipse(tx, ty + 14, 3, 1);
    g.fill({ color: 0x000000, alpha: 0.12 });
    // Post
    g.rect(tx - 0.5, ty + 2, 1.5, 12);
    g.fill(0x5c3a1e);
    // Flame
    g.circle(tx + 0.25, ty + 1, 2);
    g.fill({ color: 0xff8844, alpha: 0.7 });
    g.circle(tx + 0.25, ty, 1.5);
    g.fill({ color: 0xffcc44, alpha: 0.8 });
    g.circle(tx + 0.25, ty - 0.5, 0.8);
    g.fill({ color: 0xffffaa, alpha: 0.9 });
    // Glow
    g.circle(tx + 0.25, ty, 5);
    g.fill({ color: 0xff8844, alpha: 0.06 });
    const tex = TextureFactory.generate(g, TILE_SIZE, TILE_SIZE);
    const sprite = new Sprite(tex);
    this.placeSprite(sprite, x, y);
  }

  private placeFallenLeaves(x: number, y: number, seed: number): void {
    const g = new Graphics();
    const leafColors = [0x8b6914, 0xaa7722, 0xcc9933, 0x996633, 0xbb8844];
    const count = 4 + (seed % 3);
    for (let i = 0; i < count; i++) {
      const lx = 2 + this.seededRand(seed, i * 2) * 28;
      const ly = 2 + this.seededRand(seed, i * 2 + 1) * 28;
      const color = leafColors[(seed + i) % leafColors.length];
      g.ellipse(lx, ly, 0.8 + this.seededRand(seed, i + 20) * 0.6, 0.5 + this.seededRand(seed, i + 30) * 0.4);
      g.fill({ color, alpha: 0.5 });
    }
    const tex = TextureFactory.generate(g, TILE_SIZE, TILE_SIZE);
    const sprite = new Sprite(tex);
    this.placeSprite(sprite, x, y);
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
    this.placeSprite(sprite, x, y, offsetX, offsetY);
  }

  /** Small rocks and shells scattered on sand. */
  private placeSandRocks(x: number, y: number, seed: number): void {
    const g = new Graphics();
    const count = 2 + (seed % 3);
    for (let i = 0; i < count; i++) {
      const rx = 4 + this.seededRand(seed, i * 3) * 24;
      const ry = 4 + this.seededRand(seed, i * 3 + 1) * 24;
      const size = 1.5 + this.seededRand(seed, i * 3 + 2) * 2;
      const isShell = this.seededRand(seed, i + 20) > 0.7;

      if (isShell) {
        // Small shell shape
        g.arc(rx, ry, size, 0, Math.PI);
        g.fill({ color: 0xe8d8c0, alpha: 0.6 });
        g.arc(rx, ry, size * 0.6, 0, Math.PI);
        g.stroke({ width: 0.5, color: 0xc8b8a0, alpha: 0.4 });
      } else {
        // Small rock
        g.ellipse(rx, ry + size * 0.3, size * 0.4, size * 0.15);
        g.fill({ color: 0x000000, alpha: 0.08 }); // shadow
        g.roundRect(rx - size / 2, ry - size / 2, size, size * 0.8, 1);
        g.fill(this.seededRand(seed, i + 30) > 0.5 ? 0x999088 : 0x888078);
        g.roundRect(rx - size / 2, ry - size / 2, size * 0.5, size * 0.4, 1);
        g.fill({ color: 0xbbaa99, alpha: 0.2 }); // highlight
      }
    }
    const tex = TextureFactory.generate(g, TILE_SIZE, TILE_SIZE);
    const sprite = new Sprite(tex);
    this.placeSprite(sprite, x, y);
  }

  /** Tall tree with visible trunk and lush canopy. */
  private placeTallTree(x: number, y: number, seed: number): void {
    const g = new Graphics();
    const canopyRadius = 14 + this.seededRand(seed, 2) * 8; // 14-22px
    const treeHeight = 40 + this.seededRand(seed, 0) * 16; // 40-56px tall
    const texH = TILE_SIZE * 3;
    const texW = TILE_SIZE * 2;
    const centerX = texW / 2;
    const trunkBase = texH - 6;

    // Ground shadow (large, visible)
    g.ellipse(centerX, trunkBase + 3, canopyRadius * 1.0, canopyRadius * 0.3);
    g.fill({ color: 0x000000, alpha: 0.25 });

    // Trunk (thick, visible)
    const trunkWidth = 4 + this.seededRand(seed, 3) * 3;
    const trunkTop = trunkBase - treeHeight + canopyRadius;
    // Dark side
    g.rect(centerX - trunkWidth / 2, trunkTop, trunkWidth, treeHeight - canopyRadius + 4);
    g.fill(0x4a2e16);
    // Light side highlight
    g.rect(centerX - trunkWidth / 2, trunkTop, trunkWidth * 0.4, treeHeight - canopyRadius + 4);
    g.fill({ color: 0x7a5a3a, alpha: 0.4 });

    // Canopy — multiple overlapping circles for lush, organic shape
    const canopyY = trunkTop - canopyRadius * 0.2;
    const greens = [0x1a5515, 0x22661a, 0x1a4e12, 0x2a7520, 0x18480f];

    // Shadow under canopy (dark ground area)
    g.ellipse(centerX + 2, canopyY + canopyRadius * 0.6, canopyRadius * 1.1, canopyRadius * 0.5);
    g.fill({ color: 0x0a1a06, alpha: 0.5 });

    // 5-7 canopy blobs for full, bushy look
    const blobCount = 5 + Math.floor(this.seededRand(seed, 50) * 3);
    for (let i = 0; i < blobCount; i++) {
      const ox = (this.seededRand(seed, 20 + i) - 0.5) * canopyRadius * 0.8;
      const oy = (this.seededRand(seed, 30 + i) - 0.5) * canopyRadius * 0.7;
      const cr = canopyRadius * (0.5 + this.seededRand(seed, 40 + i) * 0.5);
      g.ellipse(centerX + ox, canopyY + oy, cr, cr * 0.8);
      g.fill(greens[i % greens.length]);
    }

    // Bright highlight blobs on top-left (sun-lit side)
    for (let i = 0; i < 3; i++) {
      const hx = centerX - canopyRadius * 0.15 + (this.seededRand(seed, 60 + i) - 0.5) * canopyRadius * 0.4;
      const hy = canopyY - canopyRadius * 0.15 + (this.seededRand(seed, 70 + i) - 0.5) * canopyRadius * 0.3;
      const hr = canopyRadius * (0.25 + this.seededRand(seed, 80 + i) * 0.2);
      g.ellipse(hx, hy, hr, hr * 0.8);
      g.fill({ color: 0x44bb35, alpha: 0.25 });
    }

    // Small bright dot (sun glint)
    g.circle(centerX - canopyRadius * 0.3, canopyY - canopyRadius * 0.3, 2);
    g.fill({ color: 0x88ee55, alpha: 0.3 });

    const tex = TextureFactory.generate(g, Math.ceil(texW), texH);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5, 0.88);
    const iso = cartToIso(x, y);
    sprite.x = iso.x + (this.seededRand(seed, 10) - 0.5) * 10;
    sprite.y = iso.y;
    sprite.zIndex = isoDepth(x, y) + 0.001;
    this.container.addChild(sprite);
  }

  /** Vertical post/pillar for building interiors — adds architectural height. */
  private placeBuildingPost(x: number, y: number, seed: number): void {
    const g = new Graphics();
    const postX = 10 + this.seededRand(seed, 0) * 12;
    const postBase = TILE_SIZE - 2;
    const postHeight = 14 + this.seededRand(seed, 1) * 6;
    const postWidth = 2.5;

    // Shadow
    g.ellipse(postX, postBase + 1, 3, 1);
    g.fill({ color: 0x000000, alpha: 0.12 });

    // Post body (dark wood)
    g.rect(postX - postWidth / 2, postBase - postHeight, postWidth, postHeight);
    g.fill(0x4a3020);
    // Lighter face
    g.rect(postX - postWidth / 2, postBase - postHeight, postWidth * 0.4, postHeight);
    g.fill({ color: 0x6a5040, alpha: 0.3 });

    // Cap
    g.rect(postX - postWidth, postBase - postHeight - 1, postWidth * 2, 2);
    g.fill(0x5a4030);
    g.rect(postX - postWidth, postBase - postHeight - 1, postWidth * 2, 2);
    g.stroke({ width: 0.3, color: 0x3a2015, alpha: 0.5 });

    const texH = TILE_SIZE + Math.ceil(postHeight);
    const tex = TextureFactory.generate(g, TILE_SIZE, texH);
    const sprite = new Sprite(tex);
    const offsetY = -postHeight * 0.4;
    this.placeSprite(sprite, x, y, 0, offsetY);
  }
}
