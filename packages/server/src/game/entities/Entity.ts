import { EntityType, type EntityId } from "@madworld/shared";

let nextEid = 1;

export function generateEid(): EntityId {
  return nextEid++;
}

export class Entity {
  readonly eid: EntityId;
  readonly type: EntityType;
  x: number;
  y: number;
  dx: number = 0;
  dy: number = 0;
  speed: number = 0;
  zoneId: string;

  constructor(type: EntityType, zoneId: string, x: number, y: number) {
    this.eid = generateEid();
    this.type = type;
    this.zoneId = zoneId;
    this.x = x;
    this.y = y;
  }
}
