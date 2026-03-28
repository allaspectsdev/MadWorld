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

    // Panel header
    const header = document.createElement("div");
    header.className = "panel-header";
    header.innerHTML = '<span class="panel-title">Settings</span>';
    const closeBtn = document.createElement("button");
    closeBtn.className = "panel-close";
    closeBtn.textContent = "\u2715";
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);
    this.panel.appendChild(header);

    // Body wrapper
    const body = document.createElement("div");
    body.className = "panel-body";
    this.panel.appendChild(body);

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

    const body = this.panel.querySelector(".panel-body");
    (body ?? this.panel).appendChild(section);
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
