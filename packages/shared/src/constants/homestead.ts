/**
 * Homestead system — Tier 4 camp upgrade.
 *
 * A 16x16 buildable plot where players place furniture, grow gardens,
 * display trophies, and receive NPC merchant visitors.
 */

/** Grid size for a homestead plot. */
export const HOMESTEAD_SIZE = 16;

/** Max furniture items per homestead. */
export const HOMESTEAD_MAX_FURNITURE = 32;

/** Max garden plots per homestead. */
export const HOMESTEAD_MAX_GARDENS = 6;

// ---- Furniture ----

export type FurnitureCategory =
  | "crafting"   // Crafting stations (anvil, alchemy table, loom)
  | "storage"    // Extra storage chests
  | "cooking"    // Cooking fire, oven
  | "decoration" // Rugs, banners, statues
  | "trophy"     // Boss trophy mounts
  | "garden"     // Garden plot
  | "utility";   // Map table, repair bench

export interface FurnitureDef {
  id: string;
  name: string;
  category: FurnitureCategory;
  /** Footprint in tiles (most are 1x1 or 2x1). */
  width: number;
  height: number;
  /** Item ID required to place this furniture. */
  itemId: string;
  /** For trophy: which boss drop is displayed. */
  trophyItemId?: string;
  /** For storage: how many slots this adds. */
  storageSlots?: number;
  /** For garden: which seed types can be planted. */
  gardenSlots?: number;
}

export const FURNITURE: Record<string, FurnitureDef> = {
  // Crafting
  anvil: {
    id: "anvil", name: "Anvil", category: "crafting",
    width: 1, height: 1, itemId: "anvil_kit",
  },
  alchemy_table: {
    id: "alchemy_table", name: "Alchemy Table", category: "crafting",
    width: 2, height: 1, itemId: "alchemy_table_kit",
  },
  cooking_hearth: {
    id: "cooking_hearth", name: "Cooking Hearth", category: "cooking",
    width: 2, height: 1, itemId: "cooking_hearth_kit",
  },

  // Storage
  large_chest: {
    id: "large_chest", name: "Large Chest", category: "storage",
    width: 1, height: 1, itemId: "large_chest_kit", storageSlots: 12,
  },
  weapon_rack: {
    id: "weapon_rack", name: "Weapon Rack", category: "storage",
    width: 2, height: 1, itemId: "weapon_rack_kit", storageSlots: 6,
  },

  // Decoration
  banner: {
    id: "banner", name: "Banner", category: "decoration",
    width: 1, height: 1, itemId: "banner_kit",
  },
  rug: {
    id: "rug", name: "Woven Rug", category: "decoration",
    width: 2, height: 2, itemId: "rug_kit",
  },
  statue: {
    id: "statue", name: "Stone Statue", category: "decoration",
    width: 1, height: 1, itemId: "statue_kit",
  },

  // Trophy
  trophy_mount: {
    id: "trophy_mount", name: "Trophy Mount", category: "trophy",
    width: 1, height: 1, itemId: "trophy_mount_kit",
  },

  // Garden
  garden_plot: {
    id: "garden_plot", name: "Garden Plot", category: "garden",
    width: 2, height: 2, itemId: "garden_plot_kit", gardenSlots: 4,
  },

  // Utility
  map_table: {
    id: "map_table", name: "Map Table", category: "utility",
    width: 2, height: 1, itemId: "map_table_kit",
  },
  repair_bench: {
    id: "repair_bench", name: "Repair Bench", category: "utility",
    width: 2, height: 1, itemId: "repair_bench_kit",
  },
};

// ---- Placed furniture instance ----

export interface PlacedFurniture {
  furnitureId: string;
  /** Grid position within the 16x16 homestead plot. */
  gridX: number;
  gridY: number;
  /** For trophy mounts: the item being displayed. */
  displayItemId?: string;
  /** For storage: items inside this piece. */
  storage?: { itemId: string; quantity: number }[];
}

// ---- Garden ----

export interface GardenSeedDef {
  id: string;
  name: string;
  /** Item ID of the seed. */
  seedItemId: string;
  /** Item ID of the harvest. */
  harvestItemId: string;
  /** Harvest quantity per plot. */
  harvestQuantity: number;
  /** Real-time grow duration in seconds. */
  growTimeSeconds: number;
  /** Foraging level required to plant. */
  levelRequired: number;
  /** XP granted on harvest. */
  xp: number;
}

export const GARDEN_SEEDS: Record<string, GardenSeedDef> = {
  herb_seed: {
    id: "herb_seed", name: "Herb Seed",
    seedItemId: "herb_seed", harvestItemId: "wild_herb",
    harvestQuantity: 3, growTimeSeconds: 300, // 5 min
    levelRequired: 1, xp: 20,
  },
  potato_seed: {
    id: "potato_seed", name: "Potato Seed",
    seedItemId: "potato_seed", harvestItemId: "potato",
    harvestQuantity: 2, growTimeSeconds: 600, // 10 min
    levelRequired: 5, xp: 35,
  },
  mushroom_spore: {
    id: "mushroom_spore", name: "Mushroom Spore",
    seedItemId: "mushroom_spore", harvestItemId: "luminous_mushroom",
    harvestQuantity: 1, growTimeSeconds: 900, // 15 min
    levelRequired: 15, xp: 50,
  },
  crystal_seed: {
    id: "crystal_seed", name: "Crystal Seed",
    seedItemId: "crystal_seed", harvestItemId: "crystal_shard",
    harvestQuantity: 2, growTimeSeconds: 1800, // 30 min
    levelRequired: 30, xp: 80,
  },
  ancient_sapling: {
    id: "ancient_sapling", name: "Ancient Sapling",
    seedItemId: "ancient_sapling", harvestItemId: "ancient_wood",
    harvestQuantity: 1, growTimeSeconds: 3600, // 60 min
    levelRequired: 40, xp: 120,
  },
};

/** State of a planted seed in a garden plot. */
export interface GardenPlant {
  seedId: string;
  /** Unix timestamp (ms) when planted. */
  plantedAt: number;
  /** Unix timestamp (ms) when ready to harvest. */
  readyAt: number;
}

// ---- NPC Visitors ----

export interface VisitorDef {
  id: string;
  name: string;
  /** Items this visitor sells (rare/unique). */
  shopItems: { itemId: string; price: number }[];
  /** How long the visitor stays (seconds). */
  stayDuration: number;
  /** Minimum homestead tier required. */
  minTier: number;
}

export const VISITORS: VisitorDef[] = [
  {
    id: "wandering_merchant",
    name: "Wandering Merchant",
    shopItems: [
      { itemId: "rare_mushroom_seed", price: 500 },
      { itemId: "golden_apple", price: 1000 },
    ],
    stayDuration: 600, // 10 min
    minTier: 4,
  },
  {
    id: "traveling_smith",
    name: "Traveling Smith",
    shopItems: [
      { itemId: "mithril_ore", price: 300 },
      { itemId: "enchanted_gem", price: 800 },
    ],
    stayDuration: 600,
    minTier: 4,
  },
  {
    id: "herbalist",
    name: "Wandering Herbalist",
    shopItems: [
      { itemId: "crystal_seed", price: 400 },
      { itemId: "ancient_sapling", price: 600 },
      { itemId: "herb_seed", price: 50 },
    ],
    stayDuration: 900, // 15 min
    minTier: 4,
  },
];
