import { ITEMS, EquipSlot, Op, type ClientMessage, type EquipmentStats } from "@madworld/shared";
import type { Socket } from "../../net/Socket.js";
import { useGameStore } from "../../state/GameStore.js";
import type { ItemTooltip } from "./ItemTooltip.js";

const SLOT_LABELS: Record<string, string> = {
  [EquipSlot.HEAD]: "Head",
  [EquipSlot.CHEST]: "Chest",
  [EquipSlot.LEGS]: "Legs",
  [EquipSlot.FEET]: "Feet",
  [EquipSlot.HANDS]: "Hands",
  [EquipSlot.WEAPON]: "Weapon",
  [EquipSlot.SHIELD]: "Shield",
  [EquipSlot.RING1]: "Ring 1",
  [EquipSlot.RING2]: "Ring 2",
  [EquipSlot.AMULET]: "Amulet",
};

const RARITY_COLORS: Record<string, string> = {
  common: "#aaaaaa",
  uncommon: "#55cc55",
  rare: "#5555ff",
  epic: "#aa55cc",
  legendary: "#ff8800",
};

export class EquipmentPanel {
  private container: HTMLElement;
  private socket: Socket;
  private tooltip: ItemTooltip;
  private unsub: (() => void) | null = null;

  constructor(socket: Socket, tooltip: ItemTooltip) {
    this.socket = socket;
    this.tooltip = tooltip;
    this.container = document.getElementById("equip-panel")!;

    this.render();
    let prevEquipment = useGameStore.getState().equipment;
    this.unsub = useGameStore.subscribe((state) => {
      if (state.equipment !== prevEquipment) {
        prevEquipment = state.equipment;
        this.render();
      }
    });
  }

  destroy(): void {
    this.unsub?.();
  }

  private render(): void {
    const equipment = useGameStore.getState().equipment;

    let slotsHtml = "";
    const slotKeys = Object.values(EquipSlot) as string[];
    for (const slot of slotKeys) {
      const itemId = equipment[slot];
      const item = itemId ? ITEMS[itemId] : null;
      const label = SLOT_LABELS[slot] ?? slot;

      if (item) {
        const color = RARITY_COLORS[item.rarity] ?? "#aaaaaa";
        slotsHtml += `<div class="equip-slot filled" data-slot="${slot}" data-item="${itemId}">
          <span class="equip-label">${label}</span>
          <span class="equip-item-name" style="color:${color}">${this.esc(item.name)}</span>
        </div>`;
      } else {
        slotsHtml += `<div class="equip-slot empty" data-slot="${slot}">
          <span class="equip-label">${label}</span>
          <span class="equip-item-name empty-text">Empty</span>
        </div>`;
      }
    }

    // Compute total stat bonuses
    const totals: EquipmentStats = {};
    for (const itemId of Object.values(equipment)) {
      const item = ITEMS[itemId];
      if (item?.stats) {
        if (item.stats.attack) totals.attack = (totals.attack ?? 0) + item.stats.attack;
        if (item.stats.defense) totals.defense = (totals.defense ?? 0) + item.stats.defense;
        if (item.stats.rangedAttack) totals.rangedAttack = (totals.rangedAttack ?? 0) + item.stats.rangedAttack;
        if (item.stats.speed) totals.speed = (totals.speed ?? 0) + item.stats.speed;
        if (item.stats.hp) totals.hp = (totals.hp ?? 0) + item.stats.hp;
      }
    }

    const statLines: string[] = [];
    if (totals.attack) statLines.push(`ATK: +${totals.attack}`);
    if (totals.defense) statLines.push(`DEF: +${totals.defense}`);
    if (totals.rangedAttack) statLines.push(`RNG: +${totals.rangedAttack}`);
    if (totals.speed) statLines.push(`SPD: +${totals.speed}`);
    if (totals.hp) statLines.push(`HP: +${totals.hp}`);

    const statsHtml = statLines.length > 0
      ? `<div class="equip-stats">${statLines.join(" &middot; ")}</div>`
      : `<div class="equip-stats">No bonuses</div>`;

    this.container.innerHTML = `
      <div class="equip-title">Equipment</div>
      <div class="equip-grid">${slotsHtml}</div>
      ${statsHtml}
    `;

    // Attach event listeners
    this.container.querySelectorAll<HTMLElement>(".equip-slot.filled").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const slot = el.dataset.slot!;
        this.socket.send({
          op: Op.C_UNEQUIP,
          d: { slot },
        } as ClientMessage);
      });

      const itemId = el.dataset.item!;
      el.addEventListener("mouseenter", (e) => {
        this.tooltip.show(itemId, e.clientX, e.clientY);
      });
      el.addEventListener("mousemove", (e) => {
        this.tooltip.show(itemId, e.clientX, e.clientY);
      });
      el.addEventListener("mouseleave", () => {
        this.tooltip.hide();
      });
    });
  }

  private esc(text: string): string {
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
  }
}
