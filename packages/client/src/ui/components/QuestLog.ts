import { useGameStore } from "../../state/GameStore.js";
import { QUESTS } from "@madworld/shared";

export class QuestLog {
  private container: HTMLElement;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.container = document.getElementById("quest-log")!;
    // Close button
    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("quest-log-close")) {
        useGameStore.getState().toggleQuestLog();
      }
    });
  }

  start(): void {
    this.unsubscribe = useGameStore.subscribe(
      (state) => {
        this.render(state.quests, state.completedQuests, state.questLogOpen);
      },
    );
    const state = useGameStore.getState();
    this.render(state.quests, state.completedQuests, state.questLogOpen);
  }

  stop(): void {
    this.unsubscribe?.();
  }

  private render(
    quests: { questId: string; stepIndex: number; progress: Record<string, number> }[],
    completedQuests: string[],
    open: boolean,
  ): void {
    if (!open) {
      this.container.classList.remove("open");
      return;
    }
    this.container.classList.add("open");

    let html = '<div class="quest-log-header"><span>Quest Log</span><button class="quest-log-close">X</button></div>';

    if (quests.length === 0 && completedQuests.length === 0) {
      html += '<div class="quest-log-empty">No quests yet. Talk to NPCs to find tasks.</div>';
    }

    // Active quests
    for (const q of quests) {
      const def = QUESTS[q.questId];
      if (!def) continue;
      const step = def.steps[q.stepIndex];
      if (!step) continue;

      let progressText = "";
      if (step.type === "kill" && step.quantity) {
        const current = q.progress[step.target] ?? 0;
        progressText = `${current}/${step.quantity}`;
      }

      const progressPct = step.quantity
        ? Math.min(100, ((q.progress[step.target] ?? 0) / step.quantity) * 100)
        : 0;

      html += `<div class="quest-entry">
        <div class="quest-name">${def.name}</div>
        <div class="quest-desc">${step.description}</div>
        ${progressText ? `<div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${progressPct}%"></div><span class="quest-progress-text">${progressText}</span></div>` : ""}
      </div>`;
    }

    // Completed quests
    for (const questId of completedQuests) {
      const def = QUESTS[questId];
      if (!def) continue;
      html += `<div class="quest-entry quest-completed">
        <div class="quest-name">${def.name} <span class="quest-done-tag">DONE</span></div>
      </div>`;
    }

    this.container.innerHTML = html;
  }
}
