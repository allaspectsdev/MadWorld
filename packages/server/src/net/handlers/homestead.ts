import { Op, type ServerMessage, FURNITURE, GARDEN_SEEDS, SkillName } from "@madworld/shared";
import { levelForXp } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { campManager } from "./camp.js";
import { sendInventory } from "./context.js";

export async function handlePlaceFurniture(player: Player, d: any): Promise<void> {
  if (!player.partyId) return;
  const def = FURNITURE[d.furnitureId];
  if (!def) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Unknown furniture." } } satisfies ServerMessage);
    return;
  }
  const fSlot = player.inventory.findIndex((s) => s && s.itemId === def.itemId);
  if (fSlot === -1) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `You need a ${def.name} kit.` } } satisfies ServerMessage);
    return;
  }
  const result = await campManager.placeFurniture(d.campId, player.partyId, d.furnitureId, d.gridX, d.gridY, d.displayItemId);
  if ("error" in result) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: result.error } } satisfies ServerMessage);
    return;
  }
  const fs = player.inventory[fSlot]!;
  fs.quantity -= 1;
  if (fs.quantity <= 0) player.inventory[fSlot] = null;
  sendInventory(player);
  player.send({
    op: Op.S_FURNITURE_UPDATE,
    d: { campId: d.campId, action: "placed", furnitureId: d.furnitureId, gridX: d.gridX, gridY: d.gridY },
  } satisfies ServerMessage);
}

export async function handleRemoveFurniture(player: Player, d: any): Promise<void> {
  if (!player.partyId) return;
  const result = await campManager.removeFurniture(d.campId, player.partyId, d.gridX, d.gridY);
  if ("error" in result) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: result.error } } satisfies ServerMessage);
    return;
  }
  const rDef = FURNITURE[result.furnitureId];
  if (rDef) {
    const { giveItem } = await import("./context.js");
    giveItem(player, rDef.itemId, 1);
  }
  sendInventory(player);
  player.send({
    op: Op.S_FURNITURE_UPDATE,
    d: { campId: d.campId, action: "removed", furnitureId: result.furnitureId, gridX: d.gridX, gridY: d.gridY },
  } satisfies ServerMessage);
}

export async function handleGardenPlant(player: Player, d: any): Promise<void> {
  if (!player.partyId) return;
  const seedDef = GARDEN_SEEDS[d.seedId];
  if (!seedDef) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Unknown seed." } } satisfies ServerMessage);
    return;
  }
  const seedSlot = player.inventory.findIndex((s) => s && s.itemId === seedDef.seedItemId);
  if (seedSlot === -1) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `You need ${seedDef.name}.` } } satisfies ServerMessage);
    return;
  }
  const foragingXp = player.skills.get(SkillName.FORAGING)?.xp ?? 0;
  if (levelForXp(foragingXp) < seedDef.levelRequired) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Requires foraging level ${seedDef.levelRequired}.` } } satisfies ServerMessage);
    return;
  }
  const result = await campManager.plantSeed(d.campId, player.partyId, d.gridX, d.gridY, d.seedId);
  if ("error" in result) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: result.error } } satisfies ServerMessage);
    return;
  }
  const ss = player.inventory[seedSlot]!;
  ss.quantity -= 1;
  if (ss.quantity <= 0) player.inventory[seedSlot] = null;
  sendInventory(player);
  player.send({
    op: Op.S_GARDEN_UPDATE,
    d: { campId: d.campId, gridX: d.gridX, gridY: d.gridY, seedId: d.seedId, plantedAt: result.plantedAt, readyAt: result.readyAt },
  } satisfies ServerMessage);
}
