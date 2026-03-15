import type { SkillName } from "./skill.js";

export enum ItemCategory {
  WEAPON = "weapon",
  ARMOR = "armor",
  CONSUMABLE = "consumable",
  MATERIAL = "material",
  TOOL = "tool",
  QUEST = "quest",
}

export enum EquipSlot {
  HEAD = "head",
  CHEST = "chest",
  LEGS = "legs",
  FEET = "feet",
  HANDS = "hands",
  WEAPON = "weapon",
  SHIELD = "shield",
  RING1 = "ring1",
  RING2 = "ring2",
  AMULET = "amulet",
}

export enum Rarity {
  COMMON = "common",
  UNCOMMON = "uncommon",
  RARE = "rare",
  EPIC = "epic",
  LEGENDARY = "legendary",
}

export interface EquipmentStats {
  attack?: number;
  defense?: number;
  rangedAttack?: number;
  speed?: number;
  hp?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  stackable: boolean;
  maxStack: number;
  equipSlot?: EquipSlot;
  stats?: EquipmentStats;
  rarity: Rarity;
  levelReq?: Partial<Record<SkillName, number>>;
  value: number;
  healAmount?: number;
}
