import { Container, Graphics, Sprite, Text, TextStyle, Texture, ColorMatrixFilter } from "pixi.js";
import { TILE_SIZE, EntityType } from "@madworld/shared";
import { useGameStore, type RemoteEntity } from "../state/GameStore.js";
import { getEntityTexture } from "./SpriteFactory.js";
import { isBossMob, getMobSize } from "./MobSpriteDefinitions.js";
import {
  createAnimState,
  updateAnimation,
  triggerAttack,
  triggerDeath,
  getAnimName,
  type AnimState,
} from "./AnimationController.js";
import { TextureFactory } from "./TextureFactory.js";
import { SpriteAnimator } from "./SpriteAnimator.js";
import { spriteSheetAnims } from "./SpriteSheetLoader.js";

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
  targetRing?: Graphics;
  questMarker?: Graphics;
  slashArc?: Graphics;
  slashTimer?: number;
  hitFlash?: { filter: ColorMatrixFilter; timer: number };
  statusTint?: { color: number; timer: number; duration: number };
  animState: AnimState;
  animator?: SpriteAnimator;
  isLocal: boolean;
  isBoss: boolean;
  isGod: boolean;
  entityType: EntityType;
}

const nameStyle = new TextStyle({
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  fontSize: 11,
  fontWeight: "bold",
  fill: 0xffffff,
  stroke: { color: 0x000000, width: 3 },
});

const npcNameStyle = new TextStyle({
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  fontSize: 12,
  fontWeight: "bold",
  fill: 0xffd700,
  stroke: { color: 0x000000, width: 3 },
});

const localNameStyle = new TextStyle({
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  fontSize: 12,
  fontWeight: "bold",
  fill: 0x88ffaa,
  stroke: { color: 0x000000, width: 3 },
});

const godNameStyle = new TextStyle({
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  fontSize: 13,
  fontWeight: "bold",
  fill: 0xffd700,
  stroke: { color: 0x885500, width: 3 },
});

export class EntityRenderer {
  readonly container = new Container();
  private sprites = new Map<number, EntitySprite>();
  private localPlayerEid: number | null = null;
  private globalTimer = 0;
  private targetEid: number | null = null;
  private hoverEid: number | null = null;

  setLocalPlayer(eid: number): void {
    this.localPlayerEid = eid;
  }

  /** Show a pulsing selection ring under the targeted entity */
  setTargetHighlight(eid: number | null): void {
    // Hide previous ring
    if (this.targetEid !== null && this.targetEid !== eid) {
      const prev = this.sprites.get(this.targetEid);
      if (prev?.targetRing) prev.targetRing.visible = false;
    }
    this.targetEid = eid;
    if (eid !== null) {
      const sprite = this.sprites.get(eid);
      if (sprite?.targetRing) sprite.targetRing.visible = true;
    }
  }

  /** Subtle brightness boost on hovered entity */
  setHoverHighlight(eid: number | null): void {
    if (this.hoverEid === eid) return;
    // Remove old highlight
    if (this.hoverEid !== null) {
      const prev = this.sprites.get(this.hoverEid);
      if (prev) prev.mainSprite.alpha = 1;
    }
    this.hoverEid = eid;
    // Apply new highlight (slightly brighter)
    if (eid !== null) {
      const sprite = this.sprites.get(eid);
      if (sprite && eid !== this.targetEid) {
        sprite.mainSprite.alpha = 1.15;
      }
    }
  }

  applyStatusTint(eid: number, color: number, duration: number): void {
    const sprite = this.sprites.get(eid);
    if (sprite) {
      sprite.statusTint = { color, timer: 0, duration };
    }
  }

  removeStatusTint(eid: number): void {
    const sprite = this.sprites.get(eid);
    if (sprite) {
      sprite.statusTint = undefined;
      sprite.mainSprite.tint = 0xffffff;
    }
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

    // Sprite sheet animation
    if (sprite.animator) {
      sprite.animator.facingLeft = sprite.animState.facingLeft;
      sprite.animator.play(getAnimName(sprite.animState));
      const tex = sprite.animator.update(dt);
      if (tex) {
        sprite.mainSprite.texture = tex;
      }
    }

    const px = x * TILE_SIZE + anim.offsetX;
    const py = y * TILE_SIZE + anim.offsetY;
    sprite.container.x = px;
    sprite.container.y = py;

    // Shadow stays at feet (doesn't bob)
    sprite.shadow.y = TILE_SIZE * 0.35 - anim.offsetY;

    // Boss/God aura pulse
    if (sprite.aura && (sprite.isBoss || sprite.isGod)) {
      sprite.aura.alpha = 0.08 + Math.sin(this.globalTimer * 1.5) * 0.06;
    }

    // Local player arrow pulse
    if (sprite.arrow) {
      sprite.arrow.y = -TILE_SIZE * 0.7 + Math.sin(this.globalTimer * 3) * 2;
      sprite.arrow.alpha = 0.7 + Math.sin(this.globalTimer * 4) * 0.3;
    }

    // Target ring pulse
    if (sprite.targetRing && sprite.targetRing.visible) {
      sprite.targetRing.alpha = 0.4 + Math.sin(this.globalTimer * 4) * 0.25;
      sprite.targetRing.scale.set(1 + Math.sin(this.globalTimer * 3) * 0.06);
    }

    // NPC quest marker bob
    if (sprite.questMarker) {
      sprite.questMarker.y = -sprite.mainSprite.height / 2 - 16 + Math.sin(this.globalTimer * 2.5) * 2;
    }

    // Slash arc animation
    if (sprite.slashArc && sprite.slashArc.visible) {
      sprite.slashTimer = (sprite.slashTimer ?? 0) + dt;
      const st = sprite.slashTimer / 0.2;
      if (st >= 1) {
        sprite.slashArc.visible = false;
      } else {
        sprite.slashArc.clear();
        const arcRadius = TILE_SIZE * 0.7;
        const startAngle = -Math.PI * 0.6;
        const sweep = Math.PI * 1.2 * st;
        const flip = sprite.animState.facingLeft ? -1 : 1;
        sprite.slashArc.arc(0, 0, arcRadius, startAngle * flip, (startAngle + sweep) * flip, flip < 0);
        sprite.slashArc.stroke({ width: 3, color: 0xffffff, alpha: (1 - st) * 0.7 });
        sprite.slashArc.arc(0, 0, arcRadius * 0.7, startAngle * flip, (startAngle + sweep * 0.8) * flip, flip < 0);
        sprite.slashArc.stroke({ width: 1.5, color: 0xffeedd, alpha: (1 - st) * 0.5 });
      }
    }

    // Hit flash decay
    if (sprite.hitFlash) {
      sprite.hitFlash.timer += dt;
      const ft = sprite.hitFlash.timer / 0.18;
      if (ft >= 1) {
        sprite.mainSprite.filters = [];
        sprite.hitFlash = undefined;
      } else {
        const ease = (1 - ft) * (1 - ft);
        sprite.hitFlash.filter.brightness(1 + ease * 1.5, false);
      }
    }

    // Status effect tint pulse
    if (sprite.statusTint) {
      sprite.statusTint.timer += dt;
      if (sprite.statusTint.timer >= sprite.statusTint.duration) {
        sprite.statusTint = undefined;
        sprite.mainSprite.tint = 0xffffff;
      } else {
        const pulse = 0.5 + 0.5 * Math.sin(sprite.statusTint.timer * 6 * Math.PI);
        const sc = sprite.statusTint.color;
        const r = Math.round(0xff + (((sc >> 16) & 0xff) - 0xff) * pulse * 0.3);
        const g = Math.round(0xff + (((sc >> 8) & 0xff) - 0xff) * pulse * 0.3);
        const b = Math.round(0xff + ((sc & 0xff) - 0xff) * pulse * 0.3);
        sprite.mainSprite.tint = (r << 16) | (g << 8) | b;
      }
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

    // Sprite sheet animation
    if (sprite.animator) {
      sprite.animator.facingLeft = sprite.animState.facingLeft;
      sprite.animator.play(getAnimName(sprite.animState));
      const tex = sprite.animator.update(dt);
      if (tex) {
        sprite.mainSprite.texture = tex;
      }
    }

    sprite.container.x = x * TILE_SIZE + anim.offsetX;
    sprite.container.y = y * TILE_SIZE + anim.offsetY;
    sprite.shadow.y = TILE_SIZE * 0.35 - anim.offsetY;

    if (sprite.arrow) {
      sprite.arrow.y = -TILE_SIZE * 0.7 + Math.sin(this.globalTimer * 3) * 2;
      sprite.arrow.alpha = 0.7 + Math.sin(this.globalTimer * 4) * 0.3;
    }

    // Hit flash decay
    if (sprite.hitFlash) {
      sprite.hitFlash.timer += dt;
      const ft = sprite.hitFlash.timer / 0.18;
      if (ft >= 1) {
        sprite.mainSprite.filters = [];
        sprite.hitFlash = undefined;
      } else {
        const ease = (1 - ft) * (1 - ft);
        sprite.hitFlash.filter.brightness(1 + ease * 1.5, false);
      }
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
    if (sprite) {
      triggerAttack(sprite.animState);
      if (sprite.slashArc) {
        sprite.slashArc.visible = true;
        sprite.slashTimer = 0;
      }
    }
  }

  triggerHitFlash(eid: number): void {
    const sprite = this.sprites.get(eid);
    if (!sprite) return;
    const filter = new ColorMatrixFilter();
    filter.brightness(2.5, false);
    sprite.mainSprite.filters = [filter];
    sprite.hitFlash = { filter, timer: 0 };
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
    hitRadius = 2.0,
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
    const isGod = (data?.isGod) || (isLocal && useGameStore.getState().localPlayer?.isGod);

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

    // God aura (golden glow)
    let godAura: Graphics | undefined;
    if (isGod && type === EntityType.PLAYER) {
      godAura = new Graphics();
      godAura.circle(0, 0, TILE_SIZE * 0.9);
      godAura.fill({ color: 0xffd700, alpha: 0.1 });
      godAura.circle(0, 0, TILE_SIZE * 0.6);
      godAura.fill({ color: 0xffd700, alpha: 0.06 });
      godAura.zIndex = -2;
      cont.addChild(godAura);
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

    const isNpc = type === EntityType.NPC;

    // Shadow (sized to roughly match the entity's footprint)
    const shadow = new Graphics();
    const shadowScale = boss ? 1.3 : 1.0;
    if (isNpc) {
      // Warm golden glow for NPCs
      shadow.ellipse(0, TILE_SIZE * 0.4, TILE_SIZE * 0.4, TILE_SIZE * 0.14);
      shadow.fill({ color: 0xffd700, alpha: 0.15 });
      shadow.ellipse(0, TILE_SIZE * 0.4, TILE_SIZE * 0.3, TILE_SIZE * 0.1);
      shadow.fill({ color: 0xffaa00, alpha: 0.1 });
    } else {
      shadow.ellipse(0, TILE_SIZE * 0.4, TILE_SIZE * 0.35 * shadowScale, TILE_SIZE * 0.12 * shadowScale);
      shadow.fill({ color: 0x000000, alpha: 0.3 });
    }
    shadow.zIndex = -1;
    cont.addChild(shadow);

    // Main sprite — explicitly sized to fit the tile grid
    const texture = getEntityTexture(type, name, data?.appearance);
    const mainSprite = new Sprite(texture);
    mainSprite.anchor.set(0.5, 0.5);

    // Determine display size based on entity type
    if (type === EntityType.PLAYER) {
      if (isGod) {
        mainSprite.width = TILE_SIZE * 1.1;
        mainSprite.height = TILE_SIZE * 1.4;
      } else {
        mainSprite.width = TILE_SIZE * 0.85;
        mainSprite.height = TILE_SIZE * 1.1;
      }
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

    // Crown for God players
    let crown: Graphics | undefined;
    if (isGod && type === EntityType.PLAYER) {
      crown = new Graphics();
      // Crown base
      crown.rect(-8, 0, 16, 4);
      crown.fill(0xffd700);
      // 5 crown points
      for (let i = 0; i < 5; i++) {
        const cx = -8 + i * 4;
        crown.moveTo(cx, 0);
        crown.lineTo(cx + 2, -5);
        crown.lineTo(cx + 4, 0);
        crown.fill(0xffd700);
      }
      // Red gem in center
      crown.circle(0, -2, 1.5);
      crown.fill(0xff0000);
      // Side gems
      crown.circle(-4, -1.5, 1);
      crown.fill(0x4488ff);
      crown.circle(4, -1.5, 1);
      crown.fill(0x4488ff);
      crown.y = topY - (isLocal ? 28 : 10);
      crown.zIndex = 10;
      cont.addChild(crown);
    }

    // Name label - include level for mobs and color by level difference
    let displayName = isLocal ? "You" : name;
    let selectedNameStyle: TextStyle = isGod ? godNameStyle : isLocal ? localNameStyle : isNpc ? npcNameStyle : nameStyle;

    if (type === EntityType.MOB && data?.level) {
      displayName = `${name} [Lv.${data.level}]`;
      const playerLevel = useGameStore.getState().localPlayer?.level ?? 1;
      const mobLevel = data.level;
      let mobNameColor: number;
      if (mobLevel > playerLevel + 5) {
        mobNameColor = 0xff4444; // Red
      } else if (mobLevel > playerLevel + 2) {
        mobNameColor = 0xff8844; // Orange
      } else if (mobLevel <= playerLevel - 5) {
        mobNameColor = 0x55ff55; // Green
      } else {
        mobNameColor = 0xffffff; // White
      }
      selectedNameStyle = new TextStyle({
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: 11,
        fontWeight: "bold",
        fill: mobNameColor,
        stroke: { color: 0x000000, width: 3 },
      });
    }

    const nameText = new Text({
      text: displayName,
      style: selectedNameStyle,
    });
    nameText.anchor.set(0.5, 1);
    nameText.y = topY - (isLocal ? 22 : 4);
    cont.addChild(nameText);

    // Check for sprite sheet animations
    const entityKey = type === EntityType.PLAYER ? "player" : name.toLowerCase().replace(/\s+/g, "_");
    const animState = createAnimState();
    let animator: SpriteAnimator | undefined;

    if (spriteSheetAnims.has(entityKey)) {
      animator = new SpriteAnimator();
      const animDefs = spriteSheetAnims.get(entityKey)!;
      for (const def of animDefs) {
        animator.addAnimation(def);
      }
      animState.hasSprites = true;
      animator.play("idle");
    }

    // Target selection ring (hidden by default)
    const targetRing = new Graphics();
    const ringColor = type === EntityType.NPC ? 0xffd700 : 0xe74c3c;
    // Dashed-style ring: draw multiple arcs
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2;
      const a1 = a0 + (Math.PI * 2) / 12;
      targetRing.arc(0, TILE_SIZE * 0.35, 12, a0, a1);
      targetRing.stroke({ width: 2, color: ringColor, alpha: 0.8 });
    }
    targetRing.zIndex = -1;
    targetRing.visible = false;
    cont.addChild(targetRing);

    // NPC quest/interaction marker ("!" above head)
    let questMarker: Graphics | undefined;
    if (isNpc) {
      questMarker = new Graphics();
      // "!" exclamation mark
      questMarker.roundRect(-2, 0, 4, 8, 1);
      questMarker.fill(0xffd700);
      questMarker.circle(0, 11, 2);
      questMarker.fill(0xffd700);
      // Glow behind
      questMarker.circle(0, 5, 7);
      questMarker.fill({ color: 0xffd700, alpha: 0.1 });
      questMarker.y = topY - 16;
      questMarker.zIndex = 10;
      cont.addChild(questMarker);
    }

    // Slash arc (hidden by default)
    const slashArc = new Graphics();
    slashArc.visible = false;
    slashArc.zIndex = 5;
    cont.addChild(slashArc);

    const sprite: EntitySprite = {
      container: cont,
      mainSprite,
      shadow,
      nameText,
      hpY: topY - 2,
      slashArc,
      animState,
      animator,
      isLocal,
      isBoss: boss,
      isGod: !!isGod,
      entityType: type,
      targetRing,
      questMarker,
    };

    // HP bar for mobs and other players (not NPCs)
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
    if (godAura) sprite.aura = godAura;
    if (arrow) sprite.arrow = arrow;
    if (glowRing) sprite.glowRing = glowRing;

    return sprite;
  }
}
