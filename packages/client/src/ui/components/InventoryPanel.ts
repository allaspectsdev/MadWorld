import { ITEMS, ItemCategory, Op, type ClientMessage } from "@madworld/shared";
import type { Socket } from "../../net/Socket.js";
import { useGameStore, type InventorySlot } from "../../state/GameStore.js";
import { ItemTooltip } from "./ItemTooltip.js";
import { EquipmentPanel } from "./EquipmentPanel.js";

const RARITY_COLORS: Record<string, string> = {
  common: "#aaaaaa",
  uncommon: "#55cc55",
  rare: "#5555ff",
  epic: "#aa55cc",
  legendary: "#ff8800",
};

export class InventoryPanel {
  private panel: HTMLElement;
  private grid: HTMLElement;
  private contextMenu: HTMLElement;
  private socket: Socket;
  private tooltip: ItemTooltip;
  private equipPanel: EquipmentPanel;
  private unsubInv: (() => void) | null = null;

  constructor(socket: Socket) {
    this.socket = socket;

    this.panel = document.getElementById("inventory-panel")!;
    this.grid = this.panel.querySelector(".inv-grid")!;
    this.contextMenu = document.getElementById("inv-context-menu")!;

    this.tooltip = new ItemTooltip();
    this.equipPanel = new EquipmentPanel(socket, this.tooltip);

    // Close context menu on click elsewhere
    document.addEventListener("click", () => {
      this.hideContextMenu();
    });

    // Subscribe to inventory and visibility changes
    let prevInventory = useGameStore.getState().inventory;
    let prevOpen = useGameStore.getState().inventoryOpen;
    this.unsubInv = useGameStore.subscribe((state) => {
      if (state.inventory !== prevInventory) {
        prevInventory = state.inventory;
        this.renderGrid();
      }
      if (state.inventoryOpen !== prevOpen) {
        prevOpen = state.inventoryOpen;
        this.setVisible(state.inventoryOpen);
      }
    });

    this.renderGrid();
    this.setVisible(useGameStore.getState().inventoryOpen);
  }

  destroy(): void {
    this.unsubInv?.();
    this.equipPanel.destroy();
  }

  private setVisible(open: boolean): void {
    if (open) {
      this.panel.classList.add("open");
    } else {
      this.panel.classList.remove("open");
      this.hideContextMenu();
      this.tooltip.hide();
    }
  }

  private renderGrid(): void {
    const inventory = useGameStore.getState().inventory;
    this.grid.innerHTML = "";

    for (let i = 0; i < 28; i++) {
      const slot = inventory[i];
      const slotEl = document.createElement("div");
      slotEl.className = "inv-slot";
      slotEl.dataset.index = String(i);

      if (slot) {
        const item = ITEMS[slot.itemId];
        if (item) {
          const color = RARITY_COLORS[item.rarity] ?? "#aaaaaa";
          const letter = item.name.charAt(0).toUpperCase();

          const itemEl = document.createElement("div");
          itemEl.className = "inv-item";
          itemEl.style.backgroundColor = color;
          itemEl.textContent = letter;
          slotEl.appendChild(itemEl);

          if (slot.quantity > 1) {
            const qtyEl = document.createElement("span");
            qtyEl.className = "inv-quantity";
            qtyEl.textContent = String(slot.quantity);
            slotEl.appendChild(qtyEl);
          }

          // Hover tooltip
          slotEl.addEventListener("mouseenter", (e) => {
            this.tooltip.show(slot.itemId, e.clientX, e.clientY);
          });
          slotEl.addEventListener("mousemove", (e) => {
            this.tooltip.show(slot.itemId, e.clientX, e.clientY);
          });
          slotEl.addEventListener("mouseleave", () => {
            this.tooltip.hide();
          });

          // Click to show context menu
          slotEl.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showContextMenu(i, slot, item, e.clientX, e.clientY);
          });
        }
      }

      this.grid.appendChild(slotEl);
    }
  }

  private showContextMenu(
    slotIndex: number,
    slot: InventorySlot,
    item: typeof ITEMS[string],
    x: number,
    y: number,
  ): void {
    this.contextMenu.innerHTML = "";

    const isConsumable = item.category === ItemCategory.CONSUMABLE;
    const isEquipment = !!item.equipSlot;

    if (isConsumable) {
      const useBtn = document.createElement("div");
      useBtn.className = "ctx-option";
      useBtn.textContent = "Use";
      useBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.socket.send({
          op: Op.C_INV_USE,
          d: { slot: slotIndex },
        } as ClientMessage);
        this.hideContextMenu();
      });
      this.contextMenu.appendChild(useBtn);
    }

    if (isEquipment) {
      const equipBtn = document.createElement("div");
      equipBtn.className = "ctx-option";
      equipBtn.textContent = "Equip";
      equipBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.socket.send({
          op: Op.C_EQUIP,
          d: { inventorySlot: slotIndex },
        } as ClientMessage);
        this.hideContextMenu();
      });
      this.contextMenu.appendChild(equipBtn);
    }

    const dropBtn = document.createElement("div");
    dropBtn.className = "ctx-option ctx-drop";
    dropBtn.textContent = "Drop";
    dropBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.socket.send({
        op: Op.C_INV_DROP,
        d: { slot: slotIndex, quantity: slot.quantity },
      } as ClientMessage);
      this.hideContextMenu();
    });
    this.contextMenu.appendChild(dropBtn);

    // Position context menu
    this.contextMenu.style.display = "block";
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;

    // Boundary check after showing
    requestAnimationFrame(() => {
      const rect = this.contextMenu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        this.contextMenu.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > window.innerHeight) {
        this.contextMenu.style.top = `${y - rect.height}px`;
      }
    });
  }

  private hideContextMenu(): void {
    this.contextMenu.style.display = "none";
  }
}
