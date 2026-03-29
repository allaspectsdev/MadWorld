/**
 * Skill specializations — binary choice nodes at levels 25, 50, and 75.
 *
 * At each threshold, the player picks one of two paths. The choice is
 * permanent and grants a passive bonus. This creates build identity
 * without adding new skills.
 */

import { SkillName } from "../types/skill.js";

export interface SpecChoice {
  id: string;
  name: string;
  description: string;
  /** Passive effect applied while this spec is active. */
  effect: SpecEffect;
}

export interface SpecNode {
  skillId: SkillName;
  level: number;          // 25, 50, or 75
  choiceA: SpecChoice;
  choiceB: SpecChoice;
}

export type SpecEffect =
  | { type: "damage_mult"; value: number }
  | { type: "speed_mult"; value: number }
  | { type: "crit_chance"; value: number }
  | { type: "defense_mult"; value: number }
  | { type: "hp_mult"; value: number }
  | { type: "xp_mult"; skill: SkillName; value: number }
  | { type: "yield_mult"; skill: SkillName; value: number }
  | { type: "gather_speed"; skill: SkillName; value: number }
  | { type: "cook_burn_reduce"; value: number }
  | { type: "fish_catch_mult"; value: number }
  | { type: "potion_power"; value: number }
  | { type: "discovery_xp_mult"; value: number };

/** All specialization nodes keyed by "skillId:level". */
export const SPEC_NODES: Record<string, SpecNode> = {
  // ---- Melee ----
  "melee:25": {
    skillId: SkillName.MELEE, level: 25,
    choiceA: { id: "berserker", name: "Berserker", description: "+15% melee damage", effect: { type: "damage_mult", value: 0.15 } },
    choiceB: { id: "duelist", name: "Duelist", description: "+10% crit chance", effect: { type: "crit_chance", value: 0.10 } },
  },
  "melee:50": {
    skillId: SkillName.MELEE, level: 50,
    choiceA: { id: "warlord", name: "Warlord", description: "+10% max HP", effect: { type: "hp_mult", value: 0.10 } },
    choiceB: { id: "blademaster", name: "Blademaster", description: "+20% attack speed", effect: { type: "speed_mult", value: 0.20 } },
  },
  "melee:75": {
    skillId: SkillName.MELEE, level: 75,
    choiceA: { id: "champion", name: "Champion", description: "+25% melee damage", effect: { type: "damage_mult", value: 0.25 } },
    choiceB: { id: "guardian", name: "Guardian", description: "+20% defense", effect: { type: "defense_mult", value: 0.20 } },
  },

  // ---- Ranged ----
  "ranged:25": {
    skillId: SkillName.RANGED, level: 25,
    choiceA: { id: "sharpshooter", name: "Sharpshooter", description: "+15% ranged damage", effect: { type: "damage_mult", value: 0.15 } },
    choiceB: { id: "scout", name: "Scout", description: "+15% movement speed", effect: { type: "speed_mult", value: 0.15 } },
  },
  "ranged:50": {
    skillId: SkillName.RANGED, level: 50,
    choiceA: { id: "marksman", name: "Marksman", description: "+15% crit chance", effect: { type: "crit_chance", value: 0.15 } },
    choiceB: { id: "tracker", name: "Tracker", description: "+50% discovery XP", effect: { type: "discovery_xp_mult", value: 0.50 } },
  },
  "ranged:75": {
    skillId: SkillName.RANGED, level: 75,
    choiceA: { id: "sniper", name: "Sniper", description: "+30% ranged damage", effect: { type: "damage_mult", value: 0.30 } },
    choiceB: { id: "ranger", name: "Ranger", description: "+25% speed + 10% defense", effect: { type: "speed_mult", value: 0.25 } },
  },

  // ---- Defense ----
  "defense:25": {
    skillId: SkillName.DEFENSE, level: 25,
    choiceA: { id: "iron_skin", name: "Iron Skin", description: "+15% defense", effect: { type: "defense_mult", value: 0.15 } },
    choiceB: { id: "vitality", name: "Vitality", description: "+15% max HP", effect: { type: "hp_mult", value: 0.15 } },
  },
  "defense:50": {
    skillId: SkillName.DEFENSE, level: 50,
    choiceA: { id: "fortress", name: "Fortress", description: "+25% defense", effect: { type: "defense_mult", value: 0.25 } },
    choiceB: { id: "resilience", name: "Resilience", description: "+20% max HP", effect: { type: "hp_mult", value: 0.20 } },
  },
  "defense:75": {
    skillId: SkillName.DEFENSE, level: 75,
    choiceA: { id: "juggernaut", name: "Juggernaut", description: "+35% defense", effect: { type: "defense_mult", value: 0.35 } },
    choiceB: { id: "titan", name: "Titan", description: "+30% max HP", effect: { type: "hp_mult", value: 0.30 } },
  },

  // ---- Agility ----
  "agility:25": {
    skillId: SkillName.AGILITY, level: 25,
    choiceA: { id: "sprinter", name: "Sprinter", description: "+15% movement speed", effect: { type: "speed_mult", value: 0.15 } },
    choiceB: { id: "acrobat", name: "Acrobat", description: "+10% dodge (defense)", effect: { type: "defense_mult", value: 0.10 } },
  },
  "agility:50": {
    skillId: SkillName.AGILITY, level: 50,
    choiceA: { id: "wind_walker", name: "Wind Walker", description: "+25% movement speed", effect: { type: "speed_mult", value: 0.25 } },
    choiceB: { id: "shadow_step", name: "Shadow Step", description: "+15% crit chance", effect: { type: "crit_chance", value: 0.15 } },
  },
  "agility:75": {
    skillId: SkillName.AGILITY, level: 75,
    choiceA: { id: "flash", name: "Flash", description: "+35% movement speed", effect: { type: "speed_mult", value: 0.35 } },
    choiceB: { id: "assassin", name: "Assassin", description: "+20% crit + 15% damage", effect: { type: "crit_chance", value: 0.20 } },
  },

  // ---- Fishing ----
  "fishing:25": {
    skillId: SkillName.FISHING, level: 25,
    choiceA: { id: "angler", name: "Angler", description: "+25% catch rate", effect: { type: "fish_catch_mult", value: 0.25 } },
    choiceB: { id: "fishmonger", name: "Fishmonger", description: "+25% fishing XP", effect: { type: "xp_mult", skill: SkillName.FISHING, value: 0.25 } },
  },
  "fishing:50": {
    skillId: SkillName.FISHING, level: 50,
    choiceA: { id: "deep_sea", name: "Deep Sea Fisher", description: "+50% catch rate", effect: { type: "fish_catch_mult", value: 0.50 } },
    choiceB: { id: "bait_master", name: "Bait Master", description: "+50% fishing XP", effect: { type: "xp_mult", skill: SkillName.FISHING, value: 0.50 } },
  },
  "fishing:75": {
    skillId: SkillName.FISHING, level: 75,
    choiceA: { id: "leviathan", name: "Leviathan Hunter", description: "+75% catch rate", effect: { type: "fish_catch_mult", value: 0.75 } },
    choiceB: { id: "sea_sage", name: "Sea Sage", description: "+75% fishing XP", effect: { type: "xp_mult", skill: SkillName.FISHING, value: 0.75 } },
  },

  // ---- Mining ----
  "mining:25": {
    skillId: SkillName.MINING, level: 25,
    choiceA: { id: "prospector", name: "Prospector", description: "+25% ore yield", effect: { type: "yield_mult", skill: SkillName.MINING, value: 0.25 } },
    choiceB: { id: "efficient_miner", name: "Efficient Miner", description: "+25% mining speed", effect: { type: "gather_speed", skill: SkillName.MINING, value: 0.25 } },
  },
  "mining:50": {
    skillId: SkillName.MINING, level: 50,
    choiceA: { id: "geologist", name: "Geologist", description: "+50% ore yield", effect: { type: "yield_mult", skill: SkillName.MINING, value: 0.50 } },
    choiceB: { id: "deep_miner", name: "Deep Miner", description: "+50% mining XP", effect: { type: "xp_mult", skill: SkillName.MINING, value: 0.50 } },
  },
  "mining:75": {
    skillId: SkillName.MINING, level: 75,
    choiceA: { id: "master_miner", name: "Master Miner", description: "+75% yield + 25% speed", effect: { type: "yield_mult", skill: SkillName.MINING, value: 0.75 } },
    choiceB: { id: "jeweler", name: "Jeweler", description: "Double rare gem drops", effect: { type: "yield_mult", skill: SkillName.MINING, value: 1.0 } },
  },

  // ---- Woodcutting ----
  "woodcutting:25": {
    skillId: SkillName.WOODCUTTING, level: 25,
    choiceA: { id: "lumberjack", name: "Lumberjack", description: "+25% wood yield", effect: { type: "yield_mult", skill: SkillName.WOODCUTTING, value: 0.25 } },
    choiceB: { id: "swift_axe", name: "Swift Axe", description: "+25% chop speed", effect: { type: "gather_speed", skill: SkillName.WOODCUTTING, value: 0.25 } },
  },
  "woodcutting:50": {
    skillId: SkillName.WOODCUTTING, level: 50,
    choiceA: { id: "forester", name: "Forester", description: "+50% wood yield", effect: { type: "yield_mult", skill: SkillName.WOODCUTTING, value: 0.50 } },
    choiceB: { id: "tree_whisperer", name: "Tree Whisperer", description: "+50% woodcutting XP", effect: { type: "xp_mult", skill: SkillName.WOODCUTTING, value: 0.50 } },
  },
  "woodcutting:75": {
    skillId: SkillName.WOODCUTTING, level: 75,
    choiceA: { id: "timber_lord", name: "Timber Lord", description: "+75% wood yield", effect: { type: "yield_mult", skill: SkillName.WOODCUTTING, value: 0.75 } },
    choiceB: { id: "boat_builder", name: "Boat Builder", description: "+50% boat HP when crafted", effect: { type: "yield_mult", skill: SkillName.WOODCUTTING, value: 0.50 } },
  },

  // ---- Foraging ----
  "foraging:25": {
    skillId: SkillName.FORAGING, level: 25,
    choiceA: { id: "herbalist_spec", name: "Herbalist", description: "+25% herb yield", effect: { type: "yield_mult", skill: SkillName.FORAGING, value: 0.25 } },
    choiceB: { id: "green_thumb", name: "Green Thumb", description: "+25% garden grow speed", effect: { type: "gather_speed", skill: SkillName.FORAGING, value: 0.25 } },
  },
  "foraging:50": {
    skillId: SkillName.FORAGING, level: 50,
    choiceA: { id: "botanist", name: "Botanist", description: "+50% forage yield", effect: { type: "yield_mult", skill: SkillName.FORAGING, value: 0.50 } },
    choiceB: { id: "naturalist", name: "Naturalist", description: "+50% foraging XP", effect: { type: "xp_mult", skill: SkillName.FORAGING, value: 0.50 } },
  },
  "foraging:75": {
    skillId: SkillName.FORAGING, level: 75,
    choiceA: { id: "druid", name: "Druid", description: "+75% forage yield", effect: { type: "yield_mult", skill: SkillName.FORAGING, value: 0.75 } },
    choiceB: { id: "mycologist", name: "Mycologist", description: "Double rare mushroom drops", effect: { type: "yield_mult", skill: SkillName.FORAGING, value: 1.0 } },
  },

  // ---- Cooking ----
  "cooking:25": {
    skillId: SkillName.COOKING, level: 25,
    choiceA: { id: "careful_cook", name: "Careful Cook", description: "-25% burn chance", effect: { type: "cook_burn_reduce", value: 0.25 } },
    choiceB: { id: "hearty_meals", name: "Hearty Meals", description: "+25% food healing", effect: { type: "potion_power", value: 0.25 } },
  },
  "cooking:50": {
    skillId: SkillName.COOKING, level: 50,
    choiceA: { id: "master_chef", name: "Master Chef", description: "-50% burn chance", effect: { type: "cook_burn_reduce", value: 0.50 } },
    choiceB: { id: "gourmet", name: "Gourmet", description: "+50% food healing", effect: { type: "potion_power", value: 0.50 } },
  },
  "cooking:75": {
    skillId: SkillName.COOKING, level: 75,
    choiceA: { id: "never_burn", name: "Iron Stomach", description: "-90% burn chance", effect: { type: "cook_burn_reduce", value: 0.90 } },
    choiceB: { id: "feast_maker", name: "Feast Maker", description: "+75% food healing + cooking XP", effect: { type: "potion_power", value: 0.75 } },
  },

  // ---- Smithing ----
  "smithing:25": {
    skillId: SkillName.SMITHING, level: 25,
    choiceA: { id: "weaponsmith", name: "Weaponsmith", description: "+25% smithing XP from weapons", effect: { type: "xp_mult", skill: SkillName.SMITHING, value: 0.25 } },
    choiceB: { id: "armorsmith", name: "Armorsmith", description: "+25% smithing yield", effect: { type: "yield_mult", skill: SkillName.SMITHING, value: 0.25 } },
  },
  "smithing:50": {
    skillId: SkillName.SMITHING, level: 50,
    choiceA: { id: "master_smith", name: "Master Smith", description: "+50% smithing XP", effect: { type: "xp_mult", skill: SkillName.SMITHING, value: 0.50 } },
    choiceB: { id: "efficient_smith", name: "Efficient Smith", description: "+50% smelt speed", effect: { type: "gather_speed", skill: SkillName.SMITHING, value: 0.50 } },
  },
  "smithing:75": {
    skillId: SkillName.SMITHING, level: 75,
    choiceA: { id: "legendary_smith", name: "Legendary Smith", description: "+75% smithing XP", effect: { type: "xp_mult", skill: SkillName.SMITHING, value: 0.75 } },
    choiceB: { id: "enchanter", name: "Enchanter", description: "+50% gem yield from smithing", effect: { type: "yield_mult", skill: SkillName.SMITHING, value: 0.50 } },
  },

  // ---- Alchemy ----
  "alchemy:25": {
    skillId: SkillName.ALCHEMY, level: 25,
    choiceA: { id: "potion_brewer", name: "Potion Brewer", description: "+25% potion power", effect: { type: "potion_power", value: 0.25 } },
    choiceB: { id: "quick_brew", name: "Quick Brewer", description: "+25% alchemy XP", effect: { type: "xp_mult", skill: SkillName.ALCHEMY, value: 0.25 } },
  },
  "alchemy:50": {
    skillId: SkillName.ALCHEMY, level: 50,
    choiceA: { id: "master_alchemist", name: "Master Alchemist", description: "+50% potion power", effect: { type: "potion_power", value: 0.50 } },
    choiceB: { id: "reagent_saver", name: "Reagent Saver", description: "+50% alchemy yield", effect: { type: "yield_mult", skill: SkillName.ALCHEMY, value: 0.50 } },
  },
  "alchemy:75": {
    skillId: SkillName.ALCHEMY, level: 75,
    choiceA: { id: "archmage", name: "Archmage", description: "+75% potion power", effect: { type: "potion_power", value: 0.75 } },
    choiceB: { id: "philosopher", name: "Philosopher", description: "+100% alchemy XP", effect: { type: "xp_mult", skill: SkillName.ALCHEMY, value: 1.0 } },
  },
};

/** The three threshold levels where specialization choices occur. */
export const SPEC_LEVELS = [25, 50, 75] as const;

/** Get the spec node for a skill at a given level, or undefined. */
export function getSpecNode(skillId: SkillName, level: number): SpecNode | undefined {
  return SPEC_NODES[`${skillId}:${level}`];
}

/** Stored specialization choice for a player. */
export interface PlayerSpec {
  skillId: string;
  level: number;
  choiceId: string;
}
