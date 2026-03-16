import { Op, type ClientMessage, type ServerMessage, ITEMS, ABILITIES, SHOPS, FISHING_SPOTS, movementFormulas, combatFormulas } from "@madworld/shared";
import { levelForXp, SkillName, PARTY_XP_RANGE, AIState, TileType } from "@madworld/shared";
import { Player } from "../game/entities/Player.js";
import { Mob } from "../game/entities/Mob.js";
import { GroundItem } from "../game/entities/GroundItem.js";
import { NPC } from "../game/entities/NPC.js";
import { world } from "../game/World.js";
import { partyManager } from "../game/PartyManager.js";
import { verifyToken } from "../auth/jwt.js";
import { loadPlayer } from "../services/PlayerService.js";
import { savePlayer } from "../services/PlayerService.js";
import { initQuestState, sendQuestList, acceptQuest, turnInQuest, getAvailableQuests, cleanupQuestState, onItemPickup as questOnItemPickup } from "../game/systems/QuestSystem.js";
import { handleMobDeath, grantXp } from "../game/systems/CombatSystem.js";
import { applyStatusEffect } from "../game/systems/AbilitySystem.js";
import { getCurrentTick } from "../game/GameLoop.js";
import type { ServerWebSocket } from "bun";

export interface SocketData {
  userId: number | null;
  player: Player | null;
}

export type GameWebSocket = ServerWebSocket<SocketData>;

export function createSocketData(): SocketData {
  return { userId: null, player: null };
}

export async function handleMessage(
  ws: GameWebSocket,
  raw: string,
): Promise<void> {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  // Auth messages can come before authentication
  if (msg.op === Op.C_AUTH_LOGIN) {
    await handleAuth(ws, msg.d as { email: string; password: string });
    return;
  }

  // All other messages require authentication
  const player = ws.data.player;
  if (!player) {
    ws.send(
      JSON.stringify({ op: Op.S_AUTH_ERROR, d: { reason: "Not authenticated" } }),
    );
    return;
  }

  switch (msg.op) {
    case Op.C_MOVE:
      // Validate movement input
      if (!Number.isFinite(msg.d.dx) || !Number.isFinite(msg.d.dy)) break;
      const moveMag = Math.sqrt(msg.d.dx * msg.d.dx + msg.d.dy * msg.d.dy);
      if (moveMag > 1.5) break; // Allow slight overshoot for diagonals (√2 ≈ 1.414)
      if (player.moveQueue.length >= 10) break; // Prevent queue flooding
      player.moveQueue.push({
        dx: msg.d.dx,
        dy: msg.d.dy,
        seq: msg.d.seq,
      });
      break;

    case Op.C_STOP:
      player.moveQueue = [];
      player.dx = 0;
      player.dy = 0;
      break;

    case Op.C_GOD_TELEPORT: {
      if (!player.isGod) break;
      const tpX = msg.d.x;
      const tpY = msg.d.y;
      if (!Number.isFinite(tpX) || !Number.isFinite(tpY)) break;
      const tpZone = world.getZone(player.zoneId);
      if (!tpZone) break;
      if (tpX < 0 || tpX >= tpZone.def.width || tpY < 0 || tpY >= tpZone.def.height) break;
      if (!movementFormulas.isWalkable(tpZone.def, tpX, tpY)) break;
      // Clear state
      player.moveQueue = [];
      player.dx = 0;
      player.dy = 0;
      player.combatTarget = null;
      player.fishingState = null;
      // Teleport
      tpZone.moveEntity(player.eid, tpX, tpY);
      player.dirty = true;
      // Broadcast to nearby players
      tpZone.broadcastToNearby(tpX, tpY, {
        op: Op.S_ENTITY_MOVE,
        d: { eid: player.eid, x: tpX, y: tpY, dx: 0, dy: 0, speed: 0, seq: player.lastMoveSeq },
      } satisfies ServerMessage);
      // Confirm to self
      player.send({
        op: Op.S_ENTITY_STOP,
        d: { eid: player.eid, x: tpX, y: tpY },
      } satisfies ServerMessage);
      break;
    }

    case Op.C_ATTACK: {
      const zone = world.getZone(player.zoneId);
      if (!zone) break;
      const attackTarget = zone.entities.get(msg.d.targetEid);
      if (!attackTarget) break;
      if (!(attackTarget instanceof Mob)) break;
      if (attackTarget.aiState === AIState.DEAD) break;
      const attackDist = movementFormulas.distance(player.x, player.y, attackTarget.x, attackTarget.y);
      if (attackDist > 10) break; // Reject obviously out-of-range targets
      player.combatTarget = msg.d.targetEid;
      player.attackCooldown = 0;
      break;
    }

    case Op.C_PARTY_INVITE:
      partyManager.invitePlayer(player, msg.d.targetEid);
      break;

    case Op.C_PARTY_ACCEPT:
      partyManager.acceptInvite(player, msg.d.inviterEid);
      break;

    case Op.C_PARTY_DECLINE:
      partyManager.declineInvite(player, msg.d.inviterEid);
      break;

    case Op.C_PARTY_LEAVE:
      partyManager.leaveParty(player);
      break;

    case Op.C_PARTY_KICK:
      partyManager.kickMember(player, msg.d.targetEid);
      break;

    case Op.C_CHAT_SEND: {
      const now = Date.now();
      // Rate limit: 1 message per second
      if (now - player.lastChatTime < 1000) break;

      const raw = msg.d.message;
      if (!raw || typeof raw !== "string") break;

      // Strip HTML and trim
      const message = raw.replace(/<[^>]*>/g, "").trim();
      if (message.length < 1 || message.length > 200) break;

      player.lastChatTime = now;
      const channel = msg.d.channel ?? "zone";
      const chatMsg = {
        op: Op.S_CHAT_MESSAGE,
        d: {
          channel,
          senderName: player.name,
          senderEid: player.eid,
          message,
          timestamp: now,
        },
      };

      if (channel === "global") {
        for (const [, p] of world.playersByEid) {
          p.send(chatMsg);
        }
      } else if (channel === "whisper") {
        const targetName = msg.d.targetName;
        if (!targetName) break;
        let target: Player | undefined;
        for (const [, p] of world.playersByEid) {
          if (p.name.toLowerCase() === targetName.toLowerCase()) {
            target = p;
            break;
          }
        }
        if (target) {
          target.send(chatMsg);
          // Echo back to sender so they see their own whisper
          player.send(chatMsg);
        } else {
          player.send({
            op: Op.S_CHAT_MESSAGE,
            d: { channel: "system" as const, senderName: "", message: `Player "${targetName}" not found.`, timestamp: now },
          });
        }
      } else {
        // Zone chat: broadcast to all players in same zone
        const zone = world.getZone(player.zoneId);
        if (zone) {
          for (const [, p] of zone.players) {
            p.send(chatMsg);
          }
        }
      }
      break;
    }

    case Op.C_PICKUP: {
      const zone = world.getZone(player.zoneId);
      if (!zone) break;
      const target = zone.entities.get(msg.d.targetEid);
      if (!target || !(target instanceof GroundItem)) break;
      const dist = movementFormulas.distance(player.x, player.y, target.x, target.y);
      if (dist > 2) break;

      const groundItem = target;
      const itemDef = ITEMS[groundItem.itemId];

      // Try to stack with existing item first
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

      // Otherwise find first empty slot
      if (slotIndex === -1) {
        slotIndex = player.inventory.indexOf(null);
      }
      if (slotIndex === -1) break; // Inventory full

      const existing = player.inventory[slotIndex];
      if (existing && existing.itemId === groundItem.itemId) {
        existing.quantity += groundItem.quantity;
      } else {
        player.inventory[slotIndex] = { itemId: groundItem.itemId, quantity: groundItem.quantity };
      }

      player.send({
        op: Op.S_INV_UPDATE,
        d: {
          slots: [{
            index: slotIndex,
            itemId: player.inventory[slotIndex]!.itemId,
            quantity: player.inventory[slotIndex]!.quantity,
          }],
        },
      } satisfies ServerMessage);

      zone.removeEntity(groundItem.eid);
      questOnItemPickup(player, groundItem.itemId);
      player.dirty = true;
      break;
    }

    case Op.C_INV_MOVE: {
      const fromSlot = msg.d.fromSlot;
      const toSlot = msg.d.toSlot;
      if (fromSlot < 0 || fromSlot >= player.inventory.length) break;
      if (toSlot < 0 || toSlot >= player.inventory.length) break;

      const temp = player.inventory[fromSlot];
      player.inventory[fromSlot] = player.inventory[toSlot];
      player.inventory[toSlot] = temp;

      const slots = [
        {
          index: fromSlot,
          itemId: player.inventory[fromSlot]?.itemId ?? null,
          quantity: player.inventory[fromSlot]?.quantity ?? 0,
        },
        {
          index: toSlot,
          itemId: player.inventory[toSlot]?.itemId ?? null,
          quantity: player.inventory[toSlot]?.quantity ?? 0,
        },
      ];

      player.send({
        op: Op.S_INV_UPDATE,
        d: { slots },
      } satisfies ServerMessage);

      player.dirty = true;
      break;
    }

    case Op.C_INV_DROP: {
      const dropSlot = msg.d.slot;
      if (dropSlot < 0 || dropSlot >= player.inventory.length) break;
      const dropItem = player.inventory[dropSlot];
      if (!dropItem) break;

      const dropQty = Math.min(msg.d.quantity, dropItem.quantity);
      if (dropQty <= 0) break;

      const dropZone = world.getZone(player.zoneId);
      if (!dropZone) break;

      const groundDrop = new GroundItem(
        dropZone.id,
        player.x,
        player.y,
        dropItem.itemId,
        dropQty,
      );
      dropZone.addEntity(groundDrop);

      dropItem.quantity -= dropQty;
      if (dropItem.quantity <= 0) {
        player.inventory[dropSlot] = null;
      }

      player.send({
        op: Op.S_INV_UPDATE,
        d: {
          slots: [{
            index: dropSlot,
            itemId: player.inventory[dropSlot]?.itemId ?? null,
            quantity: player.inventory[dropSlot]?.quantity ?? 0,
          }],
        },
      } satisfies ServerMessage);

      player.dirty = true;
      break;
    }

    case Op.C_INV_USE: {
      const useSlot = msg.d.slot;
      if (useSlot < 0 || useSlot >= player.inventory.length) break;
      const useItem = player.inventory[useSlot];
      if (!useItem) break;

      const useDef = ITEMS[useItem.itemId];
      if (!useDef) break;

      if (useDef.healAmount) {
        player.hp = Math.min(player.maxHp, player.hp + useDef.healAmount);
        player.send({
          op: Op.S_PLAYER_STATS,
          d: { hp: player.hp, maxHp: player.maxHp, level: 1 },
        } satisfies ServerMessage);
      }

      useItem.quantity--;
      if (useItem.quantity <= 0) {
        player.inventory[useSlot] = null;
      }

      player.send({
        op: Op.S_INV_UPDATE,
        d: {
          slots: [{
            index: useSlot,
            itemId: player.inventory[useSlot]?.itemId ?? null,
            quantity: player.inventory[useSlot]?.quantity ?? 0,
          }],
        },
      } satisfies ServerMessage);

      player.dirty = true;
      break;
    }

    case Op.C_EQUIP: {
      const equipSlotIdx = msg.d.inventorySlot;
      if (equipSlotIdx < 0 || equipSlotIdx >= player.inventory.length) break;
      const equipItem = player.inventory[equipSlotIdx];
      if (!equipItem) break;

      const equipDef = ITEMS[equipItem.itemId];
      if (!equipDef || !equipDef.equipSlot) break;

      const equipSlot = equipDef.equipSlot;
      const currentlyEquipped = player.equipment.get(equipSlot);

      // If something is already in that slot, swap it back to inventory
      if (currentlyEquipped) {
        player.inventory[equipSlotIdx] = { itemId: currentlyEquipped, quantity: 1 };
      } else {
        player.inventory[equipSlotIdx] = null;
      }

      player.equipment.set(equipSlot, equipItem.itemId);

      player.send({
        op: Op.S_INV_UPDATE,
        d: {
          slots: [{
            index: equipSlotIdx,
            itemId: player.inventory[equipSlotIdx]?.itemId ?? null,
            quantity: player.inventory[equipSlotIdx]?.quantity ?? 0,
          }],
        },
      } satisfies ServerMessage);

      player.send({
        op: Op.S_EQUIP_UPDATE,
        d: { slot: equipSlot, itemId: equipItem.itemId },
      } satisfies ServerMessage);

      player.dirty = true;
      break;
    }

    case Op.C_UNEQUIP: {
      const unequipSlot = msg.d.slot;
      const unequipItemId = player.equipment.get(unequipSlot);
      if (!unequipItemId) break;

      // Find an empty inventory slot
      const emptySlot = player.inventory.indexOf(null);
      if (emptySlot === -1) break; // Inventory full

      player.inventory[emptySlot] = { itemId: unequipItemId, quantity: 1 };
      player.equipment.delete(unequipSlot);

      player.send({
        op: Op.S_INV_UPDATE,
        d: {
          slots: [{
            index: emptySlot,
            itemId: unequipItemId,
            quantity: 1,
          }],
        },
      } satisfies ServerMessage);

      player.send({
        op: Op.S_EQUIP_UPDATE,
        d: { slot: unequipSlot, itemId: null },
      } satisfies ServerMessage);

      player.dirty = true;
      break;
    }

    case Op.C_NPC_INTERACT: {
      const zone = world.getZone(player.zoneId);
      if (!zone) break;
      const target = zone.entities.get(msg.d.targetEid);
      if (!target || !(target instanceof NPC)) break;
      const dist = movementFormulas.distance(player.x, player.y, target.x, target.y);
      if (dist > 2) break;

      const { available, turnIn } = getAvailableQuests(player, target.quests);

      player.send({
        op: Op.S_NPC_DIALOG,
        d: {
          npcName: target.name,
          dialog: target.dialog,
          availableQuests: available,
          turnInQuests: turnIn,
        },
      } satisfies ServerMessage);

      // If the NPC has a shop, also send shop data
      const npcShopItems = SHOPS[target.npcId];
      if (npcShopItems) {
        player.send({
          op: Op.S_SHOP_OPEN,
          d: {
            npcName: target.name,
            items: npcShopItems.map((e) => ({ itemId: e.itemId, buyPrice: e.buyPrice, stock: e.stock })),
          },
        } satisfies ServerMessage);
      }
      break;
    }

    case Op.C_QUEST_ACCEPT: {
      acceptQuest(player, msg.d.questId);
      break;
    }

    case Op.C_QUEST_TURN_IN: {
      turnInQuest(player, msg.d.questId);
      break;
    }

    case Op.C_USE_SKILL: {
      if (player.hp <= 0) break;
      const abilityDef = ABILITIES[msg.d.abilityId];
      if (!abilityDef) break;

      // Check cooldown
      const cd = player.abilityCooldowns.get(abilityDef.id) ?? 0;
      if (cd > 0) break;

      // Check stun
      if (player.stunTicks > 0) break;

      // Check level requirement
      const skillData = player.skills.get(abilityDef.skillRequired as SkillName);
      const skillLevel = skillData ? levelForXp(skillData.xp) : 1;
      if (skillLevel < abilityDef.levelRequired) break;

      const abilityZone = world.getZone(player.zoneId);
      if (!abilityZone) break;

      // Set cooldown
      player.abilityCooldowns.set(abilityDef.id, abilityDef.cooldownTicks);
      player.send({
        op: Op.S_SKILL_COOLDOWN,
        d: { abilityId: abilityDef.id, remainingMs: abilityDef.cooldownTicks * 100 },
      } satisfies ServerMessage);

      // Heal ability
      if (abilityDef.healPercent) {
        const healAmount = Math.floor(player.maxHp * abilityDef.healPercent);
        player.hp = Math.min(player.maxHp, player.hp + healAmount);
        player.dirty = true;
        abilityZone.broadcastToNearby(player.x, player.y, {
          op: Op.S_DAMAGE,
          d: { sourceEid: player.eid, targetEid: player.eid, amount: -healAmount, isCrit: false, targetHpAfter: player.hp },
        } satisfies ServerMessage);
      }

      // Enemy-targeted ability
      if (abilityDef.targetType === "enemy" && msg.d.targetEid !== undefined) {
        const abilityTarget = abilityZone.entities.get(msg.d.targetEid);
        if (!abilityTarget) break;

        const abilityDist = movementFormulas.distance(player.x, player.y, abilityTarget.x, abilityTarget.y);
        if (abilityDist > (abilityDef.range ?? 2.5)) break;

        if (abilityTarget instanceof Mob && abilityTarget.aiState !== AIState.DEAD) {
          // Calculate damage
          const aMeleeSkill = player.skills.get(SkillName.MELEE);
          const aMeleeLevel = aMeleeSkill ? levelForXp(aMeleeSkill.xp) : 1;
          let aEquipAttack = 0;
          for (const [, itemId] of player.equipment) {
            const item = ITEMS[itemId];
            if (item?.stats?.attack) aEquipAttack += item.stats.attack;
          }

          const rollResult = combatFormulas.rollDamage(aMeleeLevel, aEquipAttack, abilityTarget.def.defense, 0);
          let damage: number;
          if (abilityDef.guaranteedHit) {
            damage = Math.max(1, Math.floor(rollResult.damage * (abilityDef.damageMultiplier ?? 1)));
          } else {
            damage = rollResult.hit ? Math.floor(rollResult.damage * (abilityDef.damageMultiplier ?? 1)) : 0;
          }

          // Apply player damage multiplier from buffs
          damage = Math.floor(damage * player.damageMultiplier);

          if (damage > 0) {
            abilityTarget.hp = Math.max(0, abilityTarget.hp - damage);
            // Track threat for bosses
            if (abilityTarget.isBoss) {
              const current = abilityTarget.threatMap.get(player.eid) ?? 0;
              abilityTarget.threatMap.set(player.eid, current + damage);
            }
          }

          abilityZone.broadcastToNearby(abilityTarget.x, abilityTarget.y, {
            op: Op.S_DAMAGE,
            d: { sourceEid: player.eid, targetEid: abilityTarget.eid, amount: damage, isCrit: rollResult.isCrit, targetHpAfter: abilityTarget.hp },
          } satisfies ServerMessage);

          // Apply status effect if any (only on hit)
          if (abilityDef.statusEffect && damage > 0) {
            applyStatusEffect(abilityTarget.eid, abilityDef.statusEffect, player.eid, abilityZone);
          }

          if (abilityTarget.hp <= 0) {
            handleMobDeath(abilityTarget, player, abilityZone);
          }
        }
      }

      // Self-targeted status effect (sprint, war cry)
      if (abilityDef.statusEffect && abilityDef.targetType === "self") {
        applyStatusEffect(player.eid, abilityDef.statusEffect, player.eid, abilityZone);

        // War Cry: also apply to nearby party members
        if (abilityDef.partyBuff) {
          const party = partyManager.getPartyForPlayer(player.eid);
          if (party) {
            const members = partyManager.getPartyMembersInRange(party, player.x, player.y, player.zoneId, PARTY_XP_RANGE);
            for (const member of members) {
              if (member.eid !== player.eid) {
                applyStatusEffect(member.eid, abilityDef.statusEffect!, player.eid, abilityZone);
              }
            }
          }
        }
      }

      // Dodge Roll
      if (abilityDef.dashDistance) {
        const lastMove = player.moveQueue.length > 0 ? player.moveQueue[player.moveQueue.length - 1] : null;
        const dashDx = lastMove ? lastMove.dx : (player.dx || 0);
        const dashDy = lastMove ? lastMove.dy : (player.dy || 1);
        const len = Math.sqrt(dashDx * dashDx + dashDy * dashDy) || 1;
        const newX = player.x + (dashDx / len) * abilityDef.dashDistance;
        const newY = player.y + (dashDy / len) * abilityDef.dashDistance;

        if (movementFormulas.isWalkable(abilityZone.def, newX, newY)) {
          player.x = newX;
          player.y = newY;
          abilityZone.moveEntity(player.eid, player.x, player.y);
          player.dirty = true;
          abilityZone.broadcastToNearby(player.x, player.y, {
            op: Op.S_ENTITY_MOVE,
            d: { eid: player.eid, x: player.x, y: player.y, dx: dashDx / len, dy: dashDy / len, speed: player.speed * 3 },
          } satisfies ServerMessage);
        }
        if (abilityDef.invulnerableTicks) {
          player.invulnerableTicks = abilityDef.invulnerableTicks;
          applyStatusEffect(player.eid, "invulnerable", player.eid, abilityZone);
        }
      }

      break;
    }

    case Op.C_SHOP_BUY: {
      const shopZone = world.getZone(player.zoneId);
      if (!shopZone) break;
      const shopNpc = shopZone.entities.get(msg.d.npcEid);
      if (!shopNpc || !(shopNpc instanceof NPC)) break;
      const shopDist = movementFormulas.distance(player.x, player.y, shopNpc.x, shopNpc.y);
      if (shopDist > 3) break;

      // Find shop for this NPC
      const shopItems = SHOPS[shopNpc.npcId];
      if (!shopItems) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "This NPC has nothing to sell." } } satisfies ServerMessage);
        break;
      }

      const shopEntry = shopItems.find((e) => e.itemId === msg.d.itemId);
      if (!shopEntry) break;

      const buyQty = Math.max(1, Math.min(100, msg.d.quantity));
      const totalCost = shopEntry.buyPrice * buyQty;

      // Check gold
      let playerGold = 0;
      for (const slot of player.inventory) {
        if (slot?.itemId === "gold_coins") playerGold += slot.quantity;
      }
      if (playerGold < totalCost) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Not enough gold." } } satisfies ServerMessage);
        break;
      }

      // Remove gold
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

      // Add purchased item to inventory
      const buyItemDef = ITEMS[msg.d.itemId];
      let buyTargetSlot = -1;
      if (buyItemDef?.stackable) {
        for (let i = 0; i < player.inventory.length; i++) {
          if (player.inventory[i]?.itemId === msg.d.itemId) {
            buyTargetSlot = i;
            break;
          }
        }
      }
      if (buyTargetSlot === -1) buyTargetSlot = player.inventory.indexOf(null);
      if (buyTargetSlot === -1) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Inventory full." } } satisfies ServerMessage);
        break;
      }

      const existingBuySlot = player.inventory[buyTargetSlot];
      if (existingBuySlot?.itemId === msg.d.itemId) {
        if (buyItemDef && existingBuySlot.quantity + buyQty > buyItemDef.maxStack) {
          player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Stack is full." } } satisfies ServerMessage);
          break;
        }
        existingBuySlot.quantity += buyQty;
      } else {
        player.inventory[buyTargetSlot] = { itemId: msg.d.itemId, quantity: buyQty };
      }

      // Send inventory updates for changed slots
      const buyUpdatedSlots: Array<{ index: number; itemId: string | null; quantity: number }> = [];
      for (let i = 0; i < player.inventory.length; i++) {
        const s = player.inventory[i];
        buyUpdatedSlots.push({ index: i, itemId: s?.itemId ?? null, quantity: s?.quantity ?? 0 });
      }
      player.send({ op: Op.S_INV_UPDATE, d: { slots: buyUpdatedSlots.filter((s) => s.itemId !== null || s.quantity === 0) } } satisfies ServerMessage);
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Bought ${buyQty}x ${buyItemDef?.name ?? msg.d.itemId}.` } } satisfies ServerMessage);
      player.dirty = true;
      break;
    }

    case Op.C_SHOP_SELL: {
      const sellZone = world.getZone(player.zoneId);
      if (!sellZone) break;
      const sellNpc = sellZone.entities.get(msg.d.npcEid);
      if (!sellNpc || !(sellNpc instanceof NPC)) break;
      const sellDist = movementFormulas.distance(player.x, player.y, sellNpc.x, sellNpc.y);
      if (sellDist > 3) break;

      const sellSlotIdx = msg.d.inventorySlot;
      if (sellSlotIdx < 0 || sellSlotIdx >= player.inventory.length) break;
      const sellSlot = player.inventory[sellSlotIdx];
      if (!sellSlot) break;

      const sellItemDef = ITEMS[sellSlot.itemId];
      if (!sellItemDef) break;

      const sellQty = Math.min(msg.d.quantity, sellSlot.quantity);
      if (sellQty <= 0) break;

      // Sell price is half buy price, or 1 if not in any shop
      let sellPrice = 1;
      const npcShop = SHOPS[sellNpc.npcId];
      if (npcShop) {
        const entry = npcShop.find((e) => e.itemId === sellSlot.itemId);
        if (entry) {
          sellPrice = Math.max(1, Math.floor(entry.buyPrice / 2));
        }
      }
      const totalSellGold = sellPrice * sellQty;

      // Remove item
      sellSlot.quantity -= sellQty;
      if (sellSlot.quantity <= 0) {
        player.inventory[sellSlotIdx] = null;
      }

      // Add gold
      let goldSlotIdx = -1;
      for (let i = 0; i < player.inventory.length; i++) {
        if (player.inventory[i]?.itemId === "gold_coins") {
          goldSlotIdx = i;
          break;
        }
      }
      if (goldSlotIdx === -1) goldSlotIdx = player.inventory.indexOf(null);
      if (goldSlotIdx === -1) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Inventory full, cannot receive gold." } } satisfies ServerMessage);
        break;
      }

      const goldSlot = player.inventory[goldSlotIdx];
      if (goldSlot?.itemId === "gold_coins") {
        goldSlot.quantity += totalSellGold;
      } else {
        player.inventory[goldSlotIdx] = { itemId: "gold_coins", quantity: totalSellGold };
      }

      // Send inventory updates
      const sellUpdatedSlots: Array<{ index: number; itemId: string | null; quantity: number }> = [];
      for (const idx of [sellSlotIdx, goldSlotIdx]) {
        const s = player.inventory[idx];
        sellUpdatedSlots.push({ index: idx, itemId: s?.itemId ?? null, quantity: s?.quantity ?? 0 });
      }
      player.send({ op: Op.S_INV_UPDATE, d: { slots: sellUpdatedSlots } } satisfies ServerMessage);
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Sold ${sellQty}x ${sellItemDef.name} for ${totalSellGold} gold.` } } satisfies ServerMessage);
      player.dirty = true;
      break;
    }

    case Op.C_FISH_CAST: {
      // Check player is not already fishing
      if (player.fishingState) break;
      if (player.stunTicks > 0) break;

      const fishZone = world.getZone(player.zoneId);
      if (!fishZone) break;

      // Check for adjacent water tile
      const px = Math.floor(player.x);
      const py = Math.floor(player.y);
      let hasWater = false;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const tx = px + dx;
        const ty = py + dy;
        if (ty >= 0 && ty < fishZone.def.height && tx >= 0 && tx < fishZone.def.width) {
          if (fishZone.def.tiles[ty][tx] === TileType.WATER) {
            hasWater = true;
            break;
          }
        }
      }
      if (!hasWater) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You need to be next to water to fish." } } satisfies ServerMessage);
        break;
      }

      // Check fishing level and pick a fish
      const fishingSkill = player.skills.get(SkillName.FISHING);
      const fishingLevel = fishingSkill ? levelForXp(fishingSkill.xp) : 1;

      // Find eligible fishing spots
      const eligibleSpots = FISHING_SPOTS.filter((s) => fishingLevel >= s.levelReq);
      if (eligibleSpots.length === 0) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Nothing to catch here." } } satisfies ServerMessage);
        break;
      }

      // Pick a random spot
      const spot = eligibleSpots[Math.floor(Math.random() * eligibleSpots.length)];

      player.fishingState = {
        startTick: getCurrentTick(),
        fish: spot.fish,
        catchTick: spot.catchTicks,
        biteSent: false,
      };

      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You cast your line..." } } satisfies ServerMessage);
      break;
    }

    case Op.C_FISH_REEL: {
      if (!player.fishingState) break;

      const state = player.fishingState;
      const elapsed = getCurrentTick() - state.startTick;

      // Must wait for the bite (70% of catch time)
      const biteAt = Math.floor(state.catchTick * 0.7);
      if (elapsed < biteAt) {
        // Too early - scare away the fish
        player.send({ op: Op.S_FISH_RESULT, d: { success: false } } satisfies ServerMessage);
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You reeled in too early!" } } satisfies ServerMessage);
        player.fishingState = null;
        break;
      }

      // Success window: between bite and catch + grace period
      if (elapsed <= state.catchTick + 20) {
        // Find the spot for XP
        const spot = FISHING_SPOTS.find((s) => s.fish === state.fish);
        const xp = spot?.baseXp ?? 10;

        // Add fish to inventory
        let fishSlot = -1;
        const fishDef = ITEMS[state.fish];
        if (fishDef?.stackable) {
          for (let i = 0; i < player.inventory.length; i++) {
            if (player.inventory[i]?.itemId === state.fish) {
              fishSlot = i;
              break;
            }
          }
        }
        if (fishSlot === -1) fishSlot = player.inventory.indexOf(null);
        if (fishSlot === -1) {
          player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Inventory full!" } } satisfies ServerMessage);
          player.fishingState = null;
          break;
        }

        const existing = player.inventory[fishSlot];
        if (existing?.itemId === state.fish) {
          existing.quantity += 1;
        } else {
          player.inventory[fishSlot] = { itemId: state.fish, quantity: 1 };
        }

        player.send({
          op: Op.S_INV_UPDATE,
          d: { slots: [{ index: fishSlot, itemId: player.inventory[fishSlot]!.itemId, quantity: player.inventory[fishSlot]!.quantity }] },
        } satisfies ServerMessage);

        player.send({ op: Op.S_FISH_RESULT, d: { success: true, itemId: state.fish, xp } } satisfies ServerMessage);
        grantXp(player, SkillName.FISHING, xp);
        questOnItemPickup(player, state.fish);
        player.dirty = true;
      } else {
        player.send({ op: Op.S_FISH_RESULT, d: { success: false } } satisfies ServerMessage);
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "The fish got away!" } } satisfies ServerMessage);
      }

      player.fishingState = null;
      break;
    }

    case Op.C_PING:
      ws.send(
        JSON.stringify({
          op: Op.S_PONG,
          d: { t: msg.d.t, serverTime: Date.now() },
        }),
      );
      break;

    default:
      // Unknown or unimplemented opcode
      break;
  }
}

async function handleAuth(
  ws: GameWebSocket,
  data: { email: string; password: string },
): Promise<void> {
  // Simple auth: use the login endpoint logic inline for WS auth
  // In production, client would first POST /api/login, get a token, then send token over WS
  // For now, accept a token field
  const tokenData = data as unknown as { token: string };
  if (tokenData.token) {
    const userId = await verifyToken(tokenData.token);
    if (!userId) {
      ws.send(
        JSON.stringify({ op: Op.S_AUTH_ERROR, d: { reason: "Invalid token" } }),
      );
      return;
    }

    // Check if already logged in — kick old session cleanly
    const existing = world.getPlayerByUserId(userId);
    if (existing) {
      if (existing.partyId) {
        partyManager.leaveParty(existing);
      }
      if (existing.ws) {
        existing.ws.send(
          JSON.stringify({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Logged in from another device." } }),
        );
        existing.ws.close(1000, "Logged in elsewhere");
      }
      world.removePlayer(existing);
    }

    const player = await loadPlayer(userId);
    if (!player) {
      ws.send(
        JSON.stringify({ op: Op.S_AUTH_ERROR, d: { reason: "No character found" } }),
      );
      return;
    }

    // Apply God buffs
    if (player.isGod) {
      player.maxHp = 99999;
      player.hp = 99999;
      player.speed = player.speed * 1.5;
    }

    ws.data.userId = userId;
    ws.data.player = player;
    player.ws = ws;

    world.addPlayer(player);

    ws.send(
      JSON.stringify({
        op: Op.S_AUTH_OK,
        d: { token: "", playerId: player.playerId, eid: player.eid, ...(player.isGod ? { isGod: true } : {}) },
      }),
    );

    // Send initial stats
    ws.send(
      JSON.stringify({
        op: Op.S_PLAYER_STATS,
        d: { hp: player.hp, maxHp: player.maxHp, level: 1 },
      }),
    );

    // Send initial inventory state
    const invSlots: Array<{ index: number; itemId: string | null; quantity: number }> = [];
    for (let i = 0; i < player.inventory.length; i++) {
      const slot = player.inventory[i];
      if (slot) {
        invSlots.push({ index: i, itemId: slot.itemId, quantity: slot.quantity });
      }
    }
    if (invSlots.length > 0) {
      player.send({
        op: Op.S_INV_UPDATE,
        d: { slots: invSlots },
      } satisfies ServerMessage);
    }

    // Send initial equipment state
    for (const [slot, itemId] of player.equipment) {
      player.send({
        op: Op.S_EQUIP_UPDATE,
        d: { slot, itemId },
      } satisfies ServerMessage);
    }

    // Initialize quest state and send quest list
    initQuestState(player);
    sendQuestList(player);

    // Send unlocked abilities based on skill levels
    const unlockedAbilities: { slot: number; abilityId: string; cooldownMs: number }[] = [];
    for (const [abilityId, aDef] of Object.entries(ABILITIES)) {
      const aSkillData = player.skills.get(aDef.skillRequired as SkillName);
      const aSkillLevel = aSkillData ? levelForXp(aSkillData.xp) : 1;
      if (aSkillLevel >= aDef.levelRequired) {
        const remainingCd = player.abilityCooldowns.get(abilityId) ?? 0;
        unlockedAbilities.push({ slot: aDef.slot, abilityId, cooldownMs: remainingCd * 100 });
      }
    }
    player.send({
      op: Op.S_ABILITY_LIST,
      d: { abilities: unlockedAbilities },
    } satisfies ServerMessage);

    // Welcome message
    ws.send(
      JSON.stringify({
        op: Op.S_CHAT_MESSAGE,
        d: {
          channel: "system",
          senderName: "",
          message: "Welcome to MadWorld! Use WASD to move. Click mobs to attack. Press Enter to chat.",
          timestamp: Date.now(),
        },
      }),
    );
  }
}

export async function handleDisconnect(ws: GameWebSocket): Promise<void> {
  const player = ws.data.player;
  if (player) {
    player.ws = null;
    cleanupQuestState(player.eid);
    if (player.partyId) {
      partyManager.leaveParty(player);
    }
    await savePlayer(player).catch((err) =>
      console.error(`[Disconnect] Failed to save player ${player.name}:`, err),
    );
    world.removePlayer(player);
  }
}
