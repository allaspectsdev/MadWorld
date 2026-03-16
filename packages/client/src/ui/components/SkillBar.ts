import { ABILITIES } from "@madworld/shared";

interface SlotState {
  abilityId: string | null;
  cooldownMs: number;
  maxCooldownMs: number;
  element: HTMLElement;
  cooldownOverlay: HTMLElement;
  cooldownText: HTMLElement;
}

export class SkillBar {
  private slots: SlotState[] = [];
  private container: HTMLElement;

  constructor() {
    this.container = document.getElementById("skill-bar")!;
    // Initialize 8 slots from existing HTML children
    const slotElements = this.container.querySelectorAll<HTMLElement>(".skill-slot");

    // If no slot children exist yet (the old code generated them), create them
    if (slotElements.length === 0) {
      for (let i = 0; i < 8; i++) {
        const el = document.createElement("div");
        el.className = "skill-slot";
        this.container.appendChild(el);
      }
    }

    const finalSlots = this.container.querySelectorAll<HTMLElement>(".skill-slot");
    finalSlots.forEach((el, i) => {
      // Create cooldown overlay div inside each slot
      const overlay = document.createElement("div");
      overlay.className = "skill-cooldown-overlay";
      overlay.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:none;border-radius:6px;";
      el.appendChild(overlay);

      const cdText = document.createElement("div");
      cdText.className = "skill-cooldown-text";
      cdText.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:14px;font-weight:bold;color:#fff;text-shadow:0 0 4px #000;";
      el.appendChild(cdText);

      el.style.position = "relative";

      this.slots.push({
        abilityId: i === 0 ? "auto_attack" : null,
        cooldownMs: 0,
        maxCooldownMs: 0,
        element: el,
        cooldownOverlay: overlay,
        cooldownText: cdText,
      });
    });

    // Slot 1 is always ATK
    if (this.slots[0]) {
      this.slots[0].element.textContent = "";
      this.slots[0].element.innerHTML = '<span style="font-size:10px;position:absolute;top:2px;left:4px;color:rgba(255,255,255,0.5)">1</span><span style="font-size:12px;font-weight:bold;color:#fff">ATK</span>';
      this.slots[0].element.style.opacity = "1";
      this.slots[0].element.classList.add("active");
      this.slots[0].element.appendChild(this.slots[0].cooldownOverlay);
      this.slots[0].element.appendChild(this.slots[0].cooldownText);
    }

    // Initialize empty slots 2-8
    for (let i = 1; i < this.slots.length; i++) {
      this.slots[i].element.innerHTML = `<span style="font-size:10px;position:absolute;top:2px;left:4px;color:rgba(255,255,255,0.3)">${i + 1}</span>`;
      this.slots[i].element.style.opacity = "0.3";
      this.slots[i].element.classList.add("locked");
      this.slots[i].element.appendChild(this.slots[i].cooldownOverlay);
      this.slots[i].element.appendChild(this.slots[i].cooldownText);
    }
  }

  setAbilities(abilities: { slot: number; abilityId: string; cooldownMs: number }[]): void {
    // Reset all slots 2-8
    for (let i = 1; i < this.slots.length; i++) {
      this.slots[i].abilityId = null;
      this.slots[i].element.style.opacity = "0.3";
      this.slots[i].element.classList.remove("active");
      this.slots[i].element.classList.add("locked");
      this.slots[i].element.innerHTML = `<span style="font-size:10px;position:absolute;top:2px;left:4px;color:rgba(255,255,255,0.3)">${i + 1}</span>`;
      this.slots[i].element.appendChild(this.slots[i].cooldownOverlay);
      this.slots[i].element.appendChild(this.slots[i].cooldownText);
    }

    for (const ab of abilities) {
      const idx = ab.slot - 1; // slot is 1-based
      if (idx < 0 || idx >= this.slots.length) continue;
      const def = ABILITIES[ab.abilityId];
      if (!def) continue;

      this.slots[idx].abilityId = ab.abilityId;
      this.slots[idx].cooldownMs = ab.cooldownMs;
      this.slots[idx].maxCooldownMs = def.cooldownTicks * 100;

      const el = this.slots[idx].element;
      el.style.opacity = "1";
      el.classList.remove("locked");
      el.classList.add("active");
      el.innerHTML = `<span style="font-size:10px;position:absolute;top:2px;left:4px;color:rgba(255,255,255,0.5)">${ab.slot}</span><span style="font-size:10px;font-weight:bold;color:#fff;text-align:center;display:block;margin-top:14px">${def.name}</span>`;
      el.appendChild(this.slots[idx].cooldownOverlay);
      el.appendChild(this.slots[idx].cooldownText);
    }
  }

  setCooldown(abilityId: string, remainingMs: number): void {
    for (const slot of this.slots) {
      if (slot.abilityId === abilityId) {
        slot.cooldownMs = remainingMs;
        const def = ABILITIES[abilityId];
        if (def) slot.maxCooldownMs = def.cooldownTicks * 100;
      }
    }
  }

  update(dt: number): void {
    for (const slot of this.slots) {
      if (slot.cooldownMs > 0) {
        slot.cooldownMs = Math.max(0, slot.cooldownMs - dt * 1000);
        slot.cooldownOverlay.style.display = "block";
        const secs = Math.ceil(slot.cooldownMs / 1000);
        slot.cooldownText.textContent = secs > 0 ? `${secs}` : "";
      } else {
        slot.cooldownOverlay.style.display = "none";
        slot.cooldownText.textContent = "";
      }
    }
  }

  getAbilityForSlot(slotNum: number): string | null {
    const idx = slotNum - 1;
    if (idx < 0 || idx >= this.slots.length) return null;
    if (this.slots[idx].cooldownMs > 0) return null;
    return this.slots[idx].abilityId;
  }
}
