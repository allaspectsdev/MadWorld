import { Op, EntityType, TILE_SIZE, type ServerMessage } from "@madworld/shared";
import { useGameStore, type RemoteEntity } from "../state/GameStore.js";
import type { HitSplatRenderer } from "../renderer/HitSplatRenderer.js";
import type { EntityRenderer } from "../renderer/EntityRenderer.js";
import type { ParticleSystem } from "../renderer/ParticleSystem.js";
import type { ScreenEffects } from "../renderer/ScreenEffects.js";
import type { TelegraphRenderer } from "../renderer/TelegraphRenderer.js";
import type { Minimap } from "../renderer/Minimap.js";
import type { AudioManager } from "../audio/AudioManager.js";
import type { Camera } from "../renderer/Camera.js";
import { isBossMob } from "../renderer/MobSpriteDefinitions.js";

export class Dispatcher {
  private hitSplats: HitSplatRenderer;
  private entityRenderer: EntityRenderer;
  private particles: ParticleSystem;
  private screenEffects: ScreenEffects;
  private telegraphs: TelegraphRenderer;
  private minimap: Minimap;
  private audio: AudioManager;
  private camera: Camera;
  private onZoneChange: (() => void) | null = null;
  private onEntityDeath: ((eid: number) => void) | null = null;

  constructor(
    hitSplats: HitSplatRenderer,
    entityRenderer: EntityRenderer,
    particles: ParticleSystem,
    screenEffects: ScreenEffects,
    telegraphs: TelegraphRenderer,
    minimap: Minimap,
    audio: AudioManager,
    camera: Camera,
  ) {
    this.hitSplats = hitSplats;
    this.entityRenderer = entityRenderer;
    this.particles = particles;
    this.screenEffects = screenEffects;
    this.telegraphs = telegraphs;
    this.minimap = minimap;
    this.audio = audio;
    this.camera = camera;
  }

  setOnZoneChange(fn: () => void): void {
    this.onZoneChange = fn;
  }

  setOnEntityDeath(fn: (eid: number) => void): void {
    this.onEntityDeath = fn;
  }

  handle(msg: ServerMessage): void {
    const store = useGameStore.getState();

    switch (msg.op) {
      case Op.S_AUTH_OK: {
        const lp = store.localPlayer;
        if (!lp) {
          store.setLocalPlayer({
            eid: msg.d.eid,
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
        } else {
          // Reconnect: update EID in case it changed
          store.updateLocalPlayer({ eid: msg.d.eid });
        }
        break;
      }

      case Op.S_ENTER_ZONE: {
        this.screenEffects.fadeZoneTransition();
        store.setZone(msg.d.zoneId, msg.d.name, msg.d.width, msg.d.height, msg.d.tiles, msg.d.lights);
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

        this.audio.playSfx("portal_enter");
        this.onZoneChange?.();
        break;
      }

      case Op.S_ENTITY_SPAWN: {
        const lp = store.localPlayer;
        if (lp && msg.d.eid === lp.eid) {
          // Update local player name from server if we have it
          if (msg.d.name) store.updateLocalPlayer({ name: msg.d.name });
          break;
        }

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
          // Only correct if server position diverges significantly from prediction
          // This prevents stutter from minor prediction/server drift
          const dx = msg.d.x - lp.x;
          const dy = msg.d.y - lp.y;
          const drift = Math.sqrt(dx * dx + dy * dy);
          if (drift > 1.5) {
            // Large drift: snap to server position (rejection or desync)
            store.updateLocalPlayer({ x: msg.d.x, y: msg.d.y });
          } else if (drift > 0.3) {
            // Moderate drift: blend toward server position
            store.updateLocalPlayer({
              x: lp.x + dx * 0.3,
              y: lp.y + dy * 0.3,
            });
          }
          // Small drift (<0.3 tiles): trust client prediction, don't correct
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
          // Flash HP bar on damage
          this.flashHpBar();
        } else {
          break;
        }

        this.hitSplats.addSplat(tx, ty, msg.d.amount, msg.d.isCrit);
        this.entityRenderer.triggerHitFlash(msg.d.targetEid);

        // Audio
        if (msg.d.amount > 0) {
          this.audio.playSfx(msg.d.isCrit ? "hit_crit" : "hit_melee");
        } else {
          this.audio.playSfx("miss");
        }

        // Combat impact particles
        if (msg.d.amount > 0) {
          // Directional impact particles
          const sourceEntity = store.entities.get(msg.d.sourceEid);
          const dx = sourceEntity ? tx - sourceEntity.nextX : 0;
          const dy = sourceEntity ? ty - sourceEntity.nextY : 0;
          this.particles.emit(tx * TILE_SIZE, ty * TILE_SIZE, 8, {
            tint: msg.d.isCrit ? 0xff4444 : 0xffaa44,
            speed: 80,
            spread: Math.PI * 0.6,
            life: 0.4,
            gravity: 100,
            dirX: dx || 0,
            dirY: dy || -1,
            baseScale: 0.8,
          });
          // Extra star burst on critical hits
          if (msg.d.isCrit) {
            this.particles.emit(tx * TILE_SIZE, ty * TILE_SIZE, 12, {
              texType: "star",
              tint: 0xff2222,
              speed: 100,
              spread: Math.PI * 2,
              life: 0.6,
              gravity: 50,
              baseScale: 1.2,
            });
          }

          // Attack animation on source
          this.entityRenderer.triggerAttackAnim(msg.d.sourceEid);

          // Screen flash if local player is the target
          if (lp && msg.d.targetEid === lp.eid) {
            this.screenEffects.flashDamage();
            this.camera.shake(msg.d.isCrit ? 6 : 3, msg.d.isCrit ? 0.25 : 0.15);
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
          this.audio.playSfx("player_death");
        } else {
          this.audio.playSfx("mob_death");
        }
        // Death particles + animation
        const deadEntity = store.entities.get(msg.d.eid);
        if (deadEntity) {
          const isBoss = deadEntity.type === EntityType.MOB && isBossMob(deadEntity.name ?? "");
          const bx = deadEntity.nextX * TILE_SIZE;
          const by = deadEntity.nextY * TILE_SIZE;

          if (isBoss) {
            // Boss death: 3-wave particle explosion
            this.particles.emit(bx, by, 20, {
              texType: "star",
              tint: 0xffffff,
              speed: 80,
              spread: Math.PI * 2,
              life: 0.8,
              gravity: 0,
              baseScale: 1.5,
              scaleDecay: 2,
            });
            setTimeout(() => {
              const color = (deadEntity.name ?? "").includes("Lich") ? 0x8800ff : 0xffaa00;
              this.particles.emit(bx, by, 30, {
                texType: "glow",
                tint: color,
                speed: 60,
                spread: Math.PI * 2,
                life: 1.2,
                gravity: -10,
                baseScale: 1.2,
              });
            }, 100);
            setTimeout(() => {
              this.particles.emit(bx, by, 15, {
                texType: "star",
                tint: 0xffd700,
                speed: 20,
                spread: Math.PI * 2,
                life: 2.0,
                gravity: -8,
                baseScale: 0.6,
              });
            }, 250);
            this.camera.shake(8, 0.5);
            this.screenEffects.flash(0xffffff, 0.3);
          } else {
            this.particles.emit(bx, by, 12, {
              tint: 0xffffff,
              speed: 40,
              spread: Math.PI * 2,
              life: 0.5,
              scaleDecay: 1.5,
            });
          }

          this.entityRenderer.triggerDeathAnim(msg.d.eid);
          this.camera.shake(isBoss ? 8 : 4, isBoss ? 0.5 : 0.2);
        }
        // Notify game that entity died (for clearing target)
        this.onEntityDeath?.(msg.d.eid);
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
          // Respawn visual effects
          this.screenEffects.flash(0xffffff, 0.4);
          this.particles.emit(msg.d.x * TILE_SIZE, msg.d.y * TILE_SIZE, 25, {
            texType: "star",
            tint: 0x44ff88,
            speed: 40,
            spread: Math.PI * 2,
            life: 1.2,
            gravity: -20,
            baseScale: 1.0,
            scaleDecay: 1.0,
          });
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
        this.audio.playSfx("level_up");
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

      // --- NPC / Quest Messages ---
      case Op.S_NPC_DIALOG: {
        store.setNpcDialog(msg.d);
        break;
      }

      case Op.S_QUEST_UPDATE: {
        store.updateQuest(msg.d.questId, msg.d.stepIndex, msg.d.progress);
        break;
      }

      case Op.S_QUEST_COMPLETE: {
        store.completeQuest(msg.d.questId);
        this.showSystemMessage("Quest complete!");
        this.audio.playSfx("level_up");
        break;
      }

      case Op.S_QUEST_LIST: {
        store.setQuests(msg.d.active);
        store.setCompletedQuests(msg.d.completed);
        break;
      }

      // --- Inventory / Equipment ---
      case Op.S_INV_UPDATE: {
        store.setInventory(msg.d.slots);
        this.audio.playSfx("item_pickup");
        break;
      }

      case Op.S_EQUIP_UPDATE: {
        store.setEquipment(msg.d.slot, msg.d.itemId);
        break;
      }

      case Op.S_CHAT_MESSAGE: {
        store.addChatMessage(msg.d);
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
    const container = document.getElementById("system-messages");
    if (!container) return;
    const popup = document.createElement("div");
    popup.className = "system-msg";
    popup.textContent = message;
    container.appendChild(popup);
    // Fade in
    requestAnimationFrame(() => popup.classList.add("visible"));
    setTimeout(() => {
      popup.classList.remove("visible");
      setTimeout(() => popup.remove(), 500);
    }, 3000);
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

  private flashHpBar(): void {
    const container = document.querySelector(".bar-container") as HTMLElement;
    if (!container) return;
    container.classList.remove("damage-flash");
    // Force reflow so re-adding the class restarts the animation
    void container.offsetWidth;
    container.classList.add("damage-flash");
    setTimeout(() => container.classList.remove("damage-flash"), 300);
  }

  private xpPopupStack = 0;

  private showXpPopup(skillId: string, xp: number): void {
    const popup = document.createElement("div");
    popup.className = "xp-popup";
    popup.textContent = `+${xp} ${skillId} XP`;
    // Stack popups consistently on the right side
    popup.style.top = `${50 + this.xpPopupStack * 24}px`;
    this.xpPopupStack++;
    document.getElementById("ui-root")?.appendChild(popup);
    setTimeout(() => {
      popup.remove();
      this.xpPopupStack = Math.max(0, this.xpPopupStack - 1);
    }, 2000);
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
