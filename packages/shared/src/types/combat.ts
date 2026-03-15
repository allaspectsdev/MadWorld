export enum CombatStyle {
  MELEE = "melee",
  RANGED = "ranged",
}

export interface DamageResult {
  hit: boolean;
  damage: number;
  isCrit: boolean;
}
