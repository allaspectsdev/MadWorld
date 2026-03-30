import { Op, movementFormulas, type ServerMessage } from "@madworld/shared";
import type { Player } from "./entities/Player.js";
import { world } from "./World.js";
import { sendInventory } from "../net/handlers/context.js";

const TRADE_RANGE = 5;
const MAX_TRADE_SLOTS = 12;
const TRADE_REQUEST_TIMEOUT_MS = 15_000;

interface TradeOffer {
  slot: number;
  inventorySlot: number;
  quantity: number;
}

interface TradeSession {
  playerA: Player;
  playerB: Player;
  offersA: Map<number, TradeOffer>;
  offersB: Map<number, TradeOffer>;
  confirmedA: boolean;
  confirmedB: boolean;
}

interface PendingRequest {
  requester: Player;
  target: Player;
  expiresAt: number;
}

class TradeManager {
  private sessions = new Map<number, TradeSession>(); // eid -> session
  private pendingRequests = new Map<number, PendingRequest>(); // targetEid -> request

  requestTrade(requester: Player, targetEid: number): void {
    if (this.sessions.has(requester.eid)) {
      requester.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You are already in a trade." } } satisfies ServerMessage);
      return;
    }

    const target = world.playersByEid.get(targetEid);
    if (!target) {
      requester.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Player not found." } } satisfies ServerMessage);
      return;
    }

    if (target.eid === requester.eid) return;

    if (requester.zoneId !== target.zoneId) {
      requester.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Player is in a different zone." } } satisfies ServerMessage);
      return;
    }

    const dist = movementFormulas.distance(requester.x, requester.y, target.x, target.y);
    if (dist > TRADE_RANGE) {
      requester.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Too far away to trade." } } satisfies ServerMessage);
      return;
    }

    if (this.sessions.has(target.eid)) {
      requester.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "That player is already trading." } } satisfies ServerMessage);
      return;
    }

    // Clear any existing outgoing request from this requester
    for (const [tid, req] of this.pendingRequests) {
      if (req.requester.eid === requester.eid) {
        this.pendingRequests.delete(tid);
      }
    }

    this.pendingRequests.set(target.eid, {
      requester,
      target,
      expiresAt: Date.now() + TRADE_REQUEST_TIMEOUT_MS,
    });

    target.send({
      op: Op.S_TRADE_INCOMING,
      d: { requesterEid: requester.eid, requesterName: requester.name },
    } satisfies ServerMessage);

    requester.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Trade request sent to ${target.name}.` } } satisfies ServerMessage);
  }

  acceptTrade(accepter: Player): void {
    const request = this.pendingRequests.get(accepter.eid);
    if (!request) {
      accepter.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "No pending trade request." } } satisfies ServerMessage);
      return;
    }

    this.pendingRequests.delete(accepter.eid);

    if (Date.now() > request.expiresAt) {
      accepter.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Trade request expired." } } satisfies ServerMessage);
      return;
    }

    const { requester } = request;
    if (this.sessions.has(requester.eid)) {
      accepter.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "That player is already in a trade." } } satisfies ServerMessage);
      return;
    }

    const session: TradeSession = {
      playerA: requester,
      playerB: accepter,
      offersA: new Map(),
      offersB: new Map(),
      confirmedA: false,
      confirmedB: false,
    };

    this.sessions.set(requester.eid, session);
    this.sessions.set(accepter.eid, session);

    requester.send({
      op: Op.S_TRADE_START,
      d: { partnerEid: accepter.eid, partnerName: accepter.name },
    } satisfies ServerMessage);

    accepter.send({
      op: Op.S_TRADE_START,
      d: { partnerEid: requester.eid, partnerName: requester.name },
    } satisfies ServerMessage);
  }

  cancelTrade(player: Player): void {
    // Cancel pending request
    const request = this.pendingRequests.get(player.eid);
    if (request) {
      this.pendingRequests.delete(player.eid);
      return;
    }
    // Also clear requests we sent
    for (const [tid, req] of this.pendingRequests) {
      if (req.requester.eid === player.eid) {
        this.pendingRequests.delete(tid);
        req.target.send({ op: Op.S_TRADE_CANCELLED, d: { reason: "Trade request cancelled." } } satisfies ServerMessage);
        return;
      }
    }

    const session = this.sessions.get(player.eid);
    if (!session) return;

    const partner = session.playerA.eid === player.eid ? session.playerB : session.playerA;
    this.sessions.delete(session.playerA.eid);
    this.sessions.delete(session.playerB.eid);

    partner.send({ op: Op.S_TRADE_CANCELLED, d: { reason: `${player.name} cancelled the trade.` } } satisfies ServerMessage);
    player.send({ op: Op.S_TRADE_CANCELLED, d: { reason: "Trade cancelled." } } satisfies ServerMessage);
  }

  setItem(player: Player, slot: number, inventorySlot: number, quantity: number): void {
    const session = this.sessions.get(player.eid);
    if (!session) return;

    if (slot < 0 || slot >= MAX_TRADE_SLOTS) return;

    const isA = session.playerA.eid === player.eid;
    const offers = isA ? session.offersA : session.offersB;

    if (quantity <= 0 || inventorySlot < 0) {
      // Remove item from trade slot
      offers.delete(slot);
    } else {
      // Validate inventory slot
      const invItem = player.inventory[inventorySlot];
      if (!invItem || invItem.quantity < quantity) return;

      // Check this inventory slot isn't already offered in another trade slot
      for (const [s, offer] of offers) {
        if (s !== slot && offer.inventorySlot === inventorySlot) {
          offers.delete(s);
          break;
        }
      }

      offers.set(slot, { slot, inventorySlot, quantity });
    }

    // Un-confirm both sides on any change
    session.confirmedA = false;
    session.confirmedB = false;

    // Send updates to both players
    this.sendTradeUpdates(session);
  }

  confirmTrade(player: Player): void {
    const session = this.sessions.get(player.eid);
    if (!session) return;

    const isA = session.playerA.eid === player.eid;
    if (isA) session.confirmedA = true;
    else session.confirmedB = true;

    // Send confirmation state to both
    this.sendTradeUpdates(session);

    // If both confirmed, execute trade
    if (session.confirmedA && session.confirmedB) {
      this.executeTrade(session);
    }
  }

  /** Called when a player disconnects or moves too far. */
  onPlayerDisconnect(player: Player): void {
    this.cancelTrade(player);
  }

  private sendTradeUpdates(session: TradeSession): void {
    const slotsA = this.offersToSlots(session.offersA, session.playerA);
    const slotsB = this.offersToSlots(session.offersB, session.playerB);

    // Player A sees their own offers as "mine" and B's as "theirs"
    session.playerA.send({
      op: Op.S_TRADE_UPDATE,
      d: { side: "mine", slots: slotsA, confirmed: session.confirmedA },
    } satisfies ServerMessage);
    session.playerA.send({
      op: Op.S_TRADE_UPDATE,
      d: { side: "theirs", slots: slotsB, confirmed: session.confirmedB },
    } satisfies ServerMessage);

    // Player B sees their own offers as "mine" and A's as "theirs"
    session.playerB.send({
      op: Op.S_TRADE_UPDATE,
      d: { side: "mine", slots: slotsB, confirmed: session.confirmedB },
    } satisfies ServerMessage);
    session.playerB.send({
      op: Op.S_TRADE_UPDATE,
      d: { side: "theirs", slots: slotsA, confirmed: session.confirmedA },
    } satisfies ServerMessage);
  }

  private offersToSlots(offers: Map<number, TradeOffer>, player: Player): { slot: number; itemId: string | null; quantity: number }[] {
    const slots: { slot: number; itemId: string | null; quantity: number }[] = [];
    for (const [, offer] of offers) {
      const inv = player.inventory[offer.inventorySlot];
      if (inv) {
        slots.push({ slot: offer.slot, itemId: inv.itemId, quantity: offer.quantity });
      }
    }
    return slots;
  }

  private executeTrade(session: TradeSession): void {
    const { playerA, playerB, offersA, offersB } = session;

    // Phase 1: Validate all items still exist with enough quantity
    for (const [, offer] of offersA) {
      const inv = playerA.inventory[offer.inventorySlot];
      if (!inv || inv.quantity < offer.quantity) {
        this.failTrade(session, "Item no longer available.");
        return;
      }
    }
    for (const [, offer] of offersB) {
      const inv = playerB.inventory[offer.inventorySlot];
      if (!inv || inv.quantity < offer.quantity) {
        this.failTrade(session, "Item no longer available.");
        return;
      }
    }

    // Phase 2: Check inventory space
    // Count how many slots each player will free up and how many they'll receive
    const aFreedSlots = new Set<number>();
    for (const [, offer] of offersA) {
      const inv = playerA.inventory[offer.inventorySlot];
      if (inv && inv.quantity === offer.quantity) aFreedSlots.add(offer.inventorySlot);
    }
    const bFreedSlots = new Set<number>();
    for (const [, offer] of offersB) {
      const inv = playerB.inventory[offer.inventorySlot];
      if (inv && inv.quantity === offer.quantity) bFreedSlots.add(offer.inventorySlot);
    }

    const aEmptySlots = playerA.inventory.filter((s, i) => s === null || aFreedSlots.has(i)).length;
    const bEmptySlots = playerB.inventory.filter((s, i) => s === null || bFreedSlots.has(i)).length;

    if (aEmptySlots < offersB.size) {
      this.failTrade(session, `${playerA.name} doesn't have enough inventory space.`);
      return;
    }
    if (bEmptySlots < offersA.size) {
      this.failTrade(session, `${playerB.name} doesn't have enough inventory space.`);
      return;
    }

    // Phase 3: Execute — remove offered items
    const receivedByA: { itemId: string; quantity: number }[] = [];
    const receivedByB: { itemId: string; quantity: number }[] = [];

    for (const [, offer] of offersA) {
      const inv = playerA.inventory[offer.inventorySlot]!;
      receivedByB.push({ itemId: inv.itemId, quantity: offer.quantity });
      inv.quantity -= offer.quantity;
      if (inv.quantity <= 0) playerA.inventory[offer.inventorySlot] = null;
    }

    for (const [, offer] of offersB) {
      const inv = playerB.inventory[offer.inventorySlot]!;
      receivedByA.push({ itemId: inv.itemId, quantity: offer.quantity });
      inv.quantity -= offer.quantity;
      if (inv.quantity <= 0) playerB.inventory[offer.inventorySlot] = null;
    }

    // Phase 4: Add received items to inventories
    for (const item of receivedByA) {
      this.addToInventory(playerA, item.itemId, item.quantity);
    }
    for (const item of receivedByB) {
      this.addToInventory(playerB, item.itemId, item.quantity);
    }

    // Cleanup
    this.sessions.delete(playerA.eid);
    this.sessions.delete(playerB.eid);

    playerA.dirty = true;
    playerB.dirty = true;

    // Notify both
    playerA.send({ op: Op.S_TRADE_COMPLETE, d: { received: receivedByA } } satisfies ServerMessage);
    playerB.send({ op: Op.S_TRADE_COMPLETE, d: { received: receivedByB } } satisfies ServerMessage);

    // Send full inventory update to both
    sendInventory(playerA);
    sendInventory(playerB);
  }

  private failTrade(session: TradeSession, reason: string): void {
    this.sessions.delete(session.playerA.eid);
    this.sessions.delete(session.playerB.eid);
    session.playerA.send({ op: Op.S_TRADE_CANCELLED, d: { reason } } satisfies ServerMessage);
    session.playerB.send({ op: Op.S_TRADE_CANCELLED, d: { reason } } satisfies ServerMessage);
  }

  private addToInventory(player: Player, itemId: string, quantity: number): void {
    // Try to stack with existing items first
    for (let i = 0; i < player.inventory.length; i++) {
      const slot = player.inventory[i];
      if (slot && slot.itemId === itemId) {
        slot.quantity += quantity;
        return;
      }
    }
    // Find first empty slot
    for (let i = 0; i < player.inventory.length; i++) {
      if (!player.inventory[i]) {
        player.inventory[i] = { itemId, quantity };
        return;
      }
    }
  }
}

export const tradeManager = new TradeManager();
