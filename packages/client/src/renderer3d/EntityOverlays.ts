import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { EntityType } from "@madworld/shared";

/**
 * Creates HTML-based overlays positioned in 3D space via CSS2DRenderer.
 * Handles name labels, HP bars, chat bubbles, and damage numbers.
 */

// ── Name Labels ──

export function createNameLabel(
  name: string,
  type: EntityType,
  isLocal: boolean,
  isGod: boolean,
  level?: number,
): CSS2DObject {
  const div = document.createElement("div");
  div.className = "entity-label";
  div.style.pointerEvents = "none";
  div.style.whiteSpace = "nowrap";
  div.style.fontFamily = "'Segoe UI', system-ui, -apple-system, sans-serif";
  div.style.fontWeight = "bold";
  div.style.textShadow = "0 0 3px #000, 0 0 3px #000";
  div.style.textAlign = "center";
  div.style.fontSize = "13px";
  div.style.lineHeight = "1";

  if (isLocal) {
    div.style.color = isGod ? "#ffd700" : "#66ff88";
    div.textContent = isGod ? `\u{1F451} ${name}` : "You";
    div.style.fontSize = isGod ? "15px" : "13px";
  } else if (type === EntityType.NPC) {
    div.style.color = "#ffd700";
    div.style.fontSize = "14px";
    div.textContent = name;
  } else if (type === EntityType.MOB) {
    const displayName = level ? `${name} [Lv.${level}]` : name;
    div.style.color = "#ffffff";
    div.textContent = displayName;
  } else if (type === EntityType.PET) {
    div.style.color = "#ff88cc";
    div.textContent = name;
  } else {
    div.style.color = "#ffffff";
    div.textContent = name;
  }

  const label = new CSS2DObject(div);
  label.position.set(0, 0, 0); // Will be positioned per-entity in EntityRenderer3D
  return label;
}

// ── HP Bars ──

export interface HPBarOverlay {
  object: CSS2DObject;
  update(hp: number, maxHp: number): void;
  dispose(): void;
}

export function createHPBar(): HPBarOverlay {
  const container = document.createElement("div");
  container.className = "entity-hp-bar";
  container.style.pointerEvents = "none";
  container.style.width = "40px";
  container.style.height = "5px";
  container.style.backgroundColor = "rgba(0,0,0,0.6)";
  container.style.borderRadius = "2px";
  container.style.overflow = "hidden";

  const fill = document.createElement("div");
  fill.style.height = "100%";
  fill.style.backgroundColor = "#44cc44";
  fill.style.borderRadius = "2px";
  fill.style.transition = "width 0.2s ease, background-color 0.3s ease";
  fill.style.width = "100%";
  container.appendChild(fill);

  const obj = new CSS2DObject(container);
  obj.position.set(0, 0, 0); // Will be positioned per-entity

  return {
    object: obj,
    update(hp: number, maxHp: number) {
      const ratio = maxHp > 0 ? hp / maxHp : 0;
      fill.style.width = `${Math.max(0, ratio * 100)}%`;
      if (ratio > 0.5) fill.style.backgroundColor = "#44cc44";
      else if (ratio > 0.25) fill.style.backgroundColor = "#ddaa22";
      else fill.style.backgroundColor = "#cc3333";
    },
    dispose() {
      container.remove();
    },
  };
}

// ── Chat Bubbles ──

export interface ChatBubbleOverlay {
  object: CSS2DObject;
  timer: number;
  duration: number;
  update(dt: number): boolean; // returns false when expired
  dispose(): void;
}

export function createChatBubble(
  message: string,
  type: "player" | "npc",
  duration = 5,
): ChatBubbleOverlay {
  const div = document.createElement("div");
  div.className = "chat-bubble-3d";
  div.style.pointerEvents = "none";
  div.style.maxWidth = "160px";
  div.style.padding = "4px 8px";
  div.style.borderRadius = "8px";
  div.style.fontSize = "11px";
  div.style.fontFamily = "'Segoe UI', system-ui, sans-serif";
  div.style.textAlign = "center";
  div.style.transition = "opacity 0.3s ease, transform 0.3s ease";
  div.style.transformOrigin = "bottom center";

  if (type === "npc") {
    div.style.backgroundColor = "rgba(255,245,221,0.95)";
    div.style.border = "1px solid #daa520";
    div.style.color = "#3a2a10";
  } else {
    div.style.backgroundColor = "rgba(255,255,255,0.95)";
    div.style.border = "1px solid #cccccc";
    div.style.color = "#222222";
  }

  div.textContent = message;

  const obj = new CSS2DObject(div);
  obj.position.set(0, 3.0, 0); // Well above the entity

  return {
    object: obj,
    timer: 0,
    duration,
    update(dt: number): boolean {
      this.timer += dt;
      // Entrance animation
      if (this.timer < 0.2) {
        const t = this.timer / 0.2;
        const scale = 0.3 + t * 0.8;
        div.style.transform = `scale(${scale})`;
        div.style.opacity = `${t}`;
      } else if (this.timer < this.duration - 1) {
        div.style.transform = "scale(1)";
        div.style.opacity = "1";
      } else if (this.timer < this.duration) {
        // Fade out
        const fadeT = (this.timer - (this.duration - 1)) / 1;
        div.style.opacity = `${1 - fadeT}`;
      } else {
        return false;
      }
      return true;
    },
    dispose() {
      div.remove();
    },
  };
}

// ── Hit Splats (damage/heal numbers) ──

export interface HitSplatOverlay {
  object: CSS2DObject;
  timer: number;
  duration: number;
  startY: number;
  update(dt: number): boolean; // returns false when expired
  dispose(): void;
}

export function createHitSplat(
  amount: number,
  type: "hit" | "crit" | "miss" | "heal",
): HitSplatOverlay {
  const div = document.createElement("div");
  div.className = "hit-splat-3d";
  div.style.pointerEvents = "none";
  div.style.fontFamily = "'Segoe UI', system-ui, sans-serif";
  div.style.fontWeight = "bold";
  div.style.textShadow = "0 0 4px #000, 0 0 4px #000";
  div.style.textAlign = "center";
  div.style.whiteSpace = "nowrap";
  div.style.transition = "none";

  const duration = 1.2;

  switch (type) {
    case "hit":
      div.style.color = "#ff4444";
      div.style.fontSize = "18px";
      div.textContent = `-${amount}`;
      break;
    case "crit":
      div.style.color = "#ffd700";
      div.style.fontSize = "26px";
      div.textContent = `-${amount}!`;
      div.style.textShadow = "0 0 8px #ffaa00, 0 0 4px #000";
      break;
    case "miss":
      div.style.color = "#888888";
      div.style.fontSize = "14px";
      div.textContent = "MISS";
      break;
    case "heal":
      div.style.color = "#44ff44";
      div.style.fontSize = "20px";
      div.textContent = `+${amount}`;
      break;
  }

  const obj = new CSS2DObject(div);
  const startY = 2.5 + (Math.random() - 0.5) * 0.5;
  obj.position.set((Math.random() - 0.5) * 0.8, startY, 0);

  return {
    object: obj,
    timer: 0,
    duration,
    startY,
    update(dt: number): boolean {
      this.timer += dt;
      const t = this.timer / this.duration;
      if (t >= 1) return false;

      // Float upward
      obj.position.y = this.startY + t * 1.5;

      // Fade out in second half
      if (t > 0.4) {
        div.style.opacity = `${1 - (t - 0.4) / 0.6}`;
      }

      // Pop scale for crits
      if (type === "crit" && t < 0.15) {
        const popT = t / 0.15;
        const scale = 1.8 - popT * 0.6;
        div.style.transform = `scale(${scale})`;
      } else if (type === "crit") {
        div.style.transform = "scale(1.2)";
      }

      return true;
    },
    dispose() {
      div.remove();
    },
  };
}

// ── Quest Marker ──

export function createQuestMarker(): CSS2DObject {
  const div = document.createElement("div");
  div.className = "quest-marker-3d";
  div.style.pointerEvents = "none";
  div.style.color = "#ffd700";
  div.style.fontSize = "22px";
  div.style.fontWeight = "bold";
  div.style.textShadow = "0 0 6px #ffaa00, 0 0 3px #000";
  div.textContent = "!";

  const obj = new CSS2DObject(div);
  obj.position.set(0, 3.0, 0);
  return obj;
}
