import { Application, Sprite, Container } from "pixi.js";
import { getPlayerTexture, SKIN_COLORS, HAIR_COLORS, SHIRT_COLORS } from "../../renderer/PlayerSpriteBuilder.js";
import type { Appearance } from "@madworld/shared";

const HAIR_STYLE_NAMES = ["Bald", "Short", "Mohawk", "Long", "Spiky"];
const BODY_TYPE_NAMES = ["Masculine", "Feminine"];

export class CharacterCreation {
  private container: HTMLElement;
  private previewImg: HTMLImageElement;
  private appearance: Appearance;
  private app: Application;
  private onConfirm: (appearance: Appearance) => void;

  constructor(app: Application, onConfirm: (appearance: Appearance) => void) {
    this.app = app;
    this.onConfirm = onConfirm;
    this.appearance = {
      skinColor: Math.floor(Math.random() * SKIN_COLORS.length),
      hairColor: Math.floor(Math.random() * HAIR_COLORS.length),
      hairStyle: Math.floor(Math.random() * HAIR_STYLE_NAMES.length),
      shirtColor: Math.floor(Math.random() * SHIRT_COLORS.length),
      bodyType: Math.floor(Math.random() * 2),
    };

    this.container = document.getElementById("character-creation")!;
    this.previewImg = document.createElement("img");
    this.buildUI();
  }

  show(): void {
    this.container.classList.add("visible");
    this.updatePreview();
  }

  hide(): void {
    this.container.classList.remove("visible");
  }

  private buildUI(): void {
    this.container.innerHTML = "";

    // Title
    const title = document.createElement("h1");
    title.className = "cc-title";
    title.textContent = "Create Your Character";

    // Preview area
    const previewArea = document.createElement("div");
    previewArea.className = "cc-preview";
    this.previewImg.className = "cc-preview-img";
    this.previewImg.alt = "Character Preview";
    previewArea.appendChild(this.previewImg);

    // Options panel
    const options = document.createElement("div");
    options.className = "cc-options";

    // Body type
    options.appendChild(this.buildToggleRow("Body Type", BODY_TYPE_NAMES, this.appearance.bodyType ?? 0, (v) => {
      this.appearance.bodyType = v;
      this.updatePreview();
    }));

    // Skin color
    options.appendChild(this.buildColorRow("Skin Tone", SKIN_COLORS, this.appearance.skinColor, (v) => {
      this.appearance.skinColor = v;
      this.updatePreview();
    }));

    // Hair style
    options.appendChild(this.buildToggleRow("Hair Style", HAIR_STYLE_NAMES, this.appearance.hairStyle, (v) => {
      this.appearance.hairStyle = v;
      this.updatePreview();
    }));

    // Hair color
    options.appendChild(this.buildColorRow("Hair Color", HAIR_COLORS, this.appearance.hairColor, (v) => {
      this.appearance.hairColor = v;
      this.updatePreview();
    }));

    // Shirt color
    options.appendChild(this.buildColorRow("Shirt Color", SHIRT_COLORS, this.appearance.shirtColor, (v) => {
      this.appearance.shirtColor = v;
      this.updatePreview();
    }));

    // Buttons
    const btnRow = document.createElement("div");
    btnRow.className = "cc-btn-row";

    const randomBtn = document.createElement("button");
    randomBtn.className = "cc-randomize-btn";
    randomBtn.textContent = "Randomize";
    randomBtn.addEventListener("click", () => {
      this.appearance = {
        skinColor: Math.floor(Math.random() * SKIN_COLORS.length),
        hairColor: Math.floor(Math.random() * HAIR_COLORS.length),
        hairStyle: Math.floor(Math.random() * HAIR_STYLE_NAMES.length),
        shirtColor: Math.floor(Math.random() * SHIRT_COLORS.length),
        bodyType: Math.floor(Math.random() * 2),
      };
      this.rebuildOptions(options);
      this.updatePreview();
    });

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "cc-confirm-btn";
    confirmBtn.textContent = "Enter World";
    confirmBtn.addEventListener("click", () => {
      this.onConfirm(this.appearance);
    });

    btnRow.appendChild(randomBtn);
    btnRow.appendChild(confirmBtn);

    // Layout
    const left = document.createElement("div");
    left.className = "cc-left";
    left.appendChild(previewArea);

    const right = document.createElement("div");
    right.className = "cc-right";
    right.appendChild(title);
    right.appendChild(options);
    right.appendChild(btnRow);

    this.container.appendChild(left);
    this.container.appendChild(right);
  }

  private rebuildOptions(optionsEl: HTMLElement): void {
    optionsEl.innerHTML = "";
    optionsEl.appendChild(this.buildToggleRow("Body Type", BODY_TYPE_NAMES, this.appearance.bodyType ?? 0, (v) => {
      this.appearance.bodyType = v;
      this.updatePreview();
    }));
    optionsEl.appendChild(this.buildColorRow("Skin Tone", SKIN_COLORS, this.appearance.skinColor, (v) => {
      this.appearance.skinColor = v;
      this.updatePreview();
    }));
    optionsEl.appendChild(this.buildToggleRow("Hair Style", HAIR_STYLE_NAMES, this.appearance.hairStyle, (v) => {
      this.appearance.hairStyle = v;
      this.updatePreview();
    }));
    optionsEl.appendChild(this.buildColorRow("Hair Color", HAIR_COLORS, this.appearance.hairColor, (v) => {
      this.appearance.hairColor = v;
      this.updatePreview();
    }));
    optionsEl.appendChild(this.buildColorRow("Shirt Color", SHIRT_COLORS, this.appearance.shirtColor, (v) => {
      this.appearance.shirtColor = v;
      this.updatePreview();
    }));
  }

  private buildColorRow(label: string, colors: readonly number[], current: number, onChange: (v: number) => void): HTMLElement {
    const section = document.createElement("div");
    section.className = "cc-section";

    const lbl = document.createElement("div");
    lbl.className = "cc-section-label";
    lbl.textContent = label;
    section.appendChild(lbl);

    const row = document.createElement("div");
    row.className = "cc-color-row";

    for (let i = 0; i < colors.length; i++) {
      const swatch = document.createElement("div");
      swatch.className = "cc-swatch" + (i === current ? " selected" : "");
      swatch.style.backgroundColor = "#" + colors[i].toString(16).padStart(6, "0");
      swatch.addEventListener("click", () => {
        row.querySelectorAll(".cc-swatch").forEach((s) => s.classList.remove("selected"));
        swatch.classList.add("selected");
        onChange(i);
      });
      row.appendChild(swatch);
    }

    section.appendChild(row);
    return section;
  }

  private buildToggleRow(label: string, names: string[], current: number, onChange: (v: number) => void): HTMLElement {
    const section = document.createElement("div");
    section.className = "cc-section";

    const lbl = document.createElement("div");
    lbl.className = "cc-section-label";
    lbl.textContent = label;
    section.appendChild(lbl);

    const row = document.createElement("div");
    row.className = "cc-toggle-row";

    for (let i = 0; i < names.length; i++) {
      const btn = document.createElement("button");
      btn.className = "cc-toggle-btn" + (i === current ? " selected" : "");
      btn.textContent = names[i];
      btn.addEventListener("click", () => {
        row.querySelectorAll(".cc-toggle-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        onChange(i);
      });
      row.appendChild(btn);
    }

    section.appendChild(row);
    return section;
  }

  private updatePreview(): void {
    const tex = getPlayerTexture(this.appearance);
    const sprite = new Sprite(tex);
    const scale = 6;
    sprite.width = tex.width * scale;
    sprite.height = tex.height * scale;

    const container = new Container();
    container.addChild(sprite);

    const canvas = this.app.renderer.extract.canvas(container) as HTMLCanvasElement;
    this.previewImg.src = canvas.toDataURL();
    container.destroy({ children: true });
  }
}
