export class SkillBar {
  private container: HTMLElement;

  constructor() {
    this.container = document.getElementById("skill-bar")!;
    this.buildSlots();
  }

  private buildSlots(): void {
    const slots = [
      { key: 1, label: "ATK", active: true },
      { key: 2, label: "", active: false },
      { key: 3, label: "", active: false },
      { key: 4, label: "", active: false },
      { key: 5, label: "", active: false },
      { key: 6, label: "", active: false },
      { key: 7, label: "", active: false },
      { key: 8, label: "", active: false },
    ];

    this.container.innerHTML = "";

    for (const slot of slots) {
      const el = document.createElement("div");
      el.className = "skill-slot" + (slot.active ? " active" : " locked");

      const keybind = document.createElement("span");
      keybind.className = "keybind";
      keybind.textContent = String(slot.key);
      el.appendChild(keybind);

      if (slot.active) {
        const label = document.createElement("span");
        label.textContent = slot.label;
        el.appendChild(label);
      }

      this.container.appendChild(el);
    }
  }
}
