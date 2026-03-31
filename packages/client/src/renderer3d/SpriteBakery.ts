import { Application, Graphics, Sprite, Container } from "pixi.js";
import * as THREE from "three";
import { TextureFactory } from "../renderer/TextureFactory.js";
import { getMobTexture, getMobSize, isBossMob } from "../renderer/MobSpriteDefinitions.js";
import { getPlayerTexture } from "../renderer/PlayerSpriteBuilder.js";
import { EntityType, ITEMS, type Appearance } from "@madworld/shared";

/**
 * Hidden PixiJS application used solely for baking procedural Graphics
 * into Three.js textures. Keeps all 3,352 lines of mob/player sprite art
 * working unchanged while providing Three.js CanvasTexture output.
 */

// Cache: key -> THREE.CanvasTexture
const threeTextureCache = new Map<string, THREE.CanvasTexture>();

let pixiApp: Application | null = null;

/** Initialize the hidden PixiJS renderer for sprite baking */
export async function initSpriteBakery(): Promise<void> {
  pixiApp = new Application();
  await pixiApp.init({
    width: 128,
    height: 128,
    backgroundAlpha: 0,
    antialias: false,
    resolution: 2,
  });
  // Don't add canvas to DOM — it stays hidden
  TextureFactory.init(pixiApp);
}

/**
 * Convert a PixiJS Texture (from the existing sprite pipeline) to a
 * Three.js CanvasTexture with NearestFilter for pixel-art crispness.
 */
function pixiToThreeTexture(pixiTexture: import("pixi.js").Texture, key: string): THREE.CanvasTexture {
  if (threeTextureCache.has(key)) return threeTextureCache.get(key)!;

  if (!pixiApp) throw new Error("SpriteBakery not initialized");

  // Create a sprite from the pixi texture, render it to extract pixels
  const sprite = new Sprite(pixiTexture);
  const container = new Container();
  container.addChild(sprite);

  // Use extract to get an HTMLCanvasElement
  const canvas = pixiApp.renderer.extract.canvas({
    target: container,
    resolution: 2,
  }) as HTMLCanvasElement;

  container.destroy({ children: true });

  // Create Three.js texture from the canvas
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  threeTextureCache.set(key, tex);
  return tex;
}

/** Get a Three.js texture for a mob/NPC by display name */
export function getMobTexture3D(name: string): THREE.CanvasTexture {
  const key = `mob:${name}`;
  if (threeTextureCache.has(key)) return threeTextureCache.get(key)!;
  const pixiTex = getMobTexture(name);
  return pixiToThreeTexture(pixiTex, key);
}

/** Get a Three.js texture for a player */
export function getPlayerTexture3D(
  appearance?: Appearance,
  equipment?: Record<string, string>,
): THREE.CanvasTexture {
  const a: Appearance = {
    hairStyle: appearance?.hairStyle ?? 0,
    hairColor: appearance?.hairColor ?? 0,
    skinColor: appearance?.skinColor ?? 0,
    shirtColor: appearance?.shirtColor ?? 0,
    bodyType: appearance?.bodyType ?? 0,
  };
  const equipStr = equipment
    ? Object.entries(equipment).sort().map(([k, v]) => `${k}:${v}`).join(",")
    : "";
  const key = `player:${a.hairStyle}_${a.hairColor}_${a.skinColor}_${a.shirtColor}_${a.bodyType ?? 0}_${equipStr}`;

  if (threeTextureCache.has(key)) return threeTextureCache.get(key)!;
  const pixiTex = getPlayerTexture(appearance, equipment);
  return pixiToThreeTexture(pixiTex, key);
}

/** Get a Three.js texture for a ground item */
export function getGroundItemTexture3D(itemId: string): THREE.CanvasTexture {
  const key = `item:${itemId}`;
  if (threeTextureCache.has(key)) return threeTextureCache.get(key)!;

  const item = ITEMS[itemId];
  let name = "GroundItem";
  if (item) {
    switch (item.category) {
      case "weapon": name = "GroundItem_Weapon"; break;
      case "armor": name = "GroundItem_Armor"; break;
      case "consumable": name = "GroundItem_Food"; break;
      case "material": name = itemId === "gold_coins" ? "GroundItem_Gold" : "GroundItem_Material"; break;
    }
  }
  const pixiTex = getMobTexture(name);
  return pixiToThreeTexture(pixiTex, key);
}

/** Unified texture lookup by entity type (mirrors old SpriteFactory) */
export function getEntityTexture3D(
  type: EntityType,
  name?: string,
  appearance?: Appearance,
  equipment?: Record<string, string>,
): THREE.CanvasTexture {
  switch (type) {
    case EntityType.PLAYER:
      return getPlayerTexture3D(appearance, equipment);
    case EntityType.MOB:
      return getMobTexture3D(name ?? "Unknown");
    case EntityType.NPC:
      return getMobTexture3D(name ?? "NPC");
    case EntityType.GROUND_ITEM:
      return getGroundItemTexture3D(name ?? "");
    default:
      return getMobTexture3D("Unknown");
  }
}

/** Invalidate a cached player texture (e.g. on equipment change) */
export function invalidatePlayerTexture(appearance: Appearance, equipment?: Record<string, string>): void {
  const equipStr = equipment
    ? Object.entries(equipment).sort().map(([k, v]) => `${k}:${v}`).join(",")
    : "";
  const key = `player:${appearance.hairStyle}_${appearance.hairColor}_${appearance.skinColor}_${appearance.shirtColor}_${appearance.bodyType ?? 0}_${equipStr}`;
  threeTextureCache.delete(key);
}

/** Re-export from MobSpriteDefinitions for convenience */
export { isBossMob, getMobSize };
