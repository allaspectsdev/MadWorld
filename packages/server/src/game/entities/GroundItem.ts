import { Entity } from "./Entity.js";
import { EntityType } from "@madworld/shared";

export class GroundItem extends Entity {
  itemId: string;
  quantity: number;
  despawnTimer: number; // ticks remaining

  constructor(zoneId: string, x: number, y: number, itemId: string, quantity: number) {
    super(EntityType.GROUND_ITEM, zoneId, x, y);
    this.itemId = itemId;
    this.quantity = quantity;
    this.despawnTimer = 600; // 60 seconds at 10 Hz
  }
}
