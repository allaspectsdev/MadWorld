import type { EntityId, Position, Direction } from "./entity.js";
import type { SkillName } from "./skill.js";

export interface Appearance {
  hairStyle: number;
  hairColor: number;
  skinColor: number;
  shirtColor: number;
  bodyType?: number; // 0 = default, 1 = feminine
}

export interface PlayerState {
  id: EntityId;
  name: string;
  position: Position;
  direction: Direction;
  zoneId: string;
  appearance: Appearance;
  hp: number;
  maxHp: number;
  level: number;
}

export interface PlayerStats {
  maxHp: number;
  maxStamina: number;
  attackPower: number;
  defense: number;
  speed: number;
}

export type SkillSet = Record<SkillName, number>;
