import { Op, type ServerMessage, ITEMS, movementFormulas } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { GroundItem } from "../../game/entities/GroundItem.js";
import { world } from "../../game/World.js";
import { onItemPickup as questOnItemPickup } from "../../game/systems/QuestSystem.js";

export function handlePickup(player: Player, d: any): void {
  const zone = world.getZone(player.zoneId);
  if (!zone) return;
  const target = zone.entities.get(d.targetEid);
  if (!target || !(target instanceof GroundItem)) return;
  const dist = movementFormulas.distance(player.x, player.y, target.x, target.y);
  if (dist > 3) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Too far to pick up" } } satisfies ServerMessage);
    return;
  }

  const groundItem = target;
  const itemDef = ITEMS[groundItem.itemId];

  let slotIndex = -1;
  if (itemDef && itemDef.stackable) {
    for (let i = 0; i < player.inventory.length; i++) {
      const slot = player.inventory[i];
      if (slot && slot.itemId === groundItem.itemId && slot.quantity < itemDef.maxStack) {
        slotIndex = i;
        break;
      }
    }
  }
  if (slotIndex === -1) {
    slotIndex = player.inventory.indexOf(null);
  }
  if (slotIndex === -1) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Inventory full" } } satisfies ServerMessage);
    return;
  }

  const existing = player.inventory[slotIndex];
  if (existing && existing.itemId === groundItem.itemId) {
    existing.quantity += groundItem.quantity;
  } else {
    player.inventory[slotIndex] = { itemId: groundItem.itemId, quantity: groundItem.quantity };
  }

  player.send({
    op: Op.S_INV_UPDATE,
    d: { slots: [{ index: slotIndex, itemId: player.inventory[slotIndex]!.itemId, quantity: player.inventory[slotIndex]!.quantity }] },
  } satisfies ServerMessage);

  zone.removeEntity(groundItem.eid);
  questOnItemPickup(player, groundItem.itemId);
  player.dirty = true;
}

export function handleInvMove(player: Player, d: any): void {
  const fromSlot = d.fromSlot;
  const toSlot = d.toSlot;
  if (fromSlot < 0 || fromSlot >= player.inventory.length) return;
  if (toSlot < 0 || toSlot >= player.inventory.length) return;

  const temp = player.inventory[fromSlot];
  player.inventory[fromSlot] = player.inventory[toSlot];
  player.inventory[toSlot] = temp;

  player.send({
    op: Op.S_INV_UPDATE,
    d: {
      slots: [
        { index: fromSlot, itemId: player.inventory[fromSlot]?.itemId ?? null, quantity: player.inventory[fromSlot]?.quantity ?? 0 },
        { index: toSlot, itemId: player.inventory[toSlot]?.itemId ?? null, quantity: player.inventory[toSlot]?.quantity ?? 0 },
      ],
    },
  } satisfies ServerMessage);
  player.dirty = true;
}

export function handleInvDrop(player: Player, d: any): void {
  const dropSlot = d.slot;
  if (dropSlot < 0 || dropSlot >= player.inventory.length) return;
  const dropItem = player.inventory[dropSlot];
  if (!dropItem) return;

  const dropQty = Math.min(d.quantity, dropItem.quantity);
  if (dropQty <= 0) return;

  const zone = world.getZone(player.zoneId);
  if (!zone) return;

  const groundDrop = new GroundItem(zone.id, player.x, player.y, dropItem.itemId, dropQty);
  zone.addEntity(groundDrop);

  dropItem.quantity -= dropQty;
  if (dropItem.quantity <= 0) player.inventory[dropSlot] = null;

  player.send({
    op: Op.S_INV_UPDATE,
    d: { slots: [{ index: dropSlot, itemId: player.inventory[dropSlot]?.itemId ?? null, quantity: player.inventory[dropSlot]?.quantity ?? 0 }] },
  } satisfies ServerMessage);
  player.dirty = true;
}

export function handleInvUse(player: Player, d: any): void {
  const useSlot = d.slot;
  if (useSlot < 0 || useSlot >= player.inventory.length) return;
  const useItem = player.inventory[useSlot];
  if (!useItem) return;

  const useDef = ITEMS[useItem.itemId];
  if (!useDef) return;

  if (useDef.healAmount) {
    const potionPower = 1 + player.getSpecBonus("potion_power");
    const healAmount = Math.floor(useDef.healAmount * potionPower);
    player.hp = Math.min(player.maxHp, player.hp + healAmount);
    player.send({
      op: Op.S_PLAYER_STATS,
      d: { hp: player.hp, maxHp: player.maxHp, level: 1 },
    } satisfies ServerMessage);
  }

  useItem.quantity--;
  if (useItem.quantity <= 0) player.inventory[useSlot] = null;

  player.send({
    op: Op.S_INV_UPDATE,
    d: { slots: [{ index: useSlot, itemId: player.inventory[useSlot]?.itemId ?? null, quantity: player.inventory[useSlot]?.quantity ?? 0 }] },
  } satisfies ServerMessage);
  player.dirty = true;
}

export function handleEquip(player: Player, d: any): void {
  const equipSlotIdx = d.inventorySlot;
  if (equipSlotIdx < 0 || equipSlotIdx >= player.inventory.length) return;
  const equipItem = player.inventory[equipSlotIdx];
  if (!equipItem) return;

  const equipDef = ITEMS[equipItem.itemId];
  if (!equipDef || !equipDef.equipSlot) return;

  const equipSlot = equipDef.equipSlot;
  const currentlyEquipped = player.equipment.get(equipSlot);

  if (currentlyEquipped) {
    player.inventory[equipSlotIdx] = { itemId: currentlyEquipped, quantity: 1 };
  } else {
    player.inventory[equipSlotIdx] = null;
  }

  player.equipment.set(equipSlot, equipItem.itemId);

  player.send({
    op: Op.S_INV_UPDATE,
    d: { slots: [{ index: equipSlotIdx, itemId: player.inventory[equipSlotIdx]?.itemId ?? null, quantity: player.inventory[equipSlotIdx]?.quantity ?? 0 }] },
  } satisfies ServerMessage);
  player.send({ op: Op.S_EQUIP_UPDATE, d: { slot: equipSlot, itemId: equipItem.itemId } } satisfies ServerMessage);
  player.dirty = true;
}

export function handleUnequip(player: Player, d: any): void {
  const unequipSlot = d.slot;
  const unequipItemId = player.equipment.get(unequipSlot);
  if (!unequipItemId) return;

  const emptySlot = player.inventory.indexOf(null);
  if (emptySlot === -1) return;

  player.inventory[emptySlot] = { itemId: unequipItemId, quantity: 1 };
  player.equipment.delete(unequipSlot);

  player.send({
    op: Op.S_INV_UPDATE,
    d: { slots: [{ index: emptySlot, itemId: unequipItemId, quantity: 1 }] },
  } satisfies ServerMessage);
  player.send({ op: Op.S_EQUIP_UPDATE, d: { slot: unequipSlot, itemId: null } } satisfies ServerMessage);
  player.dirty = true;
}
