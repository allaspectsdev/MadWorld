import { Entity } from "./Entity.js";
import { EntityType, type PetDef } from "@madworld/shared";

/**
 * Pet entity — follows the owner player, rendered as EntityType.PET.
 */
export class Pet extends Entity {
  def: PetDef;
  ownerEid: number;
  name: string;
  bondXp: number;

  constructor(def: PetDef, ownerEid: number, name: string, bondXp: number, zoneId: string, x: number, y: number) {
    super(EntityType.PET, zoneId, x, y);
    this.def = def;
    this.ownerEid = ownerEid;
    this.name = name;
    this.bondXp = bondXp;
    this.speed = def.speed;
  }
}
