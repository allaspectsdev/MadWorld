import { useGameStore } from "../../state/GameStore.js";
import type { PartyMemberInfo } from "@madworld/shared";

export class PartyHUD {
  private container: HTMLElement;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.container = document.getElementById("party-hud")!;
  }

  start(): void {
    this.unsubscribe = useGameStore.subscribe((state) => {
      this.render(state.party);
    });
    this.render(useGameStore.getState().party);
  }

  stop(): void {
    this.unsubscribe?.();
  }

  private render(party: { partyId: string; members: PartyMemberInfo[]; leadEid: number } | null): void {
    if (!party || party.members.length <= 1) {
      this.container.style.display = "none";
      this.container.innerHTML = "";
      return;
    }

    this.container.style.display = "flex";
    const localEid = useGameStore.getState().localPlayer?.eid;

    this.container.innerHTML = party.members
      .filter((m) => m.eid !== localEid)
      .map((m) => {
        const hpPct = m.maxHp > 0 ? (m.hp / m.maxHp) * 100 : 0;
        const hpColor = hpPct > 50 ? "#2ecc71" : hpPct > 25 ? "#f39c12" : "#e74c3c";
        const localZone = useGameStore.getState().localPlayer?.zoneId;
        const dimmed = m.zoneId !== localZone ? "opacity: 0.6;" : "";
        const leader = m.isLeader ? '<span class="party-leader-icon">★</span>' : "";

        return `<div class="party-member" style="${dimmed}">
          <div class="party-member-header">
            <span class="party-member-name">${m.name}</span>${leader}
          </div>
          <div class="party-hp-container">
            <div class="party-hp-bar" style="width:${hpPct}%;background:${hpColor}"></div>
            <span class="party-hp-text">${Math.max(0, m.hp)}/${m.maxHp}</span>
          </div>
          <span class="party-member-zone">${m.zoneName}</span>
        </div>`;
      })
      .join("");
  }
}
