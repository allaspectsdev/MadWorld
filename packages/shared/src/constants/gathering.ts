/**
 * Resource node definitions for the gathering system.
 *
 * Some nodes are "co-op only" — they require two players to harvest.
 * One player "holds" (stabilizes), the other "extracts".
 */

import { SkillName } from "../types/skill.js";
import { Biome } from "../biome.js";

export interface ResourceNodeDef {
  id: string;
  name: string;
  skill: SkillName;
  levelRequired: number;
  /** Ticks to complete gathering (at 10 ticks/sec). */
  gatherTicks: number;
  /** Item(s) yielded on success. */
  yields: { itemId: string; quantity: number; chance?: number }[];
  /** XP granted on success. */
  xp: number;
  /** If true, requires two players. */
  coopRequired: boolean;
  /** Co-op bonus: extra items/XP when gathered with partner. */
  coopBonus?: { extraYield?: { itemId: string; quantity: number }; xpMultiplier?: number };
  /** Ticks until node respawns after depletion. */
  respawnTicks: number;
  /** Biomes where this node naturally spawns. */
  biomes: Biome[];
  /** Spawn density per chunk (0..1). */
  density: number;
}

export const RESOURCE_NODES: Record<string, ResourceNodeDef> = {
  // ---- Mining ----
  copper_vein: {
    id: "copper_vein",
    name: "Copper Vein",
    skill: SkillName.MINING,
    levelRequired: 1,
    gatherTicks: 30,
    yields: [{ itemId: "copper_ore", quantity: 1 }],
    xp: 20,
    coopRequired: false,
    respawnTicks: 300,
    biomes: [Biome.MOUNTAINS, Biome.PLAINS, Biome.FOREST],
    density: 0.003,
  },
  iron_deposit: {
    id: "iron_deposit",
    name: "Iron Deposit",
    skill: SkillName.MINING,
    levelRequired: 15,
    gatherTicks: 50,
    yields: [{ itemId: "iron_ore", quantity: 1 }],
    xp: 40,
    coopRequired: false,
    respawnTicks: 500,
    biomes: [Biome.MOUNTAINS],
    density: 0.002,
  },
  crystal_formation: {
    id: "crystal_formation",
    name: "Crystal Formation",
    skill: SkillName.MINING,
    levelRequired: 30,
    gatherTicks: 80,
    yields: [
      { itemId: "raw_crystal", quantity: 1 },
      { itemId: "crystal_shard", quantity: 2, chance: 0.3 },
    ],
    xp: 80,
    coopRequired: true,
    coopBonus: { extraYield: { itemId: "crystal_shard", quantity: 1 }, xpMultiplier: 1.5 },
    respawnTicks: 900,
    biomes: [Biome.MOUNTAINS, Biome.SNOW_PEAKS],
    density: 0.001,
  },

  // ---- Woodcutting ----
  oak_tree: {
    id: "oak_tree",
    name: "Oak Tree",
    skill: SkillName.WOODCUTTING,
    levelRequired: 1,
    gatherTicks: 25,
    yields: [{ itemId: "oak_log", quantity: 1 }],
    xp: 15,
    coopRequired: false,
    respawnTicks: 200,
    biomes: [Biome.FOREST, Biome.PLAINS],
    density: 0.005,
  },
  ancient_tree: {
    id: "ancient_tree",
    name: "Ancient Tree",
    skill: SkillName.WOODCUTTING,
    levelRequired: 40,
    gatherTicks: 100,
    yields: [
      { itemId: "ancient_wood", quantity: 1 },
      { itemId: "tree_sap", quantity: 1, chance: 0.4 },
    ],
    xp: 100,
    coopRequired: true,
    coopBonus: { extraYield: { itemId: "ancient_wood", quantity: 1 }, xpMultiplier: 1.5 },
    respawnTicks: 1200,
    biomes: [Biome.DENSE_FOREST, Biome.JUNGLE],
    density: 0.0005,
  },

  // ---- Foraging ----
  herb_patch: {
    id: "herb_patch",
    name: "Herb Patch",
    skill: SkillName.FORAGING,
    levelRequired: 1,
    gatherTicks: 15,
    yields: [{ itemId: "wild_herb", quantity: 2 }],
    xp: 12,
    coopRequired: false,
    respawnTicks: 150,
    biomes: [Biome.PLAINS, Biome.FOREST, Biome.SWAMP],
    density: 0.004,
  },
  rare_mushroom: {
    id: "rare_mushroom",
    name: "Rare Mushroom",
    skill: SkillName.FORAGING,
    levelRequired: 20,
    gatherTicks: 40,
    yields: [{ itemId: "luminous_mushroom", quantity: 1 }],
    xp: 50,
    coopRequired: false,
    respawnTicks: 600,
    biomes: [Biome.SWAMP, Biome.DENSE_FOREST, Biome.JUNGLE],
    density: 0.001,
  },
  giant_flower: {
    id: "giant_flower",
    name: "Giant Flower",
    skill: SkillName.FORAGING,
    levelRequired: 35,
    gatherTicks: 70,
    yields: [
      { itemId: "giant_petal", quantity: 1 },
      { itemId: "rare_pollen", quantity: 1, chance: 0.25 },
    ],
    xp: 75,
    coopRequired: true,
    coopBonus: { extraYield: { itemId: "rare_pollen", quantity: 1 }, xpMultiplier: 1.5 },
    respawnTicks: 800,
    biomes: [Biome.JUNGLE, Biome.SWAMP],
    density: 0.0008,
  },
};

/** Get all resource node IDs that spawn in a given biome. */
export function getNodesForBiome(biome: Biome): ResourceNodeDef[] {
  return Object.values(RESOURCE_NODES).filter((n) => n.biomes.includes(biome));
}
