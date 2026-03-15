import { Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import { TILE_SIZE, EntityType } from "@madworld/shared";
import type { RemoteEntity } from "../state/GameStore.js";
import { getEntityTexture } from "./SpriteFactory.js";
import { isBossMob, getMobSize } from "./MobSpriteDefinitions.js";
import {
  createAnimState,
  updateAnimation,
  triggerAttack,
  triggerDeath,
  type AnimState,
} from "./AnimationController.js";
import { TextureFactory } from "./TextureFactory.js";

interface EntitySprite {
  container: Container;
  mainSprite: Sprite;
  shadow: Graphics;
  nameText: Text;
  hpBar?: Graphics;
  hpBg?: Graphics;
  hpY: number;
  aura?: Graphics;
  arrow?: Graphics;
  glowRing?: Graphics;
  animState: AnimState;
  isLocal: boolean;
  isBoss: boolean;
}

const nameStyle = new TextStyle({
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  fontSize: 11,
  fontWeight: "bold",
  fill: 0xffffff,
  stroke: { color: 0x000000, width: 3 },
});

const localNameStyle = new TextStyle({
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  fontSize: 12,
  fontWeight: "bold",
  fill: 0x88ffaa,
  stroke: { color: 0x000000, width: 3 },
});

export class EntityRenderer {
  readonly container = new Container();
  private sprites = new Map<number, EntitySprite>();
  private localPlayerEid: number | null = null;
  private globalTimer = 0;

  setLocalPlayer(eid: number): void {
    this.localPlayerEid = eid;
  }

  updateEntity(eid: number, x: number, y: number, data?: RemoteEntity, dt = 0.016): void {
    this.globalTimer += dt;
    let sprite = this.sprites.get(eid);

    if (!sprite) {
      sprite = this.createSprite(eid, data);
      this.sprites.set(eid, sprite);
      this.container.addChild(sprite.container);
    }

    const anim = updateAnimation(sprite.animState, dt, x, y);
    const flipX = sprite.animState.facingLeft ? -1 : 1;
    sprite.mainSprite.scale.set(anim.scaleX * flipX, anim.scaleY);
    sprite.mainSprite.alpha = anim.alpha;
    sprite.mainSprite.rotation = anim.rotation;

    const px = x * TILE_SIZE + anim.offsetX;
    const py = y * TILE_SIZE + anim.offsetY;
    sprite.container.x = px;
    sprite.container.y = py;

    // Shadow stays at feet (doesn't bob)
    sprite.shadow.y = TILE_SIZE * 0.35 - anim.offsetY;

    // Boss aura pulse
    if (sprite.aura && sprite.isBoss) {
      sprite.aura.alpha = 0.08 + Math.sin(this.globalTimer * 1.5) * 0.06;
    }

    // Local player arrow pulse
    if (sprite.arrow) {
      sprite.arrow.y = -TILE_SIZE * 0.7 + Math.sin(this.globalTimer * 3) * 2;
      sprite.arrow.alpha = 0.7 + Math.sin(this.globalTimer * 4) * 0.3;
    }

    // HP bar update
    if (data && data.hp !== undefined && data.maxHp && sprite.hpBar && sprite.hpBg) {
      const ratio = Math.max(0, data.hp / data.maxHp);
      sprite.hpBar.clear();
      if (ratio > 0) {
        sprite.hpBar.roundRect(-15, sprite.hpY, 30 * ratio, 5, 2);
        sprite.hpBar.fill(ratio > 0.5 ? 0x2ecc71 : ratio > 0.25 ? 0xf39c12 : 0xe74c3c);
      }
    }

    sprite.container.zIndex = y;
  }

  updateLocalPlayer(x: number, y: number, dt = 0.016): void {
    if (this.localPlayerEid === null) return;
    let sprite = this.sprites.get(this.localPlayerEid);
    if (!sprite) {
      sprite = this.createSprite(this.localPlayerEid, undefined, true);
      this.sprites.set(this.localPlayerEid, sprite);
      this.container.addChild(sprite.container);
    }

    this.globalTimer += dt * 0.5; // avoid double-counting in same frame
    const anim = updateAnimation(sprite.animState, dt, x, y);
    const flipX = sprite.animState.facingLeft ? -1 : 1;
    sprite.mainSprite.scale.set(anim.scaleX * flipX, anim.scaleY);
    sprite.mainSprite.alpha = anim.alpha;
    sprite.mainSprite.rotation = anim.rotation;

    sprite.container.x = x * TILE_SIZE + anim.offsetX;
    sprite.container.y = y * TILE_SIZE + anim.offsetY;
    sprite.shadow.y = TILE_SIZE * 0.35 - anim.offsetY;

    if (sprite.arrow) {
      sprite.arrow.y = -TILE_SIZE * 0.7 + Math.sin(this.globalTimer * 3) * 2;
      sprite.arrow.alpha = 0.7 + Math.sin(this.globalTimer * 4) * 0.3;
    }

    sprite.container.zIndex = y;
  }

  removeEntity(eid: number): void {
    const sprite = this.sprites.get(eid);
    if (sprite) {
      this.container.removeChild(sprite.container);
      sprite.container.destroy({ children: true });
      this.sprites.delete(eid);
    }
  }

  triggerAttackAnim(eid: number): void {
    const sprite = this.sprites.get(eid);
    if (sprite) triggerAttack(sprite.animState);
  }

  triggerDeathAnim(eid: number): void {
    const sprite = this.sprites.get(eid);
    if (sprite) triggerDeath(sprite.animState);
  }

  clear(): void {
    for (const [, sprite] of this.sprites) {
      this.container.removeChild(sprite.container);
      sprite.container.destroy({ children: true });
    }
    this.sprites.clear();
  }

  getEntityAtScreen(
    screenX: number,
    screenY: number,
    worldX: number,
    worldY: number,
    hitRadius = 1.5,
  ): number | null {
    let closest: number | null = null;
    let closestDist = Infinity;

    for (const [eid, sprite] of this.sprites) {
      if (eid === this.localPlayerEid) continue;
      const ex = sprite.container.x / TILE_SIZE;
      const ey = sprite.container.y / TILE_SIZE;
      const dx = worldX - ex;
      const dy = worldY - ey;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < hitRadius && dist < closestDist) {
        closest = eid;
        closestDist = dist;
      }
    }

    return closest;
  }

  private createSprite(eid: number, data?: RemoteEntity, isLocal = false): EntitySprite {
    const cont = new Container();
    cont.sortableChildren = true;

    const type = data?.type ?? EntityType.PLAYER;
    const name = data?.name ?? (isLocal ? "You" : `Entity ${eid}`);
    const boss = type === EntityType.MOB && isBossMob(name);

    // Aura for bosses
    let aura: Graphics | undefined;
    if (boss) {
      aura = new Graphics();
      const auraColor = name.includes("Lich") ? 0x8800ff : 0xffaa00;
      aura.circle(0, 0, TILE_SIZE);
      aura.fill({ color: auraColor, alpha: 0.1 });
      aura.circle(0, 0, TILE_SIZE * 0.7);
      aura.fill({ color: auraColor, alpha: 0.06 });
      aura.zIndex = -2;
      cont.addChild(aura);
    }

    // Glow ring for local player
    let glowRing: Graphics | undefined;
    if (isLocal) {
      glowRing = new Graphics();
      glowRing.ellipse(0, TILE_SIZE * 0.3, 10, 4);
      glowRing.fill({ color: 0x44ff88, alpha: 0.15 });
      glowRing.ellipse(0, TILE_SIZE * 0.3, 8, 3);
      glowRing.fill({ color: 0x88ffaa, alpha: 0.1 });
      glowRing.zIndex = -1;
      cont.addChild(glowRing);
    }

    // Shadow (sized to roughly match the entity's footprint)
    const shadow = new Graphics();
    const shadowScale = boss ? 1.3 : 1.0;
    shadow.ellipse(0, TILE_SIZE * 0.4, TILE_SIZE * 0.35 * shadowScale, TILE_SIZE * 0.12 * shadowScale);
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    shadow.zIndex = -1;
    cont.addChild(shadow);

    // Main sprite — explicitly sized to fit the tile grid
    const texture = getEntityTexture(type, name, data?.appearance);
    const mainSprite = new Sprite(texture);
    mainSprite.anchor.set(0.5, 0.5);

    // Determine display size based on entity type
    if (type === EntityType.PLAYER) {
      mainSprite.width = TILE_SIZE * 0.85;
      mainSprite.height = TILE_SIZE * 1.1;
    } else if (type === EntityType.MOB) {
      const size = getMobSize(name);
      const scale = boss ? 1.4 : 1.0;
      const maxDim = Math.max(size.w, size.h);
      const fitScale = (TILE_SIZE / maxDim) * scale;
      mainSprite.width = size.w * fitScale;
      mainSprite.height = size.h * fitScale;
    } else {
      mainSprite.width = TILE_SIZE * 0.8;
      mainSprite.height = TILE_SIZE * 0.8;
    }

    cont.addChild(mainSprite);

    // Calculate top of sprite for positioning overlays
    const spriteHalfH = mainSprite.height / 2;
    const topY = -spriteHalfH;

    // Arrow indicator for local player
    let arrow: Graphics | undefined;
    if (isLocal) {
      arrow = new Graphics();
      arrow.moveTo(0, 0);
      arrow.lineTo(-5, -8);
      arrow.lineTo(5, -8);
      arrow.closePath();
      arrow.fill(0xffffff);
      arrow.y = topY - 14;
      arrow.zIndex = 10;
      cont.addChild(arrow);
    }

    // Name label
    const nameText = new Text({
      text: isLocal ? "You" : name,
      style: isLocal ? localNameStyle : nameStyle,
    });
    nameText.anchor.set(0.5, 1);
    nameText.y = topY - (isLocal ? 22 : 4);
    cont.addChild(nameText);

    const sprite: EntitySprite = {
      container: cont,
      mainSprite,
      shadow,
      nameText,
      hpY: topY - 2,
      animState: createAnimState(),
      isLocal,
      isBoss: boss,
    };

    // HP bar for mobs and other players
    if (type === EntityType.MOB || (!isLocal && type === EntityType.PLAYER)) {
      const hpY = topY - 2;
      const hpBg = new Graphics();
      hpBg.roundRect(-15, hpY, 30, 5, 2);
      hpBg.fill(0x1a1a1a);
      hpBg.roundRect(-15, hpY, 30, 5, 2);
      hpBg.stroke({ width: 0.5, color: 0x333333 });
      cont.addChild(hpBg);

      const hpBar = new Graphics();
      hpBar.roundRect(-15, hpY, 30, 5, 2);
      hpBar.fill(0x2ecc71);
      cont.addChild(hpBar);

      sprite.hpBg = hpBg;
      sprite.hpBar = hpBar;
    }

    if (aura) sprite.aura = aura;
    if (arrow) sprite.arrow = arrow;
    if (glowRing) sprite.glowRing = glowRing;

    return sprite;
  }
}
