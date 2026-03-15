import type { AudioManager } from "../../audio/AudioManager.js";
import type { Camera } from "../../renderer/Camera.js";

export class SettingsPanel {
  private panel: HTMLElement;
  private audio: AudioManager;
  private camera: Camera;
  private isOpen = false;

  constructor(audio: AudioManager, camera: Camera) {
    this.audio = audio;
    this.camera = camera;
    this.panel = document.getElementById("settings-panel")!;
    this.buildContent();
  }

  private buildContent(): void {
    this.panel.innerHTML = "";

    // Close button
    const closeBtn = document.createElement("div");
    closeBtn.style.cssText =
      "text-align:right;margin-bottom:8px;cursor:pointer;color:rgba(255,255,255,0.5);font-size:18px;";
    closeBtn.textContent = "\u2715";
    closeBtn.addEventListener("click", () => this.close());
    this.panel.appendChild(closeBtn);

    // Title
    const title = document.createElement("div");
    title.style.cssText =
      "text-align:center;font-size:18px;font-weight:700;color:#e94560;margin-bottom:16px;letter-spacing:2px;text-transform:uppercase;";
    title.textContent = "Settings";
    this.panel.appendChild(title);

    // Audio section
    this.buildSection("Audio", [
      this.buildSlider("Master Volume", "master", 1),
      this.buildSlider("SFX Volume", "sfx", 1),
      this.buildSlider("Music Volume", "music", 0.4),
      this.buildSlider("Ambient Volume", "ambient", 0.3),
    ]);

    // Display section
    this.buildSection("Display", [this.buildZoomSlider()]);

    // Controls section
    this.buildSection("Controls", [this.buildKeybindTable()]);
  }

  private buildSection(title: string, children: HTMLElement[]): void {
    const section = document.createElement("div");
    section.className = "settings-section";

    const heading = document.createElement("div");
    heading.className = "settings-title";
    heading.textContent = title;
    section.appendChild(heading);

    for (const child of children) {
      section.appendChild(child);
    }

    this.panel.appendChild(section);
  }

  private buildSlider(
    label: string,
    channel: "master" | "sfx" | "music" | "ambient",
    defaultValue: number,
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = "settings-row";

    const lbl = document.createElement("span");
    lbl.className = "settings-label";
    lbl.textContent = label;

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "settings-slider";
    slider.min = "0";
    slider.max = "100";
    slider.value = String(
      Math.round(this.audio.getVolume(channel) * 100) || Math.round(defaultValue * 100),
    );

    slider.addEventListener("input", () => {
      const value = parseInt(slider.value) / 100;
      this.audio.setVolume(channel, value);
    });

    row.appendChild(lbl);
    row.appendChild(slider);
    return row;
  }

  private buildZoomSlider(): HTMLElement {
    const row = document.createElement("div");
    row.className = "settings-row";

    const lbl = document.createElement("span");
    lbl.className = "settings-label";
    lbl.textContent = "Zoom Level";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "settings-slider";
    slider.min = "75";
    slider.max = "250";
    slider.value = String(Math.round(this.camera.zoom * 100));

    slider.addEventListener("input", () => {
      const value = parseInt(slider.value) / 100;
      this.camera.setZoom(value);
    });

    row.appendChild(lbl);
    row.appendChild(slider);
    return row;
  }

  private buildKeybindTable(): HTMLElement {
    const table = document.createElement("table");
    table.className = "keybind-table";

    const keybinds = [
      ["WASD / Arrows", "Move"],
      ["Click", "Attack"],
      ["Right-click", "Party invite"],
      ["Enter", "Chat"],
      ["I", "Inventory"],
      ["L", "Quest Log"],
      ["Escape", "Settings"],
      ["Scroll", "Zoom"],
    ];

    for (const [key, action] of keybinds) {
      const tr = document.createElement("tr");
      const tdKey = document.createElement("td");
      tdKey.textContent = key;
      const tdAction = document.createElement("td");
      tdAction.textContent = action;
      tr.appendChild(tdKey);
      tr.appendChild(tdAction);
      table.appendChild(tr);
    }

    return table;
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.isOpen = true;
    this.panel.classList.add("open");
  }

  close(): void {
    this.isOpen = false;
    this.panel.classList.remove("open");
  }

  get opened(): boolean {
    return this.isOpen;
  }
}
