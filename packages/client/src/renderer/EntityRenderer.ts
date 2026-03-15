import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { TILE_SIZE, EntityType } from "@madworld/shared";
import type { RemoteEntity } from "../state/GameStore.js";

const ENTITY_COLORS: Record<string, number> = {
  [EntityType.PLAYER]: 0x3498db,
  [EntityType.MOB]: 0xe74c3c,
  [EntityType.NPC]: 0x2ecc71,
  [EntityType.GROUND_ITEM]: 0xf39c12,
};

interface EntitySprite {
  container: Container;
  body: Graphics;
  nameText: Text;
  hpBar?: Graphics;
  hpBg?: Graphics;
}

export class EntityRenderer {
  readonly container = new Container();
  private sprites = new Map<number, EntitySprite>();
  private localPlayerEid: number | null = null;

  private nameStyle = new TextStyle({
    fontFamily: "Courier New",
    fontSize: 11,
    fill: 0xffffff,
    stroke: { color: 0x000000, width: 2 },
  });

  setLocalPlayer(eid: number): void {
    this.localPlayerEid = eid;
  }

  updateEntity(eid: number, x: number, y: number, data?: RemoteEntity): void {
    let sprite = this.sprites.get(eid);

    if (!sprite) {
      sprite = this.createSprite(eid, data);
      this.sprites.set(eid, sprite);
      this.container.addChild(sprite.container);
    }

    sprite.container.x = x * TILE_SIZE;
    sprite.container.y = y * TILE_SIZE;

    // Update HP bar if applicable
    if (data && data.hp !== undefined && data.maxHp && sprite.hpBar) {
      const ratio = Math.max(0, data.hp / data.maxHp);
      sprite.hpBar.clear();
      sprite.hpBar.rect(-12, -20, 24 * ratio, 3);
      sprite.hpBar.fill(ratio > 0.5 ? 0x2ecc71 : ratio > 0.25 ? 0xf39c12 : 0xe74c3c);
    }

    // Y-sort for depth
    sprite.container.zIndex = y;
  }

  updateLocalPlayer(x: number, y: number): void {
    if (this.localPlayerEid === null) return;
    let sprite = this.sprites.get(this.localPlayerEid);
    if (!sprite) {
      sprite = this.createSprite(this.localPlayerEid, undefined, true);
      this.sprites.set(this.localPlayerEid, sprite);
      this.container.addChild(sprite.container);
    }
    sprite.container.x = x * TILE_SIZE;
    sprite.container.y = y * TILE_SIZE;
    sprite.container.zIndex = y;
  }

  removeEntity(eid: number): void {
    const sprite = this.sprites.get(eid);
    if (sprite) {
      this.container.removeChild(sprite.container);
      sprite.container.destroy();
      this.sprites.delete(eid);
    }
  }

  clear(): void {
    for (const [eid, sprite] of this.sprites) {
      this.container.removeChild(sprite.container);
      sprite.container.destroy();
    }
    this.sprites.clear();
  }

  getEntityAtScreen(screenX: number, screenY: number, worldX: number, worldY: number): number | null {
    let closest: number | null = null;
    let closestDist = Infinity;

    for (const [eid, sprite] of this.sprites) {
      if (eid === this.localPlayerEid) continue;
      const ex = sprite.container.x / TILE_SIZE;
      const ey = sprite.container.y / TILE_SIZE;
      const dx = worldX - ex;
      const dy = worldY - ey;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1.5 && dist < closestDist) {
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
    const color = isLocal ? 0x00ff88 : (ENTITY_COLORS[type] ?? 0xffffff);

    const body = new Graphics();
    body.circle(0, 0, TILE_SIZE * 0.35);
    body.fill(color);
    body.setStrokeStyle({ width: 2, color: 0x000000, alpha: 0.3 });
    body.stroke();
    cont.addChild(body);

    const name = data?.name ?? (isLocal ? "You" : `Entity ${eid}`);
    const nameText = new Text({ text: name, style: this.nameStyle });
    nameText.anchor.set(0.5, 1);
    nameText.y = -TILE_SIZE * 0.4;
    cont.addChild(nameText);

    const sprite: EntitySprite = { container: cont, body, nameText };

    // Add HP bar for mobs and other players
    if (type === EntityType.MOB || (!isLocal && type === EntityType.PLAYER)) {
      const hpBg = new Graphics();
      hpBg.rect(-12, -20, 24, 3);
      hpBg.fill(0x333333);
      cont.addChild(hpBg);

      const hpBar = new Graphics();
      hpBar.rect(-12, -20, 24, 3);
      hpBar.fill(0x2ecc71);
      cont.addChild(hpBar);

      sprite.hpBg = hpBg;
      sprite.hpBar = hpBar;
    }

    return sprite;
  }
}
