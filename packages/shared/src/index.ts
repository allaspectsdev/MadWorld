// Types
export * from "./types/entity.js";
export * from "./types/map.js";
export * from "./types/player.js";
export * from "./types/skill.js";
export * from "./types/item.js";
export * from "./types/mob.js";
export * from "./types/combat.js";
export * from "./types/recipe.js";
export * from "./types/quest.js";
export * from "./types/party.js";
export * from "./types/dungeon.js";

// Constants
export * from "./constants/game.js";
export * from "./constants/skills.js";
export { ITEMS, getItem } from "./constants/items.js";
export { MOBS } from "./constants/mobs.js";
export { QUESTS } from "./constants/quests.js";
export { ABILITIES, type AbilityDef } from "./constants/abilities.js";
export { SHOPS, type ShopEntry } from "./constants/shops.js";
export { FISHING_SPOTS, type FishingSpotDef } from "./constants/fishing.js";
export { RESOURCE_NODES, getNodesForBiome, type ResourceNodeDef } from "./constants/gathering.js";
export { CAMP_ITEMS, RECIPES, getRecipe, getRecipesForSkill, type CampItemDef, type CraftRecipe } from "./constants/camps.js";
export { LANDMARKS, getLandmark, getLandmarksForBiome, type LandmarkDef, type LandmarkPlacement } from "./constants/landmarks.js";
export {
  FURNITURE, GARDEN_SEEDS, VISITORS,
  HOMESTEAD_SIZE, HOMESTEAD_MAX_FURNITURE, HOMESTEAD_MAX_GARDENS,
  type FurnitureDef, type FurnitureCategory, type PlacedFurniture,
  type GardenSeedDef, type GardenPlant, type VisitorDef,
} from "./constants/homestead.js";
export { STATUS_EFFECTS, type StatusEffectDef } from "./types/statusEffect.js";

// Formulas
export * as combatFormulas from "./formulas/combat.js";
export * as skillFormulas from "./formulas/skills.js";
export * as movementFormulas from "./formulas/movement.js";

// Networking
export { Op } from "./net/opcodes.js";
export * from "./net/messages.js";

// Spatial
export * from "./spatial.js";

// Isometric
export * from "./isometric.js";

// Noise / procedural generation
export { createNoise2D, octaveNoise, type Noise2D } from "./noise.js";

// Biome system
export {
  Biome,
  deriveBiome,
  biomePrimaryTile,
  biomeColor,
  WORLD_CHUNK_SIZE,
  DEFAULT_WORLD_SEED,
  TERRAIN_SCALES,
} from "./biome.js";
