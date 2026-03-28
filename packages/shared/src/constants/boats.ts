/**
 * Boat system — craft vessels to cross water, fight sea creatures,
 * and discover ocean islands.
 *
 * Boats are items that can be placed at coast/sand tiles adjacent to water.
 * When a player enters a boat, they gain water movement capability.
 * Boats have HP and can be damaged by sea creatures.
 */

import { SkillName } from "../types/skill.js";

// ---- Boat Definitions ----

export interface BoatDef {
  id: string;
  name: string;
  /** Woodcutting level to craft. */
  craftLevel: number;
  /** Crafting ingredients. */
  ingredients: { itemId: string; quantity: number }[];
  /** Crafting XP awarded. */
  craftXp: number;
  /** Item ID in inventory. */
  itemId: string;
  /** Hit points. */
  maxHp: number;
  /** Movement speed multiplier on water (relative to base player speed). */
  speedMultiplier: number;
  /** Can traverse deep ocean (OCEAN biome) or only shallow water? */
  deepWater: boolean;
}

export const BOATS: Record<string, BoatDef> = {
  raft: {
    id: "raft",
    name: "Raft",
    craftLevel: 20,
    ingredients: [
      { itemId: "oak_log", quantity: 8 },
      { itemId: "wild_herb", quantity: 3 }, // rope fiber
    ],
    craftXp: 60,
    itemId: "raft",
    maxHp: 30,
    speedMultiplier: 0.6,
    deepWater: false, // Coast only
  },
  small_boat: {
    id: "small_boat",
    name: "Small Boat",
    craftLevel: 30,
    ingredients: [
      { itemId: "oak_log", quantity: 15 },
      { itemId: "iron_ore", quantity: 5 },
    ],
    craftXp: 120,
    itemId: "small_boat",
    maxHp: 60,
    speedMultiplier: 0.8,
    deepWater: true,
  },
  sailboat: {
    id: "sailboat",
    name: "Sailboat",
    craftLevel: 50,
    ingredients: [
      { itemId: "ancient_wood", quantity: 5 },
      { itemId: "iron_bar", quantity: 8 },
      { itemId: "oak_log", quantity: 20 },
    ],
    craftXp: 250,
    itemId: "sailboat",
    maxHp: 120,
    speedMultiplier: 1.2,
    deepWater: true,
  },
};

// ---- Boat State (on player) ----

export interface BoatState {
  boatId: string;
  hp: number;
  maxHp: number;
  speedMultiplier: number;
  deepWater: boolean;
}

// ---- Sea Creatures ----

export interface SeaCreatureDef {
  mobId: string;
  name: string;
  level: number;
  maxHp: number;
  attack: number;
  defense: number;
  /** Damage dealt to boats per hit. */
  boatDamage: number;
  xpReward: number;
  /** Spawn density in ocean chunks (0..1). */
  density: number;
  /** Only spawns in deep ocean (not coast). */
  deepOnly: boolean;
  aggroRange: number;
  loot: { itemId: string; quantity: number; chance: number }[];
}

export const SEA_CREATURES: SeaCreatureDef[] = [
  {
    mobId: "shark",
    name: "Shark",
    level: 25,
    maxHp: 80,
    attack: 18,
    defense: 10,
    boatDamage: 5,
    xpReward: 60,
    density: 0.002,
    deepOnly: false,
    aggroRange: 6,
    loot: [
      { itemId: "shark_fin", quantity: 1, chance: 0.6 },
      { itemId: "raw_shrimp", quantity: 3, chance: 0.4 },
    ],
  },
  {
    mobId: "sea_serpent",
    name: "Sea Serpent",
    level: 40,
    maxHp: 150,
    attack: 25,
    defense: 15,
    boatDamage: 10,
    xpReward: 120,
    density: 0.001,
    deepOnly: true,
    aggroRange: 8,
    loot: [
      { itemId: "serpent_scale", quantity: 2, chance: 0.5 },
      { itemId: "enchanted_gem", quantity: 1, chance: 0.15 },
    ],
  },
  {
    mobId: "kraken_tentacle",
    name: "Kraken Tentacle",
    level: 60,
    maxHp: 250,
    attack: 35,
    defense: 20,
    boatDamage: 20,
    xpReward: 200,
    density: 0.0003,
    deepOnly: true,
    aggroRange: 10,
    loot: [
      { itemId: "kraken_ink", quantity: 1, chance: 0.4 },
      { itemId: "ancient_rune", quantity: 1, chance: 0.1 },
      { itemId: "enchanted_gem", quantity: 2, chance: 0.2 },
    ],
  },
];

// ---- Island Generation ----

/** Chance per ocean chunk to contain a small island. */
export const ISLAND_CHANCE = 0.08;

/** Island radius range in tiles. */
export const ISLAND_RADIUS_MIN = 3;
export const ISLAND_RADIUS_MAX = 6;

/** Unique resources that only spawn on ocean islands. */
export const ISLAND_RESOURCES = [
  { nodeId: "pearl_oyster", density: 0.01 },
  { nodeId: "driftwood", density: 0.02 },
  { nodeId: "coconut_palm", density: 0.015 },
];
