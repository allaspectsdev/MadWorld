export enum AIState {
  IDLE = "idle",
  PATROL = "patrol",
  AGGRO = "aggro",
  CHASE = "chase",
  RETURN = "return",
  DEAD = "dead",
}

export interface LootDrop {
  itemId: string;
  quantity: number;
  chance: number;
}

export interface MobDef {
  id: string;
  name: string;
  level: number;
  maxHp: number;
  attack: number;
  defense: number;
  attackSpeed: number;
  aggroRange: number;
  chaseRange: number;
  respawnTicks: number;
  xpReward: number;
  lootTable: LootDrop[];
}
