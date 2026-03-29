import { Op, type ServerMessage, ITEMS, SHOPS, movementFormulas } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { NPC } from "../../game/entities/NPC.js";
import { world } from "../../game/World.js";

export function handleShopBuy(player: Player, d: any): void {
  const zone = world.getZone(player.zoneId);
  if (!zone) return;
  const npc = zone.entities.get(d.npcEid);
  if (!npc || !(npc instanceof NPC)) return;
  if (movementFormulas.distance(player.x, player.y, npc.x, npc.y) > 3) return;

  const shopItems = SHOPS[npc.npcId];
  if (!shopItems) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "This NPC has nothing to sell." } } satisfies ServerMessage);
    return;
  }

  const shopEntry = shopItems.find((e) => e.itemId === d.itemId);
  if (!shopEntry) return;

  const buyQty = Math.max(1, Math.min(100, d.quantity));
  const totalCost = shopEntry.buyPrice * buyQty;

  let playerGold = 0;
  for (const slot of player.inventory) {
    if (slot?.itemId === "gold_coins") playerGold += slot.quantity;
  }
  if (playerGold < totalCost) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Not enough gold." } } satisfies ServerMessage);
    return;
  }

  let goldRemaining = totalCost;
  for (let i = 0; i < player.inventory.length && goldRemaining > 0; i++) {
    const slot = player.inventory[i];
    if (slot?.itemId === "gold_coins") {
      const take = Math.min(goldRemaining, slot.quantity);
      slot.quantity -= take;
      goldRemaining -= take;
      if (slot.quantity <= 0) player.inventory[i] = null;
    }
  }

  const buyItemDef = ITEMS[d.itemId];
  let buyTargetSlot = -1;
  if (buyItemDef?.stackable) {
    for (let i = 0; i < player.inventory.length; i++) {
      if (player.inventory[i]?.itemId === d.itemId) { buyTargetSlot = i; break; }
    }
  }
  if (buyTargetSlot === -1) buyTargetSlot = player.inventory.indexOf(null);
  if (buyTargetSlot === -1) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Inventory full." } } satisfies ServerMessage);
    return;
  }

  const existingSlot = player.inventory[buyTargetSlot];
  if (existingSlot && existingSlot.itemId === d.itemId) {
    if (buyItemDef && existingSlot.quantity + buyQty > buyItemDef.maxStack) {
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Stack is full." } } satisfies ServerMessage);
      return;
    }
    existingSlot.quantity += buyQty;
  } else {
    player.inventory[buyTargetSlot] = { itemId: d.itemId, quantity: buyQty };
  }

  const updatedSlots: Array<{ index: number; itemId: string | null; quantity: number }> = [];
  for (let i = 0; i < player.inventory.length; i++) {
    const s = player.inventory[i];
    updatedSlots.push({ index: i, itemId: s?.itemId ?? null, quantity: s?.quantity ?? 0 });
  }
  player.send({ op: Op.S_INV_UPDATE, d: { slots: updatedSlots.filter((s) => s.itemId !== null || s.quantity === 0) } } satisfies ServerMessage);
  player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Bought ${buyQty}x ${buyItemDef?.name ?? d.itemId}.` } } satisfies ServerMessage);
  player.dirty = true;
}

export function handleShopSell(player: Player, d: any): void {
  const zone = world.getZone(player.zoneId);
  if (!zone) return;
  const npc = zone.entities.get(d.npcEid);
  if (!npc || !(npc instanceof NPC)) return;
  if (movementFormulas.distance(player.x, player.y, npc.x, npc.y) > 3) return;

  const sellSlotIdx = d.inventorySlot;
  if (sellSlotIdx < 0 || sellSlotIdx >= player.inventory.length) return;
  const sellSlot = player.inventory[sellSlotIdx];
  if (!sellSlot) return;

  const sellItemDef = ITEMS[sellSlot.itemId];
  if (!sellItemDef) return;

  const sellQty = Math.min(d.quantity, sellSlot.quantity);
  if (sellQty <= 0) return;

  let sellPrice = 1;
  const npcShop = SHOPS[npc.npcId];
  if (npcShop) {
    const entry = npcShop.find((e) => e.itemId === sellSlot.itemId);
    if (entry) sellPrice = Math.max(1, Math.floor(entry.buyPrice / 2));
  }
  const totalSellGold = sellPrice * sellQty;

  sellSlot.quantity -= sellQty;
  if (sellSlot.quantity <= 0) player.inventory[sellSlotIdx] = null;

  let goldSlotIdx = -1;
  for (let i = 0; i < player.inventory.length; i++) {
    if (player.inventory[i]?.itemId === "gold_coins") { goldSlotIdx = i; break; }
  }
  if (goldSlotIdx === -1) goldSlotIdx = player.inventory.indexOf(null);
  if (goldSlotIdx === -1) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Inventory full, cannot receive gold." } } satisfies ServerMessage);
    return;
  }

  const goldSlot = player.inventory[goldSlotIdx];
  if (goldSlot?.itemId === "gold_coins") {
    goldSlot.quantity += totalSellGold;
  } else {
    player.inventory[goldSlotIdx] = { itemId: "gold_coins", quantity: totalSellGold };
  }

  const sellUpdatedSlots: Array<{ index: number; itemId: string | null; quantity: number }> = [];
  for (const idx of [sellSlotIdx, goldSlotIdx]) {
    const s = player.inventory[idx];
    sellUpdatedSlots.push({ index: idx, itemId: s?.itemId ?? null, quantity: s?.quantity ?? 0 });
  }
  player.send({ op: Op.S_INV_UPDATE, d: { slots: sellUpdatedSlots } } satisfies ServerMessage);
  player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Sold ${sellQty}x ${sellItemDef.name} for ${totalSellGold} gold.` } } satisfies ServerMessage);
  player.dirty = true;
}
