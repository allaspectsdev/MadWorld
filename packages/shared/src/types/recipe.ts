import type { SkillName } from "./skill.js";

export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

export interface RecipeDef {
  id: string;
  name: string;
  skill: SkillName;
  levelRequired: number;
  ingredients: RecipeIngredient[];
  result: { itemId: string; quantity: number };
  xp: number;
  durationTicks: number;
  burnChance?: (level: number) => number;
}
