import { Texture } from "pixi.js";
import { EntityType, type Appearance } from "@madworld/shared";
import { getMobTexture } from "./MobSpriteDefinitions.js";
import { getPlayerTexture } from "./PlayerSpriteBuilder.js";

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
      return getMobTexture("GroundItem");
    default:
      return getMobTexture("Unknown");
  }
}
