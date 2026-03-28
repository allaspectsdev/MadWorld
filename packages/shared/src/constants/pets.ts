/**
 * Pet/Companion system.
 *
 * Pets are tamed from passive world mobs using treats. They follow the
 * player as a special entity, gain bond XP passively, and provide
 * unique abilities that scale with bond level.
 *
 * Bond levels: 1-10 (10 = max bond). Higher bond = stronger ability.
 * Bond XP gained passively while pet is active (1 XP / 10 ticks = 1/sec).
 * Extra bond XP for discoveries, combat kills, gathering completions.
 */

export interface PetDef {
  id: string;
  name: string;
  /** Mob ID of the tameable creature in the world. */
  sourceMobId: string;
  /** Item ID of the treat required to tame. */
  treatItemId: string;
  /** Tame success chance (0..1). */
  tameChance: number;
  /** Ability type this pet provides. */
  ability: PetAbility;
  /** Base value of the ability at bond level 1. */
  abilityBaseValue: number;
  /** Value added per bond level above 1. */
  abilityPerLevel: number;
  /** Movement speed (follows player). */
  speed: number;
  /** Bond XP required for each level (cumulative). */
  bondXpPerLevel: number;
}

export type PetAbility =
  | "discovery_radius"   // Fox: extra discovery chunk radius
  | "auto_aggro"         // Wolf: aggros nearby hostile mobs
  | "resource_reveal"    // Owl: shows resource nodes on minimap
  | "loot_bonus"         // Cat: increased loot drop chance
  | "xp_bonus";          // Rabbit: passive XP multiplier

export const PETS: Record<string, PetDef> = {
  fox: {
    id: "fox",
    name: "Fox",
    sourceMobId: "fox",
    treatItemId: "raw_trout",
    tameChance: 0.3,
    ability: "discovery_radius",
    abilityBaseValue: 0,   // +0 chunks at level 1
    abilityPerLevel: 0.1,  // +1 chunk at level 10
    speed: 4.5,
    bondXpPerLevel: 100,
  },
  wolf: {
    id: "wolf",
    name: "Wolf",
    sourceMobId: "wolf",
    treatItemId: "raw_trout",
    tameChance: 0.2,
    ability: "auto_aggro",
    abilityBaseValue: 3,   // 3-tile aggro range at level 1
    abilityPerLevel: 0.5,  // 7.5-tile range at level 10
    speed: 5,
    bondXpPerLevel: 120,
  },
  owl: {
    id: "owl",
    name: "Owl",
    sourceMobId: "owl",
    treatItemId: "wild_herb",
    tameChance: 0.25,
    ability: "resource_reveal",
    abilityBaseValue: 5,   // 5-tile reveal radius at level 1
    abilityPerLevel: 1,    // 14-tile radius at level 10
    speed: 4,
    bondXpPerLevel: 100,
  },
  cat: {
    id: "cat",
    name: "Cat",
    sourceMobId: "cat",
    treatItemId: "raw_shrimp",
    tameChance: 0.35,
    ability: "loot_bonus",
    abilityBaseValue: 0.02, // +2% loot chance at level 1
    abilityPerLevel: 0.01,  // +11% at level 10
    speed: 4,
    bondXpPerLevel: 80,
  },
  rabbit: {
    id: "rabbit",
    name: "Rabbit",
    sourceMobId: "rabbit",
    treatItemId: "wild_herb",
    tameChance: 0.4,
    ability: "xp_bonus",
    abilityBaseValue: 0.02, // +2% XP at level 1
    abilityPerLevel: 0.01,  // +11% at level 10
    speed: 5,
    bondXpPerLevel: 80,
  },
};

/** Max bond level. */
export const PET_MAX_BOND_LEVEL = 10;

/** Bond XP gained passively per tick while pet is active. */
export const PET_PASSIVE_BOND_XP_PER_TICK = 0.1; // 1 XP per second at 10 ticks/sec

/** Bonus bond XP events. */
export const PET_BOND_EVENTS = {
  discovery: 5,      // New chunk discovered
  mob_kill: 2,       // Nearby mob killed
  gather_complete: 3, // Gathering completed
  landmark_found: 10, // New landmark discovered
} as const;

/** Stored pet state (DB + runtime). */
export interface PetState {
  petId: string;        // PetDef.id
  name: string;         // Player-given name
  bondXp: number;       // Total bond XP accumulated
  bondLevel: number;    // Derived from bondXp / bondXpPerLevel
  isActive: boolean;    // Currently following player
}

/** Calculate bond level from XP. */
export function petBondLevel(petId: string, bondXp: number): number {
  const def = PETS[petId];
  if (!def) return 1;
  return Math.min(PET_MAX_BOND_LEVEL, 1 + Math.floor(bondXp / def.bondXpPerLevel));
}

/** Calculate ability value at a given bond level. */
export function petAbilityValue(petId: string, bondLevel: number): number {
  const def = PETS[petId];
  if (!def) return 0;
  return def.abilityBaseValue + def.abilityPerLevel * (bondLevel - 1);
}
