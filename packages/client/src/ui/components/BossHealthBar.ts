/**
 * Persistent boss health bar shown at the top center of the screen
 * when the player is fighting a boss mob.
 */
export class BossHealthBar {
  private el: HTMLElement;
  private nameEl: HTMLElement;
  private barFill: HTMLElement;
  private hpText: HTMLElement;
  private currentBossEid: number | null = null;
  private targetRatio = 1;
  private displayRatio = 1;

  constructor() {
    this.el = document.createElement("div");
    this.el.id = "boss-health-bar";
    this.el.innerHTML = `
      <div class="boss-bar-name"></div>
      <div class="boss-bar-track">
        <div class="boss-bar-fill"></div>
        <div class="boss-bar-text"></div>
      </div>
    `;
    document.getElementById("ui-root")?.appendChild(this.el);

    this.nameEl = this.el.querySelector(".boss-bar-name")!;
    this.barFill = this.el.querySelector(".boss-bar-fill")!;
    this.hpText = this.el.querySelector(".boss-bar-text")!;
  }

  show(eid: number, name: string, hp: number, maxHp: number): void {
    this.currentBossEid = eid;
    this.nameEl.textContent = name;
    this.targetRatio = Math.max(0, hp / maxHp);
    this.displayRatio = this.targetRatio;
    this.barFill.style.width = `${this.displayRatio * 100}%`;
    this.hpText.textContent = `${Math.max(0, hp)} / ${maxHp}`;
    this.el.classList.add("visible");
  }

  updateHp(eid: number, hp: number, maxHp: number): void {
    if (eid !== this.currentBossEid) return;
    this.targetRatio = Math.max(0, hp / maxHp);
    this.hpText.textContent = `${Math.max(0, hp)} / ${maxHp}`;
  }

  hide(): void {
    this.currentBossEid = null;
    this.el.classList.remove("visible");
  }

  get bossEid(): number | null {
    return this.currentBossEid;
  }

  update(dt: number): void {
    if (this.currentBossEid === null) return;
    // Smooth lerp toward target
    const diff = this.targetRatio - this.displayRatio;
    if (Math.abs(diff) > 0.001) {
      this.displayRatio += diff * Math.min(1, dt * 8);
      this.barFill.style.width = `${this.displayRatio * 100}%`;
    }

    // Color based on HP ratio
    if (this.displayRatio > 0.5) {
      this.barFill.style.background = "linear-gradient(90deg, #c0392b, #e74c3c)";
    } else if (this.displayRatio > 0.25) {
      this.barFill.style.background = "linear-gradient(90deg, #e67e22, #f39c12)";
    } else {
      this.barFill.style.background = "linear-gradient(90deg, #8e1515, #c0392b)";
    }
  }
}
