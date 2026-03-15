import { levelForXp } from "../constants/skills.js";

/**
 * Calculate XP rewarded for an action based on the action's difficulty
 * relative to the player's skill level.
 * Higher difficulty relative to skill = more XP.
 * Actions far below skill level give almost no XP.
 */
export function xpForAction(skillLevel: number, actionLevel: number, baseXp: number): number {
  const diff = actionLevel - skillLevel;
  if (diff >= 0) {
    return Math.floor(baseXp * (1 + diff * 0.1));
  }
  const penalty = Math.max(0.1, 1 + diff * 0.15);
  return Math.max(1, Math.floor(baseXp * penalty));
}

/**
 * Success rate for gathering actions (fishing, mining, woodcutting).
 * Returns a probability between 0.1 and 0.95.
 */
export function gatherSuccessRate(skillLevel: number, resourceLevel: number): number {
  const diff = skillLevel - resourceLevel;
  const rate = 0.4 + diff * 0.05;
  return Math.min(0.95, Math.max(0.1, rate));
}

/**
 * Cooking burn chance. Decreases as cooking level exceeds recipe level.
 */
export function burnChance(cookingLevel: number, recipeLevel: number): number {
  const diff = cookingLevel - recipeLevel;
  if (diff >= 20) return 0;
  const chance = 0.5 - diff * 0.025;
  return Math.min(0.6, Math.max(0, chance));
}
