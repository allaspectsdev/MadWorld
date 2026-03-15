import { Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import { TILE_SIZE, EntityType } from "@madworld/shared";
import type { RemoteEntity } from "../state/GameStore.js";
import { getEntityTexture } from "./SpriteFactory.js";
import { isBossMob } from "./MobSpriteDefinitions.js";
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
  shadow: Sprite;
  nameText: Text;
  hpBar?: Graphics;
  hpBg?: Graphics;
  aura?: Graphics;
  animState: AnimState;
}

let shadowTexture: Texture | null = null;

function getShadowTexture(): Texture {
  if (shadowTexture) return shadowTexture;
  const g = new Graphics();
  g.ellipse(10, 3, 10, 3);
  g.fill({ color: 0x000000, alpha: 0.25 });
  shadowTexture = TextureFactory.generate(g, 20, 6);
  return shadowTexture;
}

const nameStyle = new TextStyle({
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  fontSize: 11,
  fill: 0xffffff,
  stroke: { color: 0x000000, width: 2 },
});

export class EntityRenderer {
  readonly container = new Container();
  private sprites = new Map<number, EntitySprite>();
  private localPlayerEid: number | null = null;

  setLocalPlayer(eid: number): void {
    this.localPlayerEid = eid;
  }

  updateEntity(eid: number, x: number, y: number, data?: RemoteEntity, dt = 0.016): void {
    let sprite = this.sprites.get(eid);

    if (!sprite) {
      sprite = this.createSprite(eid, data);
      this.sprites.set(eid, sprite);
      this.container.addChild(sprite.container);
    }

    // Animation
    const anim = updateAnimation(sprite.animState, dt, x, y);
    sprite.mainSprite.scale.set(anim.scaleX, anim.scaleY);
    sprite.mainSprite.alpha = anim.alpha;

    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE + anim.offsetY;
    sprite.container.x = px;
    sprite.container.y = py;

    // Update HP bar
    if (data && data.hp !== undefined && data.maxHp && sprite.hpBar) {
      const ratio = Math.max(0, data.hp / data.maxHp);
      sprite.hpBar.clear();
      if (ratio > 0) {
        sprite.hpBar.roundRect(-14, -24, 28 * ratio, 4, 2);
        sprite.hpBar.fill(ratio > 0.5 ? 0x2ecc71 : ratio > 0.25 ? 0xf39c12 : 0xe74c3c);
      }
    }

    // Depth sort
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

    const anim = updateAnimation(sprite.animState, dt, x, y);
    sprite.mainSprite.scale.set(anim.scaleX, anim.scaleY);
    sprite.mainSprite.alpha = anim.alpha;

    sprite.container.x = x * TILE_SIZE;
    sprite.container.y = y * TILE_SIZE + anim.offsetY;
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
    const isBoss = type === EntityType.MOB && isBossMob(name);

    // Aura for bosses
    let aura: Graphics | undefined;
    if (isBoss) {
      aura = new Graphics();
      aura.circle(0, 0, TILE_SIZE * 0.8);
      aura.fill({ color: name.includes("Lich") ? 0x8800ff : 0xffaa00, alpha: 0.08 });
      aura.zIndex = -2;
      cont.addChild(aura);
    }

    // Shadow
    const shadow = new Sprite(getShadowTexture());
    shadow.anchor.set(0.5, 0.5);
    shadow.y = TILE_SIZE * 0.3;
    shadow.zIndex = -1;
    cont.addChild(shadow);

    // Main sprite
    const texture = getEntityTexture(type, name, data?.appearance);
    const mainSprite = new Sprite(texture);
    mainSprite.anchor.set(0.5, 0.5);
    if (isLocal) {
      // Slight green tint to distinguish self
      mainSprite.tint = 0xccffcc;
    }
    cont.addChild(mainSprite);

    // Name label
    const nameText = new Text({ text: isLocal ? "You" : name, style: nameStyle });
    nameText.anchor.set(0.5, 1);
    nameText.y = -TILE_SIZE * 0.5;
    cont.addChild(nameText);

    const sprite: EntitySprite = {
      container: cont,
      mainSprite,
      shadow,
      nameText,
      animState: createAnimState(),
    };

    // HP bar for mobs and other players
    if (type === EntityType.MOB || (!isLocal && type === EntityType.PLAYER)) {
      const hpBg = new Graphics();
      hpBg.roundRect(-14, -24, 28, 4, 2);
      hpBg.fill(0x222222);
      cont.addChild(hpBg);

      const hpBar = new Graphics();
      hpBar.roundRect(-14, -24, 28, 4, 2);
      hpBar.fill(0x2ecc71);
      cont.addChild(hpBar);

      sprite.hpBg = hpBg;
      sprite.hpBar = hpBar;
    }

    if (aura) sprite.aura = aura;

    return sprite;
  }
}
