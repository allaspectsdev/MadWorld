import { TileType, type ZoneDef } from "@madworld/shared";

function generateTiles(
  width: number,
  height: number,
  fill: TileType = TileType.GRASS,
): TileType[][] {
  return Array.from({ length: height }, () => Array(width).fill(fill));
}

function applyFeature(
  tiles: TileType[][],
  x: number,
  y: number,
  w: number,
  h: number,
  type: TileType,
): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const ty = y + dy;
      const tx = x + dx;
      if (ty >= 0 && ty < tiles.length && tx >= 0 && tx < tiles[0].length) {
        tiles[ty][tx] = type;
      }
    }
  }
}

function setTile(tiles: TileType[][], x: number, y: number, type: TileType): void {
  if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
    tiles[y][x] = type;
  }
}

function applyOval(tiles: TileType[][], cx: number, cy: number, rx: number, ry: number, type: TileType): void {
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
        setTile(tiles, cx + dx, cy + dy, type);
      }
    }
  }
}

function applyNoisyRect(tiles: TileType[][], x: number, y: number, w: number, h: number, type: TileType, roughness: number, seed: number): void {
  const rng = simpleRng(seed);
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const isEdge = dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1;
      if (isEdge && rng() < roughness) continue;
      setTile(tiles, x + dx, y + dy, type);
    }
  }
}

function simpleRng(seed: number): () => number {
  let s = seed | 0;
  return () => { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 4294967296; };
}

// --- Greendale Village (Starter Zone) ---
function createGreendale(): ZoneDef {
  const w = 60, h = 60;
  const tiles = generateTiles(w, h, TileType.GRASS);

  // === Market Square (cobblestone center) ===
  applyFeature(tiles, 22, 22, 16, 16, TileType.COBBLESTONE);

  // === Dirt roads (4 cardinal directions) ===
  applyFeature(tiles, 28, 0, 4, 22, TileType.DIRT);  // north road
  applyFeature(tiles, 28, 38, 4, 22, TileType.DIRT);  // south road
  applyFeature(tiles, 0, 28, 22, 4, TileType.DIRT);   // west road
  applyFeature(tiles, 38, 28, 22, 4, TileType.DIRT);  // east road

  // === Road borders — cobblestone edges along market district roads ===
  // N-S road cobblestone borders within market area (x=27 and x=32, y=22-38)
  for (let y = 22; y <= 38; y++) {
    setTile(tiles, 27, y, TileType.COBBLESTONE);
    setTile(tiles, 32, y, TileType.COBBLESTONE);
  }
  // E-W road cobblestone borders within market area (y=27 and y=32, x=22-38)
  for (let x = 22; x <= 38; x++) {
    setTile(tiles, x, 27, TileType.COBBLESTONE);
    setTile(tiles, x, 32, TileType.COBBLESTONE);
  }

  // === Well in market center (small water tile surrounded by cobblestone) ===
  setTile(tiles, 30, 29, TileType.WATER);
  setTile(tiles, 30, 30, TileType.WATER);

  // === Buildings with MOUNTAIN walls and door gaps ===

  // General store (NW of market) — floor at (23,23,5,4)
  applyFeature(tiles, 23, 23, 5, 4, TileType.BUILDING_FLOOR);
  // Walls: MOUNTAIN border around (22,22)-(28,27)
  applyFeature(tiles, 22, 22, 7, 1, TileType.MOUNTAIN);  // top wall
  applyFeature(tiles, 22, 27, 7, 1, TileType.MOUNTAIN);  // bottom wall
  applyFeature(tiles, 22, 22, 1, 6, TileType.MOUNTAIN);   // left wall
  applyFeature(tiles, 28, 22, 1, 6, TileType.MOUNTAIN);   // right wall
  // Door gap on bottom edge facing market (x=24,25 at y=27)
  setTile(tiles, 24, 27, TileType.BUILDING_FLOOR);
  setTile(tiles, 25, 27, TileType.BUILDING_FLOOR);

  // Inn (NE of market) — floor at (32,23,5,4)
  applyFeature(tiles, 32, 23, 5, 4, TileType.BUILDING_FLOOR);
  // Walls: MOUNTAIN border around (31,22)-(37,27)
  applyFeature(tiles, 31, 22, 7, 1, TileType.MOUNTAIN);  // top wall
  applyFeature(tiles, 31, 27, 7, 1, TileType.MOUNTAIN);  // bottom wall
  applyFeature(tiles, 31, 22, 1, 6, TileType.MOUNTAIN);   // left wall
  applyFeature(tiles, 37, 22, 1, 6, TileType.MOUNTAIN);   // right wall
  // Door gap on bottom edge facing market (x=33,34 at y=27)
  setTile(tiles, 33, 27, TileType.BUILDING_FLOOR);
  setTile(tiles, 34, 27, TileType.BUILDING_FLOOR);

  // Blacksmith (SW of market) — floor at (23,33,4,4)
  applyFeature(tiles, 23, 33, 4, 4, TileType.BUILDING_FLOOR);
  // Walls: MOUNTAIN border around (22,32)-(27,37)
  applyFeature(tiles, 22, 32, 6, 1, TileType.MOUNTAIN);  // top wall
  applyFeature(tiles, 22, 37, 6, 1, TileType.MOUNTAIN);  // bottom wall
  applyFeature(tiles, 22, 32, 1, 6, TileType.MOUNTAIN);   // left wall
  applyFeature(tiles, 27, 32, 1, 6, TileType.MOUNTAIN);   // right wall
  // Door gap on top edge facing market (x=24,25 at y=32)
  setTile(tiles, 24, 32, TileType.BUILDING_FLOOR);
  setTile(tiles, 25, 32, TileType.BUILDING_FLOOR);

  // Town hall (SE of market, larger) — floor at (31,33,6,4)
  applyFeature(tiles, 31, 33, 6, 4, TileType.BUILDING_FLOOR);
  // Walls: MOUNTAIN border around (30,32)-(37,37)
  applyFeature(tiles, 30, 32, 8, 1, TileType.MOUNTAIN);  // top wall
  applyFeature(tiles, 30, 37, 8, 1, TileType.MOUNTAIN);  // bottom wall
  applyFeature(tiles, 30, 32, 1, 6, TileType.MOUNTAIN);   // left wall
  applyFeature(tiles, 37, 32, 1, 6, TileType.MOUNTAIN);   // right wall
  // Door gap on top edge facing market (x=33,34 at y=32)
  setTile(tiles, 33, 32, TileType.BUILDING_FLOOR);
  setTile(tiles, 34, 32, TileType.BUILDING_FLOOR);

  // === Farm area (NW) with FENCE borders ===
  applyFeature(tiles, 4, 14, 12, 1, TileType.FENCE);  // top fence
  applyFeature(tiles, 4, 24, 12, 1, TileType.FENCE);  // bottom fence
  applyFeature(tiles, 4, 14, 1, 11, TileType.FENCE);   // left fence
  applyFeature(tiles, 15, 14, 1, 11, TileType.FENCE);  // right fence
  // Farmland strips inside
  applyFeature(tiles, 5, 15, 10, 1, TileType.DIRT);
  applyFeature(tiles, 5, 17, 10, 1, TileType.DIRT);
  applyFeature(tiles, 5, 19, 10, 1, TileType.DIRT);
  applyFeature(tiles, 5, 21, 10, 1, TileType.DIRT);
  applyFeature(tiles, 5, 23, 10, 1, TileType.DIRT);
  // Gate opening in bottom fence
  setTile(tiles, 9, 24, TileType.DIRT);
  setTile(tiles, 10, 24, TileType.DIRT);

  // === Farm irrigation — 1-wide water channel through the farm ===
  applyFeature(tiles, 10, 15, 1, 8, TileType.WATER);

  // === Pond (NE area) — oval shape ===
  applyOval(tiles, 49, 9, 6, 4, TileType.SAND);
  applyOval(tiles, 49, 9, 5, 3, TileType.WATER);

  // === Gardens / flower patches (decorative dirt patches near buildings) ===
  // Garden behind general store
  applyFeature(tiles, 24, 27, 3, 1, TileType.DIRT);
  // Garden behind inn
  applyFeature(tiles, 33, 27, 3, 1, TileType.DIRT);

  // === Forest edges ===
  applyNoisyRect(tiles, 0, 50, 15, 10, TileType.FOREST, 0.4, 101);
  applyNoisyRect(tiles, 0, 45, 5, 5, TileType.FOREST, 0.3, 102);
  applyNoisyRect(tiles, 45, 0, 15, 3, TileType.FOREST, 0.35, 103);
  // Small decorative tree patches
  applyNoisyRect(tiles, 0, 0, 3, 4, TileType.FOREST, 0.3, 104);
  applyNoisyRect(tiles, 18, 0, 4, 3, TileType.FOREST, 0.25, 105);
  applyNoisyRect(tiles, 0, 35, 3, 5, TileType.FOREST, 0.3, 106);

  // === Mountains (impassable, SE corner) ===
  applyFeature(tiles, 50, 50, 10, 10, TileType.MOUNTAIN);
  applyFeature(tiles, 48, 52, 2, 6, TileType.MOUNTAIN);

  // === Signpost areas (cobblestone markers at road exits) ===
  setTile(tiles, 27, 2, TileType.COBBLESTONE);
  setTile(tiles, 32, 2, TileType.COBBLESTONE);
  setTile(tiles, 2, 27, TileType.COBBLESTONE);
  setTile(tiles, 2, 32, TileType.COBBLESTONE);

  // === Portals ===
  // Portal to Darkwood at south edge
  tiles[59][29] = TileType.PORTAL;
  tiles[59][30] = TileType.PORTAL;

  // Portal to fields at east edge
  tiles[29][59] = TileType.PORTAL;
  tiles[30][59] = TileType.PORTAL;

  return {
    id: "greendale",
    name: "Greendale Village",
    width: w,
    height: h,
    tiles,
    spawnX: 30,
    spawnY: 30,
    portals: [
      { x: 29, y: 59, targetZoneId: "darkwood", targetX: 29, targetY: 1 },
      { x: 30, y: 59, targetZoneId: "darkwood", targetX: 30, targetY: 1 },
      { x: 59, y: 29, targetZoneId: "fields", targetX: 1, targetY: 29 },
      { x: 59, y: 30, targetZoneId: "fields", targetX: 1, targetY: 30 },
    ],
    mobSpawns: [
      { mobId: "chicken", x: 8, y: 18, count: 4, wanderRadius: 3 },
      { mobId: "chicken", x: 15, y: 42, count: 3, wanderRadius: 4 },
      { mobId: "cow", x: 42, y: 40, count: 3, wanderRadius: 5 },
      { mobId: "cow", x: 20, y: 48, count: 2, wanderRadius: 4 },
    ],
    npcSpawns: [
      { npcId: "quest_giver", name: "Elder Theron", x: 33, y: 35, dialog: "Welcome, adventurer. I have tasks for those brave enough.", quests: ["pest_control", "goblin_menace", "spider_silk", "into_the_warren", "the_lichs_end"] },
      { npcId: "shopkeeper", name: "Merchant Lyra", x: 25, y: 24, dialog: "Take a look at my wares!", quests: ["lyras_supplies"] },
      { npcId: "blacksmith", name: "Smith Garrett", x: 24, y: 35, dialog: "Need something forged? Come back when I've set up shop.", quests: [] },
      { npcId: "guard_south", name: "Guard", x: 29, y: 57, dialog: "The Darkwood Forest lies to the south. Be careful out there.", quests: ["forest_exploration"] },
      { npcId: "guard_east", name: "Guard", x: 57, y: 29, dialog: "The open fields are to the east. Watch for goblins.", quests: ["field_survey"] },
      { npcId: "farmer_hank", name: "Farmer Hank", x: 42, y: 22, dialog: "The crops are coming in nicely this season. Watch your step around the irrigation channels!", quests: [] },
      { npcId: "fisherman_wade", name: "Fisherman Wade", x: 14, y: 44, dialog: "The fish bite best at dawn. I once caught a golden trout this big!", quests: [] },
      { npcId: "innkeeper_rosa", name: "Innkeeper Rosa", x: 22, y: 18, dialog: "Welcome! Rest your weary bones. We have the finest ale in Greendale.", quests: [] },
      { npcId: "baker_martha", name: "Baker Martha", x: 32, y: 28, dialog: "Fresh bread, straight from the oven! My secret ingredient? Love. And butter.", quests: [] },
      { npcId: "old_sage_aldric", name: "Old Sage Aldric", x: 28, y: 38, dialog: "The darkness in the forest grows stronger... I've seen things, young adventurer. Terrible things.", quests: [] },
      { npcId: "street_urchin", name: "Street Urchin", x: 35, y: 31, dialog: "Got any spare coins, mister? I know all the secrets of this town!", quests: [] },
      { npcId: "wandering_bard", name: "Wandering Bard", x: 18, y: 34, dialog: "Oh brave adventurer, hear my song! Would you like to hear a tale of the Elder Drake?", quests: [] },
    ],
    lights: [
      // Market center campfire
      { x: 30, y: 30, radius: 5, color: 0xff9944, flicker: true },
      // General store torch
      { x: 25, y: 22, radius: 3, color: 0xffaa55, flicker: true },
      // Inn torch
      { x: 34, y: 22, radius: 3, color: 0xffaa55, flicker: true },
      // Blacksmith forge glow
      { x: 25, y: 33, radius: 3, color: 0xff6622, flicker: true },
      // Town hall torch
      { x: 34, y: 33, radius: 3, color: 0xffaa55, flicker: true },
      // Road exit signposts
      { x: 29, y: 2, radius: 2, color: 0xffcc66, flicker: true },
      { x: 2, y: 29, radius: 2, color: 0xffcc66, flicker: true },
      // Portal glow
      { x: 29, y: 59, radius: 4, color: 0x9b59b6 },
      { x: 59, y: 29, radius: 4, color: 0x9b59b6 },
      // Road torches
      { x: 30, y: 20, radius: 4, color: 0xff9944, flicker: true },
      { x: 30, y: 40, radius: 4, color: 0xff9944, flicker: true },
      { x: 20, y: 30, radius: 4, color: 0xff9944, flicker: true },
      { x: 40, y: 30, radius: 4, color: 0xff9944, flicker: true },
      { x: 15, y: 15, radius: 3, color: 0xff8833, flicker: true },
      { x: 45, y: 45, radius: 3, color: 0xff8833, flicker: true },
    ],
  };
}

// --- Darkwood Forest ---
function createDarkwood(): ZoneDef {
  const w = 80, h = 80;
  const tiles = generateTiles(w, h, TileType.FOREST);

  // === Winding main path N-S (not perfectly straight) ===
  // Segment 1: north entry
  applyFeature(tiles, 28, 0, 4, 15, TileType.DIRT);
  // Curve east
  applyFeature(tiles, 30, 14, 8, 4, TileType.DIRT);
  // Segment 2: south from curve
  applyFeature(tiles, 36, 17, 4, 10, TileType.DIRT);
  // Curve back west
  applyFeature(tiles, 28, 26, 12, 4, TileType.DIRT);
  // Segment 3: straight south
  applyFeature(tiles, 28, 29, 4, 12, TileType.DIRT);
  // Cross path E-W
  applyFeature(tiles, 0, 38, 80, 4, TileType.DIRT);
  // Continue south from cross
  applyFeature(tiles, 28, 42, 4, 38, TileType.DIRT);

  // === Clearings (grass patches in forest) ===
  // North clearing — larger, more organic shape
  applyNoisyRect(tiles, 8, 8, 14, 14, TileType.GRASS, 0.35, 201);
  applyNoisyRect(tiles, 6, 10, 2, 10, TileType.GRASS, 0.3, 202);
  applyNoisyRect(tiles, 22, 10, 2, 10, TileType.GRASS, 0.3, 203);

  // Campfire in north clearing center (~x=14, y=14)
  applyFeature(tiles, 13, 13, 3, 3, TileType.COBBLESTONE);

  // East clearing with ruins
  applyNoisyRect(tiles, 50, 8, 14, 12, TileType.GRASS, 0.3, 204);
  // Ruined building fragments — original
  applyFeature(tiles, 53, 10, 3, 2, TileType.BUILDING_FLOOR);
  applyFeature(tiles, 58, 12, 2, 3, TileType.BUILDING_FLOOR);
  setTile(tiles, 55, 14, TileType.BUILDING_FLOOR);
  // Additional ruins in L-shape
  applyFeature(tiles, 53, 14, 2, 4, TileType.BUILDING_FLOOR);
  applyFeature(tiles, 53, 17, 6, 2, TileType.BUILDING_FLOOR);

  // South clearing
  applyNoisyRect(tiles, 52, 52, 18, 18, TileType.GRASS, 0.35, 205);
  applyNoisyRect(tiles, 50, 55, 2, 12, TileType.GRASS, 0.3, 206);

  // Small mysterious clearing
  applyNoisyRect(tiles, 10, 55, 8, 8, TileType.GRASS, 0.3, 207);
  applyFeature(tiles, 13, 58, 2, 2, TileType.COBBLESTONE); // old stone circle

  // === Lake ===
  applyFeature(tiles, 10, 48, 2, 8, TileType.SAND); // west shore
  applyFeature(tiles, 22, 48, 2, 8, TileType.SAND); // east shore
  applyFeature(tiles, 10, 47, 14, 1, TileType.SAND); // north shore
  applyFeature(tiles, 10, 56, 14, 1, TileType.SAND); // south shore
  applyFeature(tiles, 12, 48, 10, 8, TileType.WATER);

  // Lake shore — marshy dirt patches along the edges for organic look
  setTile(tiles, 10, 49, TileType.DIRT);
  setTile(tiles, 10, 51, TileType.DIRT);
  setTile(tiles, 10, 53, TileType.DIRT);
  setTile(tiles, 11, 48, TileType.DIRT);
  setTile(tiles, 11, 50, TileType.DIRT);
  setTile(tiles, 11, 54, TileType.DIRT);
  setTile(tiles, 22, 49, TileType.DIRT);
  setTile(tiles, 22, 52, TileType.DIRT);
  setTile(tiles, 22, 54, TileType.DIRT);
  setTile(tiles, 23, 50, TileType.DIRT);
  setTile(tiles, 23, 53, TileType.DIRT);
  setTile(tiles, 12, 47, TileType.DIRT);
  setTile(tiles, 15, 47, TileType.DIRT);
  setTile(tiles, 19, 47, TileType.DIRT);
  setTile(tiles, 13, 56, TileType.DIRT);
  setTile(tiles, 16, 56, TileType.DIRT);
  setTile(tiles, 20, 56, TileType.DIRT);

  // === Mountains ===
  applyFeature(tiles, 0, 70, 25, 10, TileType.MOUNTAIN);
  applyFeature(tiles, 70, 65, 10, 15, TileType.MOUNTAIN);

  // === Portals ===
  // Portal back to Greendale at north edge
  tiles[0][29] = TileType.PORTAL;
  tiles[0][30] = TileType.PORTAL;

  // Portal to Scorched Highlands at east edge
  tiles[38][79] = TileType.PORTAL;
  tiles[39][79] = TileType.PORTAL;

  // Dungeon portal — Goblin Warren entrance
  tiles[38][30] = TileType.DUNGEON_PORTAL;

  return {
    id: "darkwood",
    name: "Darkwood Forest",
    width: w,
    height: h,
    tiles,
    spawnX: 30,
    spawnY: 2,
    portals: [
      { x: 29, y: 0, targetZoneId: "greendale", targetX: 29, targetY: 58 },
      { x: 30, y: 0, targetZoneId: "greendale", targetX: 30, targetY: 58 },
      { x: 30, y: 38, targetZoneId: "goblin_warren", targetX: 6, targetY: 20, dungeonId: "goblin_warren" },
      { x: 79, y: 38, targetZoneId: "scorched_highlands", targetX: 2, targetY: 35 },
    ],
    mobSpawns: [
      { mobId: "goblin", x: 14, y: 14, count: 4, wanderRadius: 5 },
      { mobId: "goblin", x: 36, y: 22, count: 3, wanderRadius: 4 },
      { mobId: "forest_spider", x: 56, y: 58, count: 4, wanderRadius: 6 },
      { mobId: "skeleton", x: 55, y: 12, count: 3, wanderRadius: 4 },
      { mobId: "goblin", x: 40, y: 50, count: 3, wanderRadius: 5 },
      { mobId: "forest_spider", x: 12, y: 58, count: 2, wanderRadius: 3 },
    ],
    lights: [
      // Mysterious clearing glow
      { x: 14, y: 59, radius: 4, color: 0x44ff88 },
      // Stone circle eerie light
      { x: 14, y: 59, radius: 2, color: 0x88ffaa },
      // Dungeon portal red glow
      { x: 30, y: 38, radius: 5, color: 0xe74c3c },
      // Portal back to Greendale
      { x: 29, y: 0, radius: 4, color: 0x9b59b6 },
      // Portal to Scorched Highlands
      { x: 79, y: 38, radius: 4, color: 0x9b59b6 },
      // Forest path torches
      { x: 40, y: 20, radius: 3, color: 0xff6622, flicker: true },
      { x: 25, y: 55, radius: 3, color: 0xff6622, flicker: true },
    ],
  };
}

// --- Fields ---
function createFields(): ZoneDef {
  const w = 60, h = 60;
  const tiles = generateTiles(w, h, TileType.GRASS);

  // === Dirt paths ===
  applyFeature(tiles, 0, 28, 60, 4, TileType.DIRT);   // main E-W road
  applyFeature(tiles, 38, 0, 4, 28, TileType.DIRT);   // north road to dungeon area

  // === Farmland areas (alternating dirt/grass strips) ===
  for (let row = 0; row < 6; row++) {
    applyFeature(tiles, 5, 8 + row * 3, 15, 1, TileType.DIRT);
  }
  // Farm fences (FENCE instead of MOUNTAIN)
  applyFeature(tiles, 4, 7, 1, 13, TileType.FENCE);
  applyFeature(tiles, 21, 7, 1, 13, TileType.FENCE);
  applyFeature(tiles, 4, 7, 18, 1, TileType.FENCE);
  applyFeature(tiles, 4, 20, 18, 1, TileType.FENCE);
  // Gate
  setTile(tiles, 12, 20, TileType.DIRT);
  setTile(tiles, 13, 20, TileType.DIRT);

  // === Meandering river ===
  // y=0-7: water at x=25-27 (straight section)
  applyFeature(tiles, 25, 0, 3, 8, TileType.WATER);
  // y=8-13: water shifts to x=23-25 (bend west)
  applyFeature(tiles, 23, 8, 3, 6, TileType.WATER);
  // y=14-19: water at x=24-26 (back center)
  applyFeature(tiles, 24, 14, 3, 6, TileType.WATER);
  // y=20-27: water at x=26-28 (bend east)
  applyFeature(tiles, 26, 20, 3, 8, TileType.WATER);
  // y=32-39: water at x=24-26 (south of bridge, center)
  applyFeature(tiles, 24, 32, 3, 8, TileType.WATER);
  // y=40-46: water at x=25-27 (straight south)
  applyFeature(tiles, 25, 40, 3, 7, TileType.WATER);

  // First bridge at y=12-13 spanning x=23-27
  tiles[12][23] = TileType.BRIDGE;
  tiles[12][24] = TileType.BRIDGE;
  tiles[12][25] = TileType.BRIDGE;
  tiles[12][26] = TileType.BRIDGE;
  tiles[12][27] = TileType.BRIDGE;
  tiles[13][23] = TileType.BRIDGE;
  tiles[13][24] = TileType.BRIDGE;
  tiles[13][25] = TileType.BRIDGE;
  tiles[13][26] = TileType.BRIDGE;
  tiles[13][27] = TileType.BRIDGE;

  // Second bridge (main road) at y=29-30 spanning x=24-28
  tiles[29][24] = TileType.BRIDGE;
  tiles[29][25] = TileType.BRIDGE;
  tiles[29][26] = TileType.BRIDGE;
  tiles[29][27] = TileType.BRIDGE;
  tiles[29][28] = TileType.BRIDGE;
  tiles[30][24] = TileType.BRIDGE;
  tiles[30][25] = TileType.BRIDGE;
  tiles[30][26] = TileType.BRIDGE;
  tiles[30][27] = TileType.BRIDGE;
  tiles[30][28] = TileType.BRIDGE;

  // === Sandy beach (south) with gradient transition ===
  // Beach gradient at y=45-46: checkerboard sand pattern
  for (let x = 0; x < w; x++) {
    if ((x + 45) % 2 === 0) setTile(tiles, x, 45, TileType.SAND);
    if ((x + 46) % 2 === 0) setTile(tiles, x, 46, TileType.SAND);
  }
  // Solid sand from y=47 onward
  applyFeature(tiles, 0, 47, 60, 3, TileType.SAND);
  applyFeature(tiles, 0, 50, 60, 10, TileType.SAND);

  // === Small forest patches ===
  applyNoisyRect(tiles, 45, 5, 8, 6, TileType.FOREST, 0.35, 301);
  applyNoisyRect(tiles, 0, 40, 6, 7, TileType.FOREST, 0.3, 302);

  // === Portals ===
  // Portal back to Greendale at west edge
  tiles[29][0] = TileType.PORTAL;
  tiles[30][0] = TileType.PORTAL;

  // Dungeon portal — Crypt of Bones entrance
  tiles[10][40] = TileType.DUNGEON_PORTAL;

  return {
    id: "fields",
    name: "Open Fields",
    width: w,
    height: h,
    tiles,
    spawnX: 2,
    spawnY: 30,
    portals: [
      { x: 0, y: 29, targetZoneId: "greendale", targetX: 58, targetY: 29 },
      { x: 0, y: 30, targetZoneId: "greendale", targetX: 58, targetY: 30 },
      { x: 40, y: 10, targetZoneId: "crypt_of_bones", targetX: 6, targetY: 7, dungeonId: "crypt_of_bones" },
    ],
    mobSpawns: [
      { mobId: "cow", x: 10, y: 12, count: 4, wanderRadius: 4 },
      { mobId: "goblin", x: 35, y: 8, count: 3, wanderRadius: 5 },
      { mobId: "chicken", x: 10, y: 42, count: 5, wanderRadius: 4 },
      { mobId: "cow", x: 45, y: 35, count: 3, wanderRadius: 5 },
    ],
    lights: [
      // Portal back to Greendale
      { x: 0, y: 29, radius: 4, color: 0x9b59b6 },
      // Dungeon portal
      { x: 40, y: 10, radius: 5, color: 0xe74c3c },
      // Road torches
      { x: 30, y: 28, radius: 4, color: 0xff9944, flicker: true },
      { x: 30, y: 32, radius: 4, color: 0xff9944, flicker: true },
    ],
  };
}

// --- Scorched Highlands ---
function createScorchedHighlands(): ZoneDef {
  const w = 70, h = 70;
  const tiles = generateTiles(w, h, TileType.DIRT);

  // === Mountain ridges along north and south borders ===
  applyFeature(tiles, 0, 0, 70, 3, TileType.MOUNTAIN);
  applyFeature(tiles, 0, 67, 70, 3, TileType.MOUNTAIN);

  // === Central lava lake (sand border first, then water overwrites center) ===
  applyOval(tiles, 35, 35, 9, 7, TileType.SAND);
  applyOval(tiles, 35, 35, 8, 6, TileType.WATER);

  // === BRIDGE crossing the lava lake ===
  tiles[35][26] = TileType.BRIDGE;
  tiles[35][27] = TileType.BRIDGE;
  tiles[35][43] = TileType.BRIDGE;
  tiles[35][44] = TileType.BRIDGE;

  // === Ruined fortress NE (x=50-60, y=8-18): MOUNTAIN walls with BUILDING_FLOOR interior ===
  applyFeature(tiles, 50, 8, 11, 1, TileType.MOUNTAIN);   // top wall
  applyFeature(tiles, 50, 18, 11, 1, TileType.MOUNTAIN);   // bottom wall
  applyFeature(tiles, 50, 8, 1, 11, TileType.MOUNTAIN);    // left wall
  applyFeature(tiles, 60, 8, 1, 11, TileType.MOUNTAIN);    // right wall
  applyFeature(tiles, 51, 9, 9, 9, TileType.BUILDING_FLOOR); // interior
  // Door gap on south wall (x=54,55 at y=18)
  setTile(tiles, 54, 18, TileType.BUILDING_FLOOR);
  setTile(tiles, 55, 18, TileType.BUILDING_FLOOR);

  // === Dried riverbed: SAND path winding from NW (x=10,y=10) to SE (x=55,y=55) ===
  applyFeature(tiles, 10, 10, 3, 8, TileType.SAND);    // south from NW
  applyFeature(tiles, 12, 17, 8, 3, TileType.SAND);     // east bend
  applyFeature(tiles, 19, 19, 3, 8, TileType.SAND);     // south
  applyFeature(tiles, 21, 26, 8, 3, TileType.SAND);     // east bend
  applyFeature(tiles, 28, 28, 3, 6, TileType.SAND);     // south
  applyFeature(tiles, 30, 33, 6, 3, TileType.SAND);     // east
  applyFeature(tiles, 35, 35, 3, 6, TileType.SAND);     // south (through lake area, some overwritten)
  applyFeature(tiles, 37, 40, 6, 3, TileType.SAND);     // east
  applyFeature(tiles, 42, 42, 3, 6, TileType.SAND);     // south
  applyFeature(tiles, 44, 47, 6, 3, TileType.SAND);     // east
  applyFeature(tiles, 49, 49, 3, 4, TileType.SAND);     // south
  applyFeature(tiles, 51, 52, 4, 3, TileType.SAND);     // final east to SE

  // === Oasis in SW (x=10, y=55): SAND border, GRASS patch 5x5, WATER center 2x2 ===
  applyFeature(tiles, 8, 53, 7, 7, TileType.SAND);       // sand border
  applyFeature(tiles, 9, 54, 5, 5, TileType.GRASS);      // grass patch
  applyFeature(tiles, 10, 55, 2, 2, TileType.WATER);     // water center

  // === COBBLESTONE paths connecting portal entries to central area ===
  applyFeature(tiles, 0, 35, 26, 2, TileType.COBBLESTONE);   // west portal to lake
  applyFeature(tiles, 45, 35, 25, 2, TileType.COBBLESTONE);  // lake to east portal

  // === Portals ===
  // West edge → target darkwood (79, 38)
  tiles[35][0] = TileType.PORTAL;
  tiles[36][0] = TileType.PORTAL;
  // East edge → target frozen_wastes (2, 35)
  tiles[35][69] = TileType.PORTAL;
  tiles[36][69] = TileType.PORTAL;
  // Dungeon portal at (35, 20) → target dragons_lair (6, 25)
  tiles[20][35] = TileType.DUNGEON_PORTAL;

  return {
    id: "scorched_highlands",
    name: "Scorched Highlands",
    width: w,
    height: h,
    tiles,
    spawnX: 2,
    spawnY: 35,
    portals: [
      { x: 0, y: 35, targetZoneId: "darkwood", targetX: 79, targetY: 38 },
      { x: 0, y: 36, targetZoneId: "darkwood", targetX: 79, targetY: 38 },
      { x: 69, y: 35, targetZoneId: "frozen_wastes", targetX: 2, targetY: 35 },
      { x: 69, y: 36, targetZoneId: "frozen_wastes", targetX: 2, targetY: 35 },
      { x: 35, y: 20, targetZoneId: "dragons_lair", targetX: 6, targetY: 25, dungeonId: "dragons_lair" },
    ],
    mobSpawns: [
      { mobId: "fire_imp", x: 20, y: 25, count: 5, wanderRadius: 6 },
      { mobId: "fire_imp", x: 50, y: 45, count: 4, wanderRadius: 5 },
      { mobId: "lava_beetle", x: 30, y: 40, count: 3, wanderRadius: 4 },
      { mobId: "lava_beetle", x: 40, y: 30, count: 3, wanderRadius: 4 },
      { mobId: "scorched_warrior", x: 55, y: 13, count: 4, wanderRadius: 5 },
      { mobId: "magma_elemental", x: 35, y: 35, count: 3, wanderRadius: 6 },
    ],
    npcSpawns: [
      { npcId: "scout_ember", name: "Scout Ember", x: 12, y: 57, dialog: "The highlands are treacherous. The Dragon's Lair is to the north — only the bravest dare enter.", quests: ["highland_patrol", "lava_beetles", "dragon_lair_key", "slay_the_drake"] },
    ],
    lights: [
      // Red lava glow around lake
      { x: 35, y: 35, radius: 10, color: 0xff4422 },
      { x: 28, y: 35, radius: 5, color: 0xff4422 },
      { x: 42, y: 35, radius: 5, color: 0xff4422 },
      // Orange torches at ruins
      { x: 51, y: 9, radius: 3, color: 0xffaa55, flicker: true },
      { x: 59, y: 9, radius: 3, color: 0xffaa55, flicker: true },
      { x: 55, y: 17, radius: 3, color: 0xffaa55, flicker: true },
      // Green oasis light
      { x: 11, y: 56, radius: 4, color: 0x44ff88 },
      // Portal glows
      { x: 0, y: 35, radius: 4, color: 0x9b59b6 },
      { x: 69, y: 35, radius: 4, color: 0x9b59b6 },
      // Dungeon portal red glow
      { x: 35, y: 20, radius: 5, color: 0xe74c3c },
    ],
  };
}

// --- Frozen Wastes ---
function createFrozenWastes(): ZoneDef {
  const w = 70, h = 70;
  const tiles = generateTiles(w, h, TileType.SAND);

  // === Mountain ice formations along north and east borders (3 tiles thick) ===
  applyFeature(tiles, 0, 0, 70, 3, TileType.MOUNTAIN);
  applyFeature(tiles, 67, 0, 3, 70, TileType.MOUNTAIN);

  // === Large frozen lake center ===
  applyOval(tiles, 35, 30, 10, 7, TileType.WATER);

  // === Ice cave alcove (x=55-62, y=10-16): MOUNTAIN walls + BUILDING_FLOOR interior ===
  applyFeature(tiles, 55, 10, 8, 1, TileType.MOUNTAIN);   // top wall
  applyFeature(tiles, 55, 16, 8, 1, TileType.MOUNTAIN);   // bottom wall
  applyFeature(tiles, 55, 10, 1, 7, TileType.MOUNTAIN);   // left wall
  applyFeature(tiles, 62, 10, 1, 7, TileType.MOUNTAIN);   // right wall
  applyFeature(tiles, 56, 11, 6, 5, TileType.BUILDING_FLOOR); // interior
  // Door gap on south wall (x=58,59 at y=16)
  setTile(tiles, 58, 16, TileType.BUILDING_FLOOR);
  setTile(tiles, 59, 16, TileType.BUILDING_FLOOR);

  // === Outpost (x=15, y=50): 6x5 BUILDING_FLOOR with COBBLESTONE path ===
  applyFeature(tiles, 15, 50, 6, 5, TileType.BUILDING_FLOOR);
  // Cobblestone path leading to outpost from the east
  applyFeature(tiles, 21, 52, 14, 2, TileType.COBBLESTONE);

  // === Dead forest patches in SE ===
  applyNoisyRect(tiles, 45, 45, 15, 15, TileType.FOREST, 0.3, 42);

  // === Crystal formations: small diamond-shaped MOUNTAIN clusters ===
  // Crystal at (25, 15)
  setTile(tiles, 25, 14, TileType.MOUNTAIN);
  setTile(tiles, 24, 15, TileType.MOUNTAIN);
  setTile(tiles, 25, 15, TileType.MOUNTAIN);
  setTile(tiles, 26, 15, TileType.MOUNTAIN);
  setTile(tiles, 25, 16, TileType.MOUNTAIN);
  // Crystal at (50, 40)
  setTile(tiles, 50, 39, TileType.MOUNTAIN);
  setTile(tiles, 49, 40, TileType.MOUNTAIN);
  setTile(tiles, 50, 40, TileType.MOUNTAIN);
  setTile(tiles, 51, 40, TileType.MOUNTAIN);
  setTile(tiles, 50, 41, TileType.MOUNTAIN);
  // Crystal at (15, 30)
  setTile(tiles, 15, 29, TileType.MOUNTAIN);
  setTile(tiles, 14, 30, TileType.MOUNTAIN);
  setTile(tiles, 15, 30, TileType.MOUNTAIN);
  setTile(tiles, 16, 30, TileType.MOUNTAIN);
  setTile(tiles, 15, 31, TileType.MOUNTAIN);

  // === Portals ===
  // West edge → target scorched_highlands (68, 35)
  tiles[35][0] = TileType.PORTAL;
  tiles[36][0] = TileType.PORTAL;
  // Dungeon portal at (35, 55) → target dragons_lair (6, 25)
  tiles[55][35] = TileType.DUNGEON_PORTAL;

  return {
    id: "frozen_wastes",
    name: "Frozen Wastes",
    width: w,
    height: h,
    tiles,
    spawnX: 2,
    spawnY: 35,
    portals: [
      { x: 0, y: 35, targetZoneId: "scorched_highlands", targetX: 68, targetY: 35 },
      { x: 0, y: 36, targetZoneId: "scorched_highlands", targetX: 68, targetY: 35 },
      { x: 35, y: 55, targetZoneId: "dragons_lair", targetX: 6, targetY: 25, dungeonId: "dragons_lair" },
    ],
    mobSpawns: [
      { mobId: "frost_wolf", x: 20, y: 20, count: 4, wanderRadius: 6 },
      { mobId: "frost_wolf", x: 50, y: 55, count: 3, wanderRadius: 5 },
      { mobId: "ice_wraith", x: 35, y: 25, count: 3, wanderRadius: 5 },
      { mobId: "ice_wraith", x: 15, y: 35, count: 2, wanderRadius: 4 },
      { mobId: "yeti", x: 55, y: 30, count: 2, wanderRadius: 4 },
      { mobId: "yeti", x: 25, y: 55, count: 2, wanderRadius: 5 },
      { mobId: "crystal_golem", x: 25, y: 15, count: 2, wanderRadius: 3 },
      { mobId: "crystal_golem", x: 50, y: 40, count: 2, wanderRadius: 3 },
    ],
    npcSpawns: [
      { npcId: "ranger_frost", name: "Ranger Frost", x: 17, y: 52, dialog: "The Dragon's Lair lies beyond the frozen lake. Its minions have been terrorizing this land.", quests: ["frozen_hunt", "crystal_shards"] },
    ],
    lights: [
      // Blue-white lights around frozen lake
      { x: 35, y: 30, radius: 10, color: 0x88bbff },
      { x: 26, y: 30, radius: 5, color: 0x88bbff },
      { x: 44, y: 30, radius: 5, color: 0x88bbff },
      // Warm orange at outpost
      { x: 17, y: 51, radius: 3, color: 0xffaa55, flicker: true },
      { x: 19, y: 53, radius: 3, color: 0xffaa55, flicker: true },
      // Portal glow
      { x: 0, y: 35, radius: 4, color: 0x9b59b6 },
      // Dungeon portal red glow
      { x: 35, y: 55, radius: 5, color: 0xe74c3c },
    ],
  };
}

export const ZONE_DEFS: ZoneDef[] = [
  createGreendale(),
  createDarkwood(),
  createFields(),
  createScorchedHighlands(),
  createFrozenWastes(),
];
