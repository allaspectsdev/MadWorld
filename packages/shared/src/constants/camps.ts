/**
 * Camp item definitions and crafting recipes.
 *
 * Camp items are placed in the world to create persistent party structures.
 * Recipes use the existing RecipeDef interface but add a `combo` flag
 * for two-player crafting.
 */

import type { RecipeDef } from "../types/recipe.js";
import { SkillName } from "../types/skill.js";

// ---- Camp items (added to the ITEMS constant separately) ----

export interface CampItemDef {
  itemId: string;
  name: string;
  description: string;
  campTier: number; // 1=campfire, 2=small camp, 3=full camp
}

export const CAMP_ITEMS: CampItemDef[] = [
  {
    itemId: "campfire_kit",
    name: "Campfire Kit",
    description: "Place to create a campfire — a respawn point and fast-travel anchor.",
    campTier: 1,
  },
  {
    itemId: "camp_chest_kit",
    name: "Camp Chest Kit",
    description: "Upgrade a campfire to a small camp with shared storage.",
    campTier: 2,
  },
  {
    itemId: "camp_station_kit",
    name: "Camp Station Kit",
    description: "Upgrade to a full camp with crafting station and cooking fire.",
    campTier: 3,
  },
];

// ---- Crafting Recipes ----

export interface CraftRecipe extends RecipeDef {
  /** If true, requires two players contributing ingredients simultaneously. */
  combo: boolean;
}

export const RECIPES: CraftRecipe[] = [
  // ---- Camp crafting ----
  {
    id: "craft_campfire_kit",
    name: "Campfire Kit",
    skill: SkillName.WOODCUTTING,
    levelRequired: 5,
    ingredients: [
      { itemId: "oak_log", quantity: 5 },
      { itemId: "wild_herb", quantity: 2 },
    ],
    result: { itemId: "campfire_kit", quantity: 1 },
    xp: 30,
    durationTicks: 30,
    combo: false,
  },
  {
    id: "craft_camp_chest",
    name: "Camp Chest Kit",
    skill: SkillName.WOODCUTTING,
    levelRequired: 15,
    ingredients: [
      { itemId: "oak_log", quantity: 10 },
      { itemId: "iron_ore", quantity: 3 },
    ],
    result: { itemId: "camp_chest_kit", quantity: 1 },
    xp: 60,
    durationTicks: 50,
    combo: false,
  },
  {
    id: "craft_camp_station",
    name: "Camp Station Kit",
    skill: SkillName.SMITHING,
    levelRequired: 25,
    ingredients: [
      { itemId: "oak_log", quantity: 15 },
      { itemId: "iron_ore", quantity: 8 },
      { itemId: "copper_ore", quantity: 5 },
    ],
    result: { itemId: "camp_station_kit", quantity: 1 },
    xp: 100,
    durationTicks: 80,
    combo: true, // Requires two players!
  },

  // ---- Basic gathering material recipes ----
  {
    id: "smelt_copper_bar",
    name: "Copper Bar",
    skill: SkillName.SMITHING,
    levelRequired: 1,
    ingredients: [{ itemId: "copper_ore", quantity: 2 }],
    result: { itemId: "copper_bar", quantity: 1 },
    xp: 15,
    durationTicks: 20,
    combo: false,
  },
  {
    id: "smelt_iron_bar",
    name: "Iron Bar",
    skill: SkillName.SMITHING,
    levelRequired: 15,
    ingredients: [{ itemId: "iron_ore", quantity: 3 }],
    result: { itemId: "iron_bar", quantity: 1 },
    xp: 35,
    durationTicks: 30,
    combo: false,
  },

  // ---- Co-op combo recipes ----
  {
    id: "brew_healing_potion",
    name: "Healing Potion",
    skill: SkillName.ALCHEMY,
    levelRequired: 10,
    ingredients: [
      { itemId: "wild_herb", quantity: 3 },
      { itemId: "luminous_mushroom", quantity: 1 },
    ],
    result: { itemId: "healing_potion", quantity: 2 },
    xp: 40,
    durationTicks: 40,
    combo: true, // One player adds herbs, other adds mushroom
  },
  {
    id: "craft_crystal_amulet",
    name: "Crystal Amulet",
    skill: SkillName.SMITHING,
    levelRequired: 35,
    ingredients: [
      { itemId: "raw_crystal", quantity: 1 },
      { itemId: "iron_bar", quantity: 2 },
      { itemId: "crystal_shard", quantity: 3 },
    ],
    result: { itemId: "crystal_amulet", quantity: 1 },
    xp: 120,
    durationTicks: 100,
    combo: true,
  },
  {
    id: "cook_meat_stew",
    name: "Meat Stew",
    skill: SkillName.COOKING,
    levelRequired: 15,
    ingredients: [
      { itemId: "raw_trout", quantity: 1 },
      { itemId: "wild_herb", quantity: 2 },
    ],
    result: { itemId: "meat_stew", quantity: 1 },
    xp: 35,
    durationTicks: 35,
    combo: false,
    burnChance: (level: number) => Math.max(0, 0.4 - level * 0.01),
  },
];

/** Look up a recipe by ID. */
export function getRecipe(id: string): CraftRecipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

/** Get all recipes for a given skill. */
export function getRecipesForSkill(skill: string): CraftRecipe[] {
  return RECIPES.filter((r) => r.skill === skill);
}
