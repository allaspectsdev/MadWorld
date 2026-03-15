import type { DamageResult } from "../types/combat.js";

export function maxHit(strength: number, equipmentBonus: number): number {
  return Math.floor(0.5 + strength * (equipmentBonus + 64) / 640);
}

export function hitChance(attack: number, targetDefense: number): number {
  return Math.min(0.95, Math.max(0.05, attack / (attack + targetDefense)));
}

export function rollDamage(
  attackLevel: number,
  equipAttack: number,
  targetDefenseLevel: number,
  targetDefenseBonus: number,
): DamageResult {
  const accuracy = hitChance(attackLevel + equipAttack, targetDefenseLevel + targetDefenseBonus);
  const hit = Math.random() < accuracy;

  if (!hit) {
    return { hit: false, damage: 0, isCrit: false };
  }

  const max = maxHit(attackLevel, equipAttack);
  const isCrit = Math.random() < 0.05;
  const baseDamage = Math.floor(Math.random() * (max + 1));
  const damage = isCrit ? Math.floor(baseDamage * 1.5) : baseDamage;

  return { hit: true, damage: Math.max(1, damage), isCrit };
}
