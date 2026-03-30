import type { Player } from "../../game/entities/Player.js";
import { tradeManager } from "../../game/TradeManager.js";

export function handleTradeRequest(player: Player, d: { targetEid: number }): void {
  tradeManager.requestTrade(player, d.targetEid);
}

export function handleTradeAccept(player: Player): void {
  tradeManager.acceptTrade(player);
}

export function handleTradeCancel(player: Player): void {
  tradeManager.cancelTrade(player);
}

export function handleTradeSetItem(player: Player, d: { slot: number; inventorySlot: number; quantity: number }): void {
  tradeManager.setItem(player, d.slot, d.inventorySlot, d.quantity);
}

export function handleTradeConfirm(player: Player): void {
  tradeManager.confirmTrade(player);
}
