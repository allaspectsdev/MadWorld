export type EntityId = number;

export interface Position {
  x: number;
  y: number;
}

export enum Direction {
  NORTH = "north",
  SOUTH = "south",
  EAST = "east",
  WEST = "west",
}

export enum EntityType {
  PLAYER = "player",
  MOB = "mob",
  NPC = "npc",
  GROUND_ITEM = "ground_item",
}
