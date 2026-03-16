export interface StatusEffectDef {
  id: string;
  name: string;
  type: "buff" | "debuff";
  durationTicks: number;
  onTick?: { damage?: number; heal?: number; intervalTicks: number };
  statMod?: { stat: string; multiplier: number };
  visual: { tint: number };
}

export const STATUS_EFFECTS: Record<string, StatusEffectDef> = {
  stun: {
    id: "stun", name: "Stunned", type: "debuff",
    durationTicks: 20,
    visual: { tint: 0xffff00 },
  },
  poison: {
    id: "poison", name: "Poisoned", type: "debuff",
    durationTicks: 50,
    onTick: { damage: 3, intervalTicks: 10 },
    visual: { tint: 0x44ff44 },
  },
  speed_boost: {
    id: "speed_boost", name: "Sprint", type: "buff",
    durationTicks: 30,
    statMod: { stat: "speed", multiplier: 2.0 },
    visual: { tint: 0x44aaff },
  },
  damage_boost: {
    id: "damage_boost", name: "War Cry", type: "buff",
    durationTicks: 50,
    statMod: { stat: "damage", multiplier: 1.25 },
    visual: { tint: 0xffaa00 },
  },
  invulnerable: {
    id: "invulnerable", name: "Invulnerable", type: "buff",
    durationTicks: 5,
    visual: { tint: 0xffffff },
  },
};
