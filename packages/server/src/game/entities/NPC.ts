import { Entity } from "./Entity.js";
import { EntityType } from "@madworld/shared";

export class NPC extends Entity {
  npcId: string;
  name: string;
  dialog: string;
  quests: string[];

  constructor(npcId: string, name: string, dialog: string, quests: string[], zoneId: string, x: number, y: number) {
    super(EntityType.NPC, zoneId, x, y);
    this.npcId = npcId;
    this.name = name;
    this.dialog = dialog;
    this.quests = quests;
  }
}
