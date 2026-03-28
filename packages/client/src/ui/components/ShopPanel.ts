import { ITEMS, Op, type ClientMessage } from "@madworld/shared";
import type { Socket } from "../../net/Socket.js";
import { useGameStore } from "../../state/GameStore.js";
import { escapeHtml } from "../escapeHtml.js";

export class ShopPanel {
  private container: HTMLElement;
  private socket: Socket;
  private npcEid: number = 0;

  constructor(socket: Socket) {
    this.socket = socket;

    // Create shop panel — uses game-panel design system
    this.container = document.createElement("div");
    this.container.id = "shop-panel";
    this.container.className = "game-panel";
    document.getElementById("ui-root")?.appendChild(this.container);
  }

  start(): void {
    useGameStore.subscribe((state) => {
      if (state.shopData) {
        this.show(state.shopData);
      }
    });
  }

  private show(data: { npcName: string; items: { itemId: string; buyPrice: number; stock: number }[] }): void {
    this.container.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">${escapeHtml(data.npcName)}'s Shop</span>
        <button class="panel-close" id="shop-close">&times;</button>
      </div>
      <div id="shop-items"></div>
    `;

    const itemsContainer = this.container.querySelector("#shop-items")!;

    for (const shopItem of data.items) {
      const itemDef = ITEMS[shopItem.itemId];
      if (!itemDef) continue;

      const row = document.createElement("div");
      row.className = "shop-item";
      row.innerHTML = `
        <div class="shop-item-info">
          <div class="shop-item-name">${escapeHtml(itemDef.name)}</div>
          <div class="shop-item-desc">${escapeHtml(itemDef.description)}</div>
        </div>
        <button class="shop-buy-btn" data-item-id="${escapeHtml(shopItem.itemId)}">${shopItem.buyPrice}g</button>
      `;
      itemsContainer.appendChild(row);
    }

    // Event handlers
    this.container.querySelector("#shop-close")?.addEventListener("click", () => this.hide());
    this.container.querySelectorAll(".shop-buy-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const itemId = (e.target as HTMLElement).dataset.itemId;
        if (itemId) {
          this.socket.send({
            op: Op.C_SHOP_BUY,
            d: { npcEid: this.npcEid, itemId, quantity: 1 },
          } as ClientMessage);
        }
      });
    });

    this.container.classList.add("open");
  }

  hide(): void {
    this.container.classList.remove("open");
    useGameStore.getState().setShopData(null);
  }

  setNpcEid(eid: number): void {
    this.npcEid = eid;
  }
}
