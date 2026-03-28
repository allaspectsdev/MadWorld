import { Assets, Spritesheet, type Texture } from "pixi.js";
import type { AnimationDef } from "./SpriteAnimator.js";

const SPRITE_REGISTRY: string[] = [
  // Entity keys that may have sprite sheets
  "player",
  "chicken",
  "goblin",
  "cow",
  "skeleton",
  "forest_spider",
];

// Expected atlas format: each sheet has animations named "idle", "walk", "attack", "death"
// with frames named like "idle_0", "idle_1", etc.

const ANIM_NAMES = ["idle", "walk", "attack", "death"];
const DEFAULT_FRAME_DURATION = 0.1; // seconds per frame

function parseAnimationsFromSheet(sheet: Spritesheet): AnimationDef[] {
  const defs: AnimationDef[] = [];

  for (const animName of ANIM_NAMES) {
    const frames: Texture[] = [];
    let i = 0;

    // Collect frames named like "idle_0", "idle_1", etc.
    while (true) {
      const frameKey = `${animName}_${i}`;
      const tex = sheet.textures[frameKey];
      if (!tex) break;
      frames.push(tex);
      i++;
    }

    if (frames.length > 0) {
      defs.push({
        name: animName,
        frames,
        frameDuration: DEFAULT_FRAME_DURATION,
        loop: animName !== "death" && animName !== "attack",
      });
    }
  }

  return defs;
}

export async function loadSpriteSheets(): Promise<Map<string, AnimationDef[]>> {
  const result = new Map<string, AnimationDef[]>();

  // Load all sheets in parallel with a per-sheet timeout.
  // Missing sheets (Vite returns HTML fallback) would hang Assets.load,
  // so we pre-check with a HEAD request.
  await Promise.all(
    SPRITE_REGISTRY.map(async (key) => {
      try {
        const url = `/sprites/${key}.json`;
        // Quick existence check — if the server returns HTML it's not a real asset
        const probe = await fetch(url, { method: "HEAD" });
        const ct = probe.headers.get("content-type") ?? "";
        if (!probe.ok || !ct.includes("json")) return;

        const sheet = await Assets.load<Spritesheet>(url);
        if (sheet && sheet.textures) {
          const anims = parseAnimationsFromSheet(sheet);
          if (anims.length > 0) {
            result.set(key, anims);
          }
        }
      } catch {
        // No sprite sheet for this entity — will use procedural fallback
      }
    }),
  );

  return result;
}

// Global registry that EntityRenderer checks
export const spriteSheetAnims = new Map<string, AnimationDef[]>();
