import { Texture } from "pixi.js";
import { EntityType, ITEMS, type Appearance } from "@madworld/shared";
import { getMobTexture } from "./MobSpriteDefinitions.js";
import { getPlayerTexture } from "./PlayerSpriteBuilder.js";

function getGroundItemTexture(itemId: string): Texture {
  const item = ITEMS[itemId];
  if (!item) return getMobTexture("GroundItem");
  switch (item.category) {
    case "weapon": return getMobTexture("GroundItem_Weapon");
    case "armor": return getMobTexture("GroundItem_Armor");
    case "consumable": return getMobTexture("GroundItem_Food");
    case "material": return getMobTexture(itemId === "gold_coins" ? "GroundItem_Gold" : "GroundItem_Material");
    default: return getMobTexture("GroundItem");
  }
}

export function getEntityTexture(
  type: EntityType,
  name?: string,
  appearance?: Appearance,
): Texture {
  switch (type) {
    case EntityType.PLAYER:
      return getPlayerTexture(appearance);
    case EntityType.MOB:
      return getMobTexture(name ?? "Unknown");
    case EntityType.NPC:
      return getMobTexture(name ?? "NPC");
    case EntityType.GROUND_ITEM:
      return getGroundItemTexture(name ?? "");
    default:
      return getMobTexture("Unknown");
  }
}
