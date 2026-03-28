import { useGameStore } from "../../state/GameStore.js";
import { QUESTS, SHOPS, Op, type ClientMessage } from "@madworld/shared";
import type { Socket } from "../../net/Socket.js";
import { escapeHtml } from "../escapeHtml.js";

export class NPCDialog {
  private container: HTMLElement;
  private socket: Socket;
  private unsubscribe: (() => void) | null = null;

  constructor(socket: Socket) {
    this.socket = socket;
    this.container = document.getElementById("npc-dialog")!;

    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      if (target.classList.contains("npc-dialog-close")) {
        useGameStore.getState().setNpcDialog(null);
        return;
      }

      const questId = target.dataset.questAccept;
      if (questId) {
        this.socket.send({
          op: Op.C_QUEST_ACCEPT,
          d: { questId },
        } as ClientMessage);
        useGameStore.getState().setNpcDialog(null);
        return;
      }

      const turnInId = target.dataset.questTurnin;
      if (turnInId) {
        this.socket.send({
          op: Op.C_QUEST_TURN_IN,
          d: { questId: turnInId },
        } as ClientMessage);
        useGameStore.getState().setNpcDialog(null);
        return;
      }

      if (target.classList.contains("npc-shop-btn")) {
        const shopKey = target.dataset.shopKey;
        if (shopKey && SHOPS[shopKey]) {
          useGameStore.getState().setShopData({
            npcName: target.dataset.npcName ?? shopKey,
            items: SHOPS[shopKey],
          });
          useGameStore.getState().setNpcDialog(null);
        }
        return;
      }
    });
  }

  start(): void {
    this.unsubscribe = useGameStore.subscribe(
      (state) => {
        this.render(state.npcDialog);
      },
    );
    this.render(useGameStore.getState().npcDialog);
  }

  stop(): void {
    this.unsubscribe?.();
  }

  private render(
    dialog: { npcName: string; dialog: string; availableQuests: string[]; turnInQuests: string[] } | null,
  ): void {
    if (!dialog) {
      this.container.classList.remove("open");
      return;
    }
    this.container.classList.add("open");

    let html = `<div class="panel-header">
      <span class="panel-title">${escapeHtml(dialog.npcName)}</span>
      <button class="panel-close npc-dialog-close">&times;</button>
    </div>`;

    html += `<div class="npc-dialog-text">${escapeHtml(dialog.dialog)}</div>`;

    // Quests ready to turn in
    if (dialog.turnInQuests.length > 0) {
      html += '<div class="npc-quest-section"><div class="npc-quest-section-title">Turn In</div>';
      for (const questId of dialog.turnInQuests) {
        const def = QUESTS[questId];
        if (!def) continue;
        html += `<button class="npc-quest-btn npc-quest-turnin" data-quest-turnin="${escapeHtml(questId)}">${escapeHtml(def.name)} (Complete)</button>`;
      }
      html += "</div>";
    }

    // Available quests
    if (dialog.availableQuests.length > 0) {
      html += '<div class="npc-quest-section"><div class="npc-quest-section-title">Available Quests</div>';
      for (const questId of dialog.availableQuests) {
        const def = QUESTS[questId];
        if (!def) continue;
        html += `<div class="npc-quest-offer">
          <div class="npc-quest-offer-name">${escapeHtml(def.name)}</div>
          <div class="npc-quest-offer-desc">${escapeHtml(def.description)}</div>
          <button class="npc-quest-btn npc-quest-accept" data-quest-accept="${escapeHtml(questId)}">Accept</button>
        </div>`;
      }
      html += "</div>";
    }

    // Check if NPC has a shop - try common key formats
    const npcKey = dialog.npcName.toLowerCase().replace(/\s+/g, "_");
    const hasShop = SHOPS[npcKey] !== undefined;
    if (hasShop) {
      html += `<div class="npc-quest-section">
        <button class="npc-shop-btn" data-shop-key="${escapeHtml(npcKey)}" data-npc-name="${escapeHtml(dialog.npcName)}">Browse Shop</button>
      </div>`;
    }

    if (dialog.availableQuests.length === 0 && dialog.turnInQuests.length === 0 && !hasShop) {
      html += '<div style="padding:14px;text-align:center;color:var(--ui-text-muted);font-size:var(--font-size-sm);">No quests available.</div>';
    }

    this.container.innerHTML = html;
  }
}
