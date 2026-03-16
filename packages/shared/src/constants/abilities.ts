import type { SkillName } from "../types/skill.js";

export interface AbilityDef {
  id: string;
  name: string;
  slot: number;
  cooldownTicks: number;
  skillRequired: SkillName;
  levelRequired: number;
  targetType: "self" | "enemy" | "none";
  range?: number;
  description: string;
  damageMultiplier?: number;
  healPercent?: number;
  statusEffect?: string;
  speedMultiplier?: number;
  dashDistance?: number;
  invulnerableTicks?: number;
  partyBuff?: boolean;
  guaranteedHit?: boolean;
}

export const ABILITIES: Record<string, AbilityDef> = {
  power_strike: {
    id: "power_strike", name: "Power Strike", slot: 2,
    cooldownTicks: 80, skillRequired: "melee" as SkillName, levelRequired: 1,
    targetType: "enemy", range: 2.5,
    description: "A powerful blow dealing double damage. Cannot miss.",
    damageMultiplier: 2.0, guaranteedHit: true,
  },
  shield_bash: {
    id: "shield_bash", name: "Shield Bash", slot: 3,
    cooldownTicks: 120, skillRequired: "defense" as SkillName, levelRequired: 5,
    targetType: "enemy", range: 2.0,
    description: "Bash with your shield, dealing damage and stunning for 2 seconds.",
    damageMultiplier: 1.5, statusEffect: "stun",
  },
  heal: {
    id: "heal", name: "Heal", slot: 4,
    cooldownTicks: 200, skillRequired: "defense" as SkillName, levelRequired: 3,
    targetType: "self",
    description: "Restore 30% of your maximum health.",
    healPercent: 0.3,
  },
  sprint: {
    id: "sprint", name: "Sprint", slot: 5,
    cooldownTicks: 150, skillRequired: "agility" as SkillName, levelRequired: 1,
    targetType: "self",
    description: "Double your movement speed for 3 seconds.",
    statusEffect: "speed_boost",
  },
  poison_strike: {
    id: "poison_strike", name: "Poison Strike", slot: 6,
    cooldownTicks: 100, skillRequired: "melee" as SkillName, levelRequired: 8,
    targetType: "enemy", range: 2.5,
    description: "Strike and apply poison dealing 3 damage per second for 5 seconds.",
    damageMultiplier: 1.0, statusEffect: "poison",
  },
  war_cry: {
    id: "war_cry", name: "War Cry", slot: 7,
    cooldownTicks: 250, skillRequired: "melee" as SkillName, levelRequired: 12,
    targetType: "self",
    description: "Boost damage by 25% for 5 seconds. Affects nearby party members.",
    statusEffect: "damage_boost", partyBuff: true,
  },
  dodge_roll: {
    id: "dodge_roll", name: "Dodge Roll", slot: 8,
    cooldownTicks: 60, skillRequired: "agility" as SkillName, levelRequired: 5,
    targetType: "self",
    description: "Dash 3 tiles in your facing direction. Brief invulnerability.",
    dashDistance: 3, invulnerableTicks: 5,
  },
};
