/**
 * Shared handler context — passed to every per-system handler.
 * Keeps imports centralized so individual handlers stay lean.
 */

import { Op, type ServerMessage, ITEMS } from "@madworld/shared";
import { Player } from "../../game/entities/Player.js";
import { world } from "../../game/World.js";

export { Op, ITEMS, world };
export { Player };
export type { ServerMessage };

/** Send the player's full inventory state. */
export function sendInventory(player: Player): void {
  const slots: { index: number; itemId: string | null; quantity: number }[] = [];
  for (let i = 0; i < player.inventory.length; i++) {
    const s = player.inventory[i];
    slots.push({ index: i, itemId: s?.itemId ?? null, quantity: s?.quantity ?? 0 });
  }
  player.send({ op: Op.S_INV_UPDATE, d: { slots } } satisfies ServerMessage);
  player.dirty = true;
}

/** Try to add an item to a player's inventory. Returns true on success. */
export function giveItem(player: Player, itemId: string, quantity: number): boolean {
  const itemDef = ITEMS[itemId];
  if (!itemDef) return false;

  let slotIndex = -1;
  if (itemDef.stackable) {
    for (let i = 0; i < player.inventory.length; i++) {
      const slot = player.inventory[i];
      if (slot && slot.itemId === itemId && slot.quantity < itemDef.maxStack) {
        slotIndex = i;
        break;
      }
    }
  }

  if (slotIndex === -1) {
    slotIndex = player.inventory.indexOf(null);
    if (slotIndex === -1) return false; // Full
    player.inventory[slotIndex] = { itemId, quantity: 0 };
  }

  player.inventory[slotIndex]!.quantity += quantity;
  return true;
}
