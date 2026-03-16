import { useGameStore } from "../../state/GameStore.js";
import { levelForXp, xpForLevel, ALL_SKILLS } from "@madworld/shared";

export class SkillsPanel {
  private panel: HTMLElement;
  private list: HTMLElement;
  private unsub: (() => void) | null = null;

  constructor() {
    this.panel = document.getElementById("skills-panel")!;
    this.list = document.getElementById("skills-list")!;

    let prevXp = useGameStore.getState().skillXp;
    let prevOpen = useGameStore.getState().skillsOpen;
    this.unsub = useGameStore.subscribe((state) => {
      if (state.skillXp !== prevXp) {
        prevXp = state.skillXp;
        this.render();
      }
      if (state.skillsOpen !== prevOpen) {
        prevOpen = state.skillsOpen;
        this.setVisible(state.skillsOpen);
      }
    });

    this.render();
    this.setVisible(useGameStore.getState().skillsOpen);
  }

  destroy(): void {
    this.unsub?.();
  }

  private setVisible(open: boolean): void {
    if (open) {
      this.panel.classList.add("open");
      this.render();
    } else {
      this.panel.classList.remove("open");
    }
  }

  private render(): void {
    const skillXp = useGameStore.getState().skillXp;
    this.list.innerHTML = "";

    for (const skillId of ALL_SKILLS) {
      const totalXp = skillXp[skillId] ?? 0;
      const level = levelForXp(totalXp);
      const currentLevelXp = xpForLevel(level);
      const nextLevelXp = xpForLevel(level + 1);
      const xpInLevel = totalXp - currentLevelXp;
      const xpNeeded = nextLevelXp - currentLevelXp;
      const progress = xpNeeded > 0 ? Math.min(100, (xpInLevel / xpNeeded) * 100) : 100;

      const row = document.createElement("div");
      row.className = "skill-row";
      row.innerHTML = `
        <div class="skill-info">
          <span class="skill-name">${skillId}</span>
          <span class="skill-level">Lv ${level}</span>
        </div>
        <div class="skill-xp-bar">
          <div class="skill-xp-fill" style="width:${progress}%"></div>
        </div>
        <div class="skill-xp-text">${xpInLevel} / ${xpNeeded} XP</div>
      `;
      this.list.appendChild(row);
    }
  }
}
