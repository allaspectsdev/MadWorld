import { Op, type ServerMessage } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { CampManager } from "../../game/CampManager.js";
import { giveItem, sendInventory } from "./context.js";

const campManager = new CampManager();
export { campManager };

export async function handlePlaceCamp(player: Player, d: any): Promise<void> {
  if (!player.partyId) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You must be in a party to place a camp." } } satisfies ServerMessage);
    return;
  }
  const kitSlot = player.inventory.findIndex((s) => s && s.itemId === "campfire_kit");
  if (kitSlot === -1) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You need a Campfire Kit." } } satisfies ServerMessage);
    return;
  }
  const result = await campManager.placeCamp(player.partyId, player.playerId, player.x, player.y, d.name ?? "Camp");
  if ("error" in result) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: result.error } } satisfies ServerMessage);
    return;
  }
  const ks = player.inventory[kitSlot]!;
  ks.quantity -= 1;
  if (ks.quantity <= 0) player.inventory[kitSlot] = null;
  sendInventory(player);
  player.send({ op: Op.S_CAMP_PLACED, d: { campId: result.id, name: result.name, worldX: result.worldX, worldY: result.worldY, tier: result.tier } } satisfies ServerMessage);
}

export async function handleInteractCamp(player: Player): Promise<void> {
  if (!player.partyId) return;
  const camps = await campManager.loadPartyCamps(player.partyId);
  player.send({
    op: Op.S_CAMP_LIST,
    d: {
      camps: camps.map((c) => ({
        id: c.id, name: c.name, worldX: c.worldX, worldY: c.worldY,
        tier: c.tier, storageSlots: { 1: 0, 2: 8, 3: 16, 4: 24 }[c.tier] ?? 0,
      })),
    },
  } satisfies ServerMessage);
}

export async function handleCampStore(player: Player, d: any): Promise<void> {
  if (!player.partyId) return;
  const result = await campManager.storeItem(d.campId, player.partyId, d.itemId, d.quantity ?? 1);
  if ("error" in result) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: result.error } } satisfies ServerMessage);
    return;
  }
  const slot = player.inventory.findIndex((s) => s && s.itemId === d.itemId);
  if (slot !== -1) {
    const rs = player.inventory[slot]!;
    rs.quantity -= (d.quantity ?? 1);
    if (rs.quantity <= 0) player.inventory[slot] = null;
  }
  sendInventory(player);
  player.send({ op: Op.S_CAMP_STORAGE, d: { campId: d.campId, storage: result } } satisfies ServerMessage);
}

export async function handleCampWithdraw(player: Player, d: any): Promise<void> {
  if (!player.partyId) return;
  const result = await campManager.withdrawItem(d.campId, player.partyId, d.itemId, d.quantity ?? 1);
  if ("error" in result) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: result.error } } satisfies ServerMessage);
    return;
  }
  giveItem(player, d.itemId, d.quantity ?? 1);
  sendInventory(player);
  player.send({ op: Op.S_CAMP_STORAGE, d: { campId: d.campId, storage: result } } satisfies ServerMessage);
}

export function handleFastTravel(player: Player, d: any): void {
  if (!player.partyId) return;
  const camps = campManager.getCamps(player.partyId);
  const target = camps.find((c) => c.id === d.campId);
  if (!target) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Camp not found." } } satisfies ServerMessage);
    return;
  }
  player.x = target.worldX;
  player.y = target.worldY;
  player.dirty = true;
  player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Traveled to ${target.name}.` } } satisfies ServerMessage);
}
