import { ITEMS } from "@madworld/shared";

const RARITY_COLORS: Record<string, string> = {
  common: "#aaaaaa",
  uncommon: "#55cc55",
  rare: "#5555ff",
  epic: "#aa55cc",
  legendary: "#ff8800",
};

export class ItemTooltip {
  private el: HTMLElement;

  constructor() {
    this.el = document.getElementById("item-tooltip")!;
  }

  show(itemId: string, mouseX: number, mouseY: number): void {
    const item = ITEMS[itemId];
    if (!item) {
      this.hide();
      return;
    }

    const color = RARITY_COLORS[item.rarity] ?? "#aaaaaa";

    let html = `<div class="tooltip-name" style="color:${color}">${this.esc(item.name)}</div>`;
    html += `<div class="tooltip-rarity" style="color:${color}">${item.rarity}</div>`;
    html += `<div class="tooltip-desc">${this.esc(item.description)}</div>`;

    // Stats
    if (item.stats) {
      const lines: string[] = [];
      if (item.stats.attack) lines.push(`Attack: +${item.stats.attack}`);
      if (item.stats.defense) lines.push(`Defense: +${item.stats.defense}`);
      if (item.stats.rangedAttack) lines.push(`Ranged: +${item.stats.rangedAttack}`);
      if (item.stats.speed) lines.push(`Speed: +${item.stats.speed}`);
      if (item.stats.hp) lines.push(`HP: +${item.stats.hp}`);
      if (lines.length > 0) {
        html += `<div class="tooltip-stats">${lines.join("<br>")}</div>`;
      }
    }

    // Heal amount
    if (item.healAmount) {
      html += `<div class="tooltip-heal">Heals ${item.healAmount} HP</div>`;
    }

    // Level requirements
    if (item.levelReq) {
      const reqs = Object.entries(item.levelReq)
        .map(([skill, lvl]) => `${skill} Lv.${lvl}`)
        .join(", ");
      html += `<div class="tooltip-req">Requires: ${reqs}</div>`;
    }

    // Equip slot
    if (item.equipSlot) {
      html += `<div class="tooltip-slot">Slot: ${item.equipSlot}</div>`;
    }

    this.el.innerHTML = html;
    this.el.style.display = "block";

    // Position near cursor with boundary check
    const pad = 12;
    let left = mouseX + pad;
    let top = mouseY + pad;

    // Prevent overflow off the right/bottom edge
    const rect = this.el.getBoundingClientRect();
    if (left + rect.width > window.innerWidth) {
      left = mouseX - rect.width - pad;
    }
    if (top + rect.height > window.innerHeight) {
      top = mouseY - rect.height - pad;
    }

    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }

  hide(): void {
    this.el.style.display = "none";
  }

  private esc(text: string): string {
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
  }
}
