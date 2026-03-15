import { Op, type ClientMessage, type ServerMessage, ITEMS, movementFormulas } from "@madworld/shared";
import { Player } from "../game/entities/Player.js";
import { GroundItem } from "../game/entities/GroundItem.js";
import { NPC } from "../game/entities/NPC.js";
import { world } from "../game/World.js";
import { partyManager } from "../game/PartyManager.js";
import { verifyToken } from "../auth/jwt.js";
import { loadPlayer } from "../services/PlayerService.js";
import { savePlayer } from "../services/PlayerService.js";
import { initQuestState, sendQuestList, acceptQuest, turnInQuest, getAvailableQuests, cleanupQuestState } from "../game/systems/QuestSystem.js";
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

    case Op.C_ATTACK:
      player.combatTarget = msg.d.targetEid;
      player.attackCooldown = 0;
      break;

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

    ws.data.userId = userId;
    ws.data.player = player;
    player.ws = ws;

    world.addPlayer(player);

    ws.send(
      JSON.stringify({
        op: Op.S_AUTH_OK,
        d: { token: "", playerId: player.playerId, eid: player.eid },
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
