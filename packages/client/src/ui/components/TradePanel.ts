import { useGameStore } from "../../state/GameStore.js";
import { Op, ITEMS, type ClientMessage } from "@madworld/shared";
import type { Socket } from "../../net/Socket.js";
import { escapeHtml } from "../escapeHtml.js";

const TRADE_SLOTS = 12;
const COLS = 4;

export class TradePanel {
  private panel: HTMLElement;
  private socket: Socket;
  private unsubscribe: (() => void) | null = null;

  // UI elements
  private myGrid: HTMLElement;
  private theirGrid: HTMLElement;
  private myLabel: HTMLElement;
  private theirLabel: HTMLElement;
  private confirmBtn: HTMLButtonElement;
  private statusText: HTMLElement;
  private nextTradeSlot = 0;

  constructor(socket: Socket) {
    this.socket = socket;

    // Build panel
    this.panel = document.createElement("div");
    this.panel.className = "game-panel trade-panel";
    this.panel.style.display = "none";

    // Header
    const header = document.createElement("div");
    header.className = "panel-header";
    const title = document.createElement("div");
    title.className = "panel-title";
    title.textContent = "Trade";
    const closeBtn = document.createElement("button");
    closeBtn.className = "panel-close";
    closeBtn.textContent = "\u00D7";
    closeBtn.addEventListener("click", () => {
      this.socket.send({ op: Op.C_TRADE_CANCEL, d: {} } as ClientMessage);
    });
    header.appendChild(title);
    header.appendChild(closeBtn);
    this.panel.appendChild(header);

    // Body
    const body = document.createElement("div");
    body.className = "panel-body trade-body";

    // My side
    const mySection = document.createElement("div");
    mySection.className = "trade-section";
    this.myLabel = document.createElement("div");
    this.myLabel.className = "trade-section-label";
    this.myLabel.textContent = "Your Offer";
    this.myGrid = document.createElement("div");
    this.myGrid.className = "trade-grid";
    mySection.appendChild(this.myLabel);
    mySection.appendChild(this.myGrid);

    // Divider
    const divider = document.createElement("div");
    divider.className = "trade-divider";

    // Their side
    const theirSection = document.createElement("div");
    theirSection.className = "trade-section";
    this.theirLabel = document.createElement("div");
    this.theirLabel.className = "trade-section-label";
    this.theirLabel.textContent = "Their Offer";
    this.theirGrid = document.createElement("div");
    this.theirGrid.className = "trade-grid";
    theirSection.appendChild(this.theirLabel);
    theirSection.appendChild(this.theirGrid);

    body.appendChild(mySection);
    body.appendChild(divider);
    body.appendChild(theirSection);
    this.panel.appendChild(body);

    // Footer
    const footer = document.createElement("div");
    footer.className = "trade-footer";

    this.statusText = document.createElement("div");
    this.statusText.className = "trade-status";

    this.confirmBtn = document.createElement("button");
    this.confirmBtn.className = "trade-confirm-btn";
    this.confirmBtn.textContent = "Confirm Trade";
    this.confirmBtn.addEventListener("click", () => {
      this.socket.send({ op: Op.C_TRADE_CONFIRM, d: {} } as ClientMessage);
    });

    footer.appendChild(this.statusText);
    footer.appendChild(this.confirmBtn);
    this.panel.appendChild(footer);

    // Add inventory hint
    const hint = document.createElement("div");
    hint.className = "trade-hint";
    hint.textContent = "Click items in your inventory to offer them";
    this.panel.appendChild(hint);

    document.getElementById("ui-root")!.appendChild(this.panel);

    // Build grids
    this.buildGrid(this.myGrid);
    this.buildGrid(this.theirGrid);
  }

  start(): void {
    this.unsubscribe = useGameStore.subscribe((state) => {
      if (state.tradeSession) {
        this.show(state.tradeSession.partnerName);
        this.updateGrids(state.tradeMySlots, state.tradeTheirSlots);
        this.updateStatus(state.tradeMyConfirmed, state.tradeTheirConfirmed);
      } else {
        this.hide();
      }
    });
  }

  stop(): void {
    this.unsubscribe?.();
  }

  /** Called by InventoryPanel when a slot is clicked during active trade. */
  offerItem(inventorySlot: number, quantity: number): void {
    const state = useGameStore.getState();
    if (!state.tradeSession) return;

    const inv = state.inventory[inventorySlot];
    if (!inv) return;

    // Check if already offered, remove it
    const existing = state.tradeMySlots.find(s => {
      // Match by finding the slot that references this item
      const invItem = state.inventory[inventorySlot];
      return invItem && s.itemId === invItem.itemId;
    });

    const tradeSlot = this.nextTradeSlot;
    this.nextTradeSlot = (this.nextTradeSlot + 1) % TRADE_SLOTS;

    this.socket.send({
      op: Op.C_TRADE_SET_ITEM,
      d: { slot: tradeSlot, inventorySlot, quantity },
    } as ClientMessage);
  }

  isOpen(): boolean {
    return this.panel.style.display !== "none";
  }

  private show(partnerName: string): void {
    this.panel.style.display = "";
    this.myLabel.textContent = "Your Offer";
    this.theirLabel.textContent = `${escapeHtml(partnerName)}'s Offer`;
    this.nextTradeSlot = 0;
  }

  private hide(): void {
    this.panel.style.display = "none";
  }

  private buildGrid(container: HTMLElement): void {
    container.innerHTML = "";
    for (let i = 0; i < TRADE_SLOTS; i++) {
      const slot = document.createElement("div");
      slot.className = "trade-slot";
      container.appendChild(slot);
    }
  }

  private updateGrids(
    mySlots: { slot: number; itemId: string | null; quantity: number }[],
    theirSlots: { slot: number; itemId: string | null; quantity: number }[],
  ): void {
    this.fillGrid(this.myGrid, mySlots);
    this.fillGrid(this.theirGrid, theirSlots);
  }

  private fillGrid(container: HTMLElement, slots: { slot: number; itemId: string | null; quantity: number }[]): void {
    const children = container.children;
    // Clear all slots
    for (let i = 0; i < TRADE_SLOTS; i++) {
      const el = children[i] as HTMLElement;
      if (el) {
        el.innerHTML = "";
        el.className = "trade-slot";
      }
    }
    // Fill occupied slots
    for (const s of slots) {
      if (s.slot < 0 || s.slot >= TRADE_SLOTS || !s.itemId) continue;
      const el = children[s.slot] as HTMLElement;
      if (!el) continue;

      const itemDef = ITEMS[s.itemId];
      const name = itemDef?.name ?? s.itemId;
      const rarity = (itemDef as any)?.rarity ?? "common";

      el.className = `trade-slot filled rarity-${rarity}`;
      el.innerHTML = `<span class="trade-item-name">${escapeHtml(name)}</span>` +
        (s.quantity > 1 ? `<span class="trade-item-qty">${s.quantity}</span>` : "");
    }
  }

  private updateStatus(myConfirmed: boolean, theirConfirmed: boolean): void {
    if (myConfirmed && theirConfirmed) {
      this.statusText.textContent = "Both confirmed! Trading...";
    } else if (myConfirmed) {
      this.statusText.textContent = "Waiting for partner...";
      this.confirmBtn.textContent = "Confirmed \u2713";
      this.confirmBtn.disabled = true;
    } else if (theirConfirmed) {
      this.statusText.textContent = "Partner is ready!";
      this.confirmBtn.textContent = "Confirm Trade";
      this.confirmBtn.disabled = false;
    } else {
      this.statusText.textContent = "";
      this.confirmBtn.textContent = "Confirm Trade";
      this.confirmBtn.disabled = false;
    }
  }
}
