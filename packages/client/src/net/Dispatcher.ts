import { Op, EntityType, TILE_SIZE, type ServerMessage } from "@madworld/shared";
import { useGameStore, type RemoteEntity } from "../state/GameStore.js";
import type { HitSplatRenderer } from "../renderer/HitSplatRenderer.js";
import type { EntityRenderer } from "../renderer/EntityRenderer.js";
import type { ParticleSystem } from "../renderer/ParticleSystem.js";
import type { ScreenEffects } from "../renderer/ScreenEffects.js";
import type { TelegraphRenderer } from "../renderer/TelegraphRenderer.js";
import type { Minimap } from "../renderer/Minimap.js";

export class Dispatcher {
  private hitSplats: HitSplatRenderer;
  private entityRenderer: EntityRenderer;
  private particles: ParticleSystem;
  private screenEffects: ScreenEffects;
  private telegraphs: TelegraphRenderer;
  private minimap: Minimap;
  private onZoneChange: (() => void) | null = null;

  constructor(
    hitSplats: HitSplatRenderer,
    entityRenderer: EntityRenderer,
    particles: ParticleSystem,
    screenEffects: ScreenEffects,
    telegraphs: TelegraphRenderer,
    minimap: Minimap,
  ) {
    this.hitSplats = hitSplats;
    this.entityRenderer = entityRenderer;
    this.particles = particles;
    this.screenEffects = screenEffects;
    this.telegraphs = telegraphs;
    this.minimap = minimap;
  }

  setOnZoneChange(fn: () => void): void {
    this.onZoneChange = fn;
  }

  handle(msg: ServerMessage): void {
    const store = useGameStore.getState();

    switch (msg.op) {
      case Op.S_AUTH_OK: {
        const lp = store.localPlayer;
        if (!lp) {
          store.setLocalPlayer({
            eid: 0,
            playerId: msg.d.playerId,
            name: "",
            x: 0,
            y: 0,
            hp: 100,
            maxHp: 100,
            level: 1,
            zoneId: "",
            zoneName: "",
            isDead: false,
          });
        }
        break;
      }

      case Op.S_ENTER_ZONE: {
        this.screenEffects.fadeZoneTransition();
        store.setZone(msg.d.zoneId, msg.d.name, msg.d.width, msg.d.height, msg.d.tiles);
        store.updateLocalPlayer({
          zoneId: msg.d.zoneId,
          zoneName: msg.d.name,
          x: msg.d.spawnX,
          y: msg.d.spawnY,
        });

        // Show zone name
        const zoneNameEl = document.getElementById("zone-name");
        if (zoneNameEl) {
          zoneNameEl.textContent = msg.d.name;
          zoneNameEl.classList.add("visible");
          setTimeout(() => zoneNameEl.classList.remove("visible"), 3000);
        }

        this.onZoneChange?.();
        break;
      }

      case Op.S_ENTITY_SPAWN: {
        const lp = store.localPlayer;
        if (lp && msg.d.eid === lp.eid) break; // Skip self

        const now = performance.now();
        const entity: RemoteEntity = {
          eid: msg.d.eid,
          type: msg.d.type as EntityType,
          x: msg.d.x,
          y: msg.d.y,
          name: msg.d.name,
          appearance: msg.d.appearance,
          hp: msg.d.hp,
          maxHp: msg.d.maxHp,
          level: msg.d.level,
          prevX: msg.d.x,
          prevY: msg.d.y,
          prevTime: now,
          nextX: msg.d.x,
          nextY: msg.d.y,
          nextTime: now,
        };
        store.spawnEntity(entity);
        break;
      }

      case Op.S_ENTITY_DESPAWN: {
        store.despawnEntity(msg.d.eid);
        break;
      }

      case Op.S_ENTITY_MOVE: {
        const lp = store.localPlayer;

        // If this is the local player's movement ack
        if (lp && msg.d.eid === lp.eid && msg.d.seq !== undefined) {
          // Server reconciliation: update to server position
          store.updateLocalPlayer({ x: msg.d.x, y: msg.d.y });
          break;
        }

        // Remote entity
        store.updateEntityPosition(msg.d.eid, msg.d.x, msg.d.y);
        break;
      }

      case Op.S_PLAYER_STATS: {
        store.updateLocalPlayer({
          hp: msg.d.hp,
          maxHp: msg.d.maxHp,
          level: msg.d.level,
        });
        this.updateHUD();
        break;
      }

      case Op.S_DAMAGE: {
        // Find target position for hit splat
        const target = store.entities.get(msg.d.targetEid);
        const lp = store.localPlayer;
        let tx: number, ty: number;

        if (target) {
          tx = target.nextX;
          ty = target.nextY;
          // Update target HP
          store.spawnEntity({ ...target, hp: msg.d.targetHpAfter });
        } else if (lp && msg.d.targetEid === lp.eid) {
          tx = lp.x;
          ty = lp.y;
          store.updateLocalPlayer({ hp: msg.d.targetHpAfter });
          this.updateHUD();
        } else {
          break;
        }

        this.hitSplats.addSplat(tx, ty, msg.d.amount, msg.d.isCrit);

        // Combat impact particles
        if (msg.d.amount > 0) {
          this.particles.emit(tx * TILE_SIZE, ty * TILE_SIZE, 6, {
            tint: msg.d.isCrit ? 0xff4444 : 0xffaa44,
            speed: 60,
            spread: Math.PI,
            life: 0.3,
            gravity: 80,
          });

          // Attack animation on source
          this.entityRenderer.triggerAttackAnim(msg.d.sourceEid);

          // Screen flash if local player is the target
          if (lp && msg.d.targetEid === lp.eid) {
            this.screenEffects.flashDamage();
          }
        }
        break;
      }

      case Op.S_DEATH: {
        const lp = store.localPlayer;
        if (lp && msg.d.eid === lp.eid) {
          store.updateLocalPlayer({ isDead: true });
          const overlay = document.getElementById("death-overlay");
          if (overlay) overlay.classList.add("active");
        }
        // Death particles + animation
        const deadEntity = store.entities.get(msg.d.eid);
        if (deadEntity) {
          this.particles.emit(deadEntity.nextX * TILE_SIZE, deadEntity.nextY * TILE_SIZE, 12, {
            tint: 0xffffff,
            speed: 40,
            spread: Math.PI * 2,
            life: 0.5,
            scaleDecay: 1.5,
          });
          this.entityRenderer.triggerDeathAnim(msg.d.eid);
        }
        // Remove dead entity sprite after animation
        setTimeout(() => store.despawnEntity(msg.d.eid), 300);
        break;
      }

      case Op.S_RESPAWN: {
        const lp = store.localPlayer;
        if (lp && msg.d.eid === lp.eid) {
          store.updateLocalPlayer({
            x: msg.d.x,
            y: msg.d.y,
            hp: msg.d.hp,
            isDead: false,
          });
          const overlay = document.getElementById("death-overlay");
          if (overlay) overlay.classList.remove("active");
          this.updateHUD();
        }
        break;
      }

      case Op.S_XP_GAIN: {
        this.showXpPopup(msg.d.skillId, msg.d.xp);
        break;
      }

      case Op.S_LEVEL_UP: {
        this.showLevelUp(msg.d.skillId, msg.d.newLevel);
        this.screenEffects.flashLevelUp();
        // Level-up sparkles
        const lpLvl = store.localPlayer;
        if (lpLvl) {
          this.particles.emit(lpLvl.x * TILE_SIZE, lpLvl.y * TILE_SIZE, 20, {
            texType: "star",
            tint: 0xffd700,
            speed: 30,
            spread: Math.PI * 2,
            life: 1.5,
            gravity: -15,
            baseScale: 0.8,
          });
        }
        break;
      }

      // --- Party Messages ---
      case Op.S_PARTY_INVITE: {
        store.setPartyInvite({
          inviterEid: msg.d.inviterEid,
          inviterName: msg.d.inviterName,
          partySize: msg.d.partySize,
        });
        break;
      }

      case Op.S_PARTY_UPDATE: {
        store.setParty({
          partyId: msg.d.partyId,
          members: msg.d.members,
          leadEid: msg.d.leadEid,
        });
        break;
      }

      case Op.S_PARTY_DISSOLVED: {
        store.setParty(null);
        this.showSystemMessage("Party dissolved.");
        break;
      }

      case Op.S_PARTY_MEMBER_HP: {
        store.updatePartyMemberHp(msg.d.eid, msg.d.hp, msg.d.maxHp);
        break;
      }

      // --- Dungeon Messages ---
      case Op.S_DUNGEON_ENTER: {
        store.setInDungeon(true, msg.d.dungeonName);
        break;
      }

      case Op.S_DUNGEON_COMPLETE: {
        const banner = document.getElementById("dungeon-complete-banner");
        if (banner) {
          banner.style.display = "flex";
          setTimeout(() => { banner.style.display = "none"; }, 5000);
        }
        break;
      }

      case Op.S_DUNGEON_WIPE: {
        const wipeOverlay = document.getElementById("dungeon-wipe-overlay");
        if (wipeOverlay) {
          wipeOverlay.classList.add("active");
          setTimeout(() => wipeOverlay.classList.remove("active"), 4000);
        }
        break;
      }

      case Op.S_DUNGEON_EXIT: {
        store.setInDungeon(false);
        break;
      }

      case Op.S_BOSS_ABILITY: {
        if (msg.d.radius > 0) {
          this.telegraphs.addTelegraph(
            msg.d.targetX,
            msg.d.targetY,
            msg.d.radius,
            1000,
            msg.d.abilityId.includes("soul") ? 0x8800ff : 0xff0000,
          );
        }
        break;
      }

      case Op.S_SYSTEM_MESSAGE: {
        this.showSystemMessage(msg.d.message);
        break;
      }

      case Op.S_TICK: {
        break;
      }

      case Op.S_PONG: {
        break;
      }
    }
  }

  private showSystemMessage(message: string): void {
    const popup = document.createElement("div");
    popup.className = "xp-popup";
    popup.style.color = "#fff";
    popup.textContent = message;
    popup.style.top = "80px";
    document.getElementById("ui-root")?.appendChild(popup);
    setTimeout(() => popup.remove(), 3000);
  }

  private updateHUD(): void {
    const lp = useGameStore.getState().localPlayer;
    if (!lp) return;

    const hpBar = document.getElementById("hp-bar");
    const hpText = document.getElementById("hp-text");
    if (hpBar) {
      hpBar.style.width = `${(lp.hp / lp.maxHp) * 100}%`;
    }
    if (hpText) {
      hpText.textContent = `${Math.max(0, lp.hp)} / ${lp.maxHp}`;
    }
  }

  private showXpPopup(skillId: string, xp: number): void {
    const popup = document.createElement("div");
    popup.className = "xp-popup";
    popup.textContent = `+${xp} ${skillId} XP`;
    popup.style.top = `${50 + Math.random() * 100}px`;
    document.getElementById("ui-root")?.appendChild(popup);
    setTimeout(() => popup.remove(), 2000);
  }

  private showLevelUp(skillId: string, newLevel: number): void {
    const popup = document.createElement("div");
    popup.className = "xp-popup";
    popup.style.color = "#ffd700";
    popup.style.fontSize = "18px";
    popup.textContent = `Level up! ${skillId} is now level ${newLevel}!`;
    popup.style.top = "40px";
    document.getElementById("ui-root")?.appendChild(popup);
    setTimeout(() => popup.remove(), 3000);
  }
}
