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

    // Create shop panel HTML
    this.container = document.createElement("div");
    this.container.id = "shop-panel";
    this.container.style.cssText = `
      display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 400px; max-height: 80vh; background: rgba(10,10,20,0.95);
      border: 1px solid rgba(255,255,255,0.15); border-radius: 10px;
      padding: 16px; z-index: 100; color: #fff; overflow-y: auto;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;
    document.getElementById("ui-root")?.appendChild(this.container);
  }

  start(): void {
    // Subscribe to shop data changes
    useGameStore.subscribe((state) => {
      if (state.shopData) {
        this.show(state.shopData);
      }
    });
  }

  private show(data: { npcName: string; items: { itemId: string; buyPrice: number; stock: number }[] }): void {
    this.container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;color:#ffd700">${escapeHtml(data.npcName)}'s Shop</h3>
        <button id="shop-close" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:4px 8px;">&#x2715;</button>
      </div>
      <div id="shop-items" style="display:grid;grid-template-columns:1fr;gap:6px;"></div>
    `;

    const itemsContainer = this.container.querySelector("#shop-items")!;

    for (const shopItem of data.items) {
      const itemDef = ITEMS[shopItem.itemId];
      if (!itemDef) continue;

      const row = document.createElement("div");
      row.style.cssText = `
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px 10px; background: rgba(255,255,255,0.05); border-radius: 6px;
        cursor: pointer; transition: background 0.15s;
      `;
      row.addEventListener("mouseenter", () => { row.style.background = "rgba(255,255,255,0.1)"; });
      row.addEventListener("mouseleave", () => { row.style.background = "rgba(255,255,255,0.05)"; });

      row.innerHTML = `
        <div>
          <div style="font-weight:bold;font-size:13px;">${escapeHtml(itemDef.name)}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.5);">${escapeHtml(itemDef.description)}</div>
        </div>
        <button class="shop-buy-btn" data-item-id="${escapeHtml(shopItem.itemId)}" style="
          background: linear-gradient(135deg, #ffd700, #ff8c00); border: none; color: #111;
          padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 12px;
          cursor: pointer;
        ">${shopItem.buyPrice}g</button>
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

    this.container.style.display = "block";
  }

  hide(): void {
    this.container.style.display = "none";
    useGameStore.getState().setShopData(null);
  }

  setNpcEid(eid: number): void {
    this.npcEid = eid;
  }
}
