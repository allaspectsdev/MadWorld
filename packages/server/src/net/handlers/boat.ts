import { Op, type ServerMessage, BOATS, TileType, movementFormulas } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { world } from "../../game/World.js";
import { giveItem, sendInventory } from "./context.js";

export function handleBoatPlace(player: Player, d: any): void {
  const boatDef = BOATS[d.boatId];
  if (!boatDef) return;
  const boatSlot = player.inventory.findIndex((s) => s && s.itemId === boatDef.itemId);
  if (boatSlot === -1) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You don't have that boat." } } satisfies ServerMessage);
    return;
  }
  const zone = world.getZone(player.zoneId);
  if (!zone) return;
  const pTile = movementFormulas.tileAt(zone.def, player.x, player.y);
  if (pTile !== TileType.SAND) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You can only place a boat on a beach." } } satisfies ServerMessage);
    return;
  }
  const slot = player.inventory[boatSlot]!;
  slot.quantity -= 1;
  if (slot.quantity <= 0) player.inventory[boatSlot] = null;
  sendInventory(player);
  player.boatState = {
    boatId: boatDef.id,
    hp: boatDef.maxHp,
    maxHp: boatDef.maxHp,
    speedMultiplier: boatDef.speedMultiplier,
    deepWater: boatDef.deepWater,
  };
  player.send({ op: Op.S_BOAT_UPDATE, d: { action: "entered", boatId: boatDef.id, hp: boatDef.maxHp, maxHp: boatDef.maxHp } } satisfies ServerMessage);
}

export function handleBoatEnter(player: Player, _d: any): void {
  // Reserved for entering parked boats
}

export function handleBoatExit(player: Player): void {
  if (!player.boatState) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You're not in a boat." } } satisfies ServerMessage);
    return;
  }
  const zone = world.getZone(player.zoneId);
  if (!zone) return;
  const tile = movementFormulas.tileAt(zone.def, player.x, player.y);
  if (tile !== TileType.SAND && tile !== TileType.BRIDGE) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Sail to a beach or bridge to disembark." } } satisfies ServerMessage);
    return;
  }
  if (player.boatState.hp > 0) {
    const boatDef = BOATS[player.boatState.boatId];
    if (boatDef) giveItem(player, boatDef.itemId, 1);
    sendInventory(player);
  }
  player.boatState = null;
  player.send({ op: Op.S_BOAT_UPDATE, d: { action: "exited" } } satisfies ServerMessage);
}
