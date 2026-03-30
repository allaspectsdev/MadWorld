import { Op, EntityType, TILE_SIZE, type ServerMessage, cartToIso, EMOTES } from "@madworld/shared";

/** Convert world-tile position to iso-pixel for particle effects. */
function toIso(wx: number, wy: number): { x: number; y: number } {
  return cartToIso(wx, wy);
}
import { useGameStore, type RemoteEntity } from "../state/GameStore.js";
import type { HitSplatRenderer } from "../renderer/HitSplatRenderer.js";
import type { EntityRenderer } from "../renderer/EntityRenderer.js";
import type { ParticleSystem } from "../renderer/ParticleSystem.js";
import type { ScreenEffects } from "../renderer/ScreenEffects.js";
import type { TelegraphRenderer } from "../renderer/TelegraphRenderer.js";
import type { Minimap } from "../renderer/Minimap.js";
import type { AudioManager } from "../audio/AudioManager.js";
import type { Camera } from "../renderer/Camera.js";
import type { ChatBubbleRenderer } from "../renderer/ChatBubbleRenderer.js";
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
  private chatBubbles: ChatBubbleRenderer;
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
    chatBubbles: ChatBubbleRenderer,
  ) {
    this.hitSplats = hitSplats;
    this.entityRenderer = entityRenderer;
    this.particles = particles;
    this.screenEffects = screenEffects;
    this.telegraphs = telegraphs;
    this.minimap = minimap;
    this.audio = audio;
    this.camera = camera;
    this.chatBubbles = chatBubbles;
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
            isGod: msg.d.isGod,
            appearance: msg.d.appearance,
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
          // Update local player data from server
          store.updateLocalPlayer({
            ...(msg.d.name ? { name: msg.d.name } : {}),
            ...(msg.d.appearance ? { appearance: msg.d.appearance } : {}),
          });
          // Refresh sprite so appearance/equipment/god visuals take effect
          if (msg.d.appearance) {
            this.entityRenderer.refreshLocalPlayer();
          }
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
          isGod: msg.d.isGod,
          equipment: msg.d.equipment,
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
          const hitIso = toIso(tx, ty);
          this.particles.emit(hitIso.x, hitIso.y, msg.d.isCrit ? 14 : 8, {
            texType: msg.d.isCrit ? "spark" : "circle",
            tint: msg.d.isCrit ? 0xffdd44 : 0xffaa44,
            speed: msg.d.isCrit ? 120 : 80,
            spread: Math.PI * 0.6,
            life: msg.d.isCrit ? 0.6 : 0.4,
            gravity: 100,
            dirX: dx || 0,
            dirY: dy || -1,
            baseScale: msg.d.isCrit ? 1.2 : 0.8,
            spin: msg.d.isCrit ? 8 : 0,
          });
          // Extra star burst on critical hits
          if (msg.d.isCrit) {
            this.particles.emit(hitIso.x, hitIso.y, 15, {
              texType: "star",
              tint: 0xffaa00,
              speed: 110,
              spread: Math.PI * 2,
              life: 0.7,
              gravity: 40,
              baseScale: 1.4,
              spin: 6,
              scaleDecay: 1.5,
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
          const deathIso = toIso(deadEntity.nextX, deadEntity.nextY);
          const bx = deathIso.x;
          const by = deathIso.y;

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

          // Delayed loot sparkle
          const sparkleX = bx, sparkleY = by;
          setTimeout(() => {
            this.particles.emit(sparkleX, sparkleY, 8, {
              texType: "diamond", tint: 0xffd700,
              speed: 20, spread: Math.PI * 2, life: 1.2,
              gravity: -12, baseScale: 0.8, spin: 3,
            });
          }, 400);

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
          const respIso = toIso(msg.d.x, msg.d.y);
          this.particles.emit(respIso.x, respIso.y, 25, {
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
        store.setSkillXp(msg.d.skillId, msg.d.totalXp);
        break;
      }

      case Op.S_LEVEL_UP: {
        this.showLevelUp(msg.d.skillId, msg.d.newLevel);
        this.screenEffects.flashLevelUp();
        this.audio.playSfx("level_up");
        // Level-up sparkles — multi-wave celebration
        const lpLvl = store.localPlayer;
        if (lpLvl) {
          const lvlIso = toIso(lpLvl.x, lpLvl.y);
          // Wave 1: burst of gold stars
          this.particles.emit(lvlIso.x, lvlIso.y, 25, {
            texType: "star",
            tint: 0xffd700,
            speed: 50,
            spread: Math.PI * 2,
            life: 1.5,
            gravity: -15,
            baseScale: 1.0,
            spin: 4,
          });
          // Wave 2: rising diamonds
          setTimeout(() => {
            this.particles.emit(lvlIso.x, lvlIso.y, 12, {
              texType: "diamond",
              tint: 0xffeeaa,
              speed: 25,
              spread: Math.PI * 2,
              life: 2.0,
              gravity: -20,
              baseScale: 0.8,
              spin: 3,
              scaleDecay: 0.8,
            });
          }, 150);
          // Wave 3: sparks fountain
          setTimeout(() => {
            this.particles.emit(lvlIso.x, lvlIso.y, 18, {
              texType: "spark",
              tint: 0xffffff,
              speed: 70,
              spread: Math.PI * 0.8,
              dirY: -1,
              life: 1.0,
              gravity: 60,
              baseScale: 0.6,
              spin: 10,
            });
          }, 300);
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
        // Show chat bubble above sender
        if (msg.d.senderEid && msg.d.channel !== "system") {
          const senderEntity = store.entities.get(msg.d.senderEid);
          this.chatBubbles.addBubble(msg.d.senderEid, msg.d.message, senderEntity?.type as EntityType | undefined);
        }
        break;
      }

      case Op.S_SYSTEM_MESSAGE: {
        this.showSystemMessage(msg.d.message);
        break;
      }

      case Op.S_EMOTE: {
        const emoteDef = EMOTES[msg.d.emoteId];
        if (!emoteDef) break;

        // Show emoji bubble above the emoting player
        this.chatBubbles.addBubble(msg.d.senderEid, emoteDef.bubbleText);

        // Spawn particles if this emote has them
        if (emoteDef.particles) {
          const entity = store.entities.get(msg.d.senderEid);
          const lp = store.localPlayer;
          let wx: number | undefined, wy: number | undefined;
          if (entity) {
            wx = entity.nextX; wy = entity.nextY;
          } else if (lp && msg.d.senderEid === lp.eid) {
            wx = lp.x; wy = lp.y;
          }
          if (wx !== undefined && wy !== undefined) {
            const iso = toIso(wx, wy);
            this.particles.emit(iso.x, iso.y, emoteDef.particles.count, {
              texType: emoteDef.particles.texType,
              tint: emoteDef.particles.tint,
              speed: emoteDef.particles.speed,
              spread: emoteDef.particles.spread,
              life: emoteDef.particles.life,
              gravity: emoteDef.particles.gravity,
              baseScale: emoteDef.particles.baseScale,
            });
          }
        }

        // Add action text to chat log
        store.addChatMessage({
          channel: "system",
          senderName: "",
          message: `* ${msg.d.senderName} ${emoteDef.actionText}`,
          timestamp: msg.d.timestamp,
        });
        break;
      }

      // --- Trade Messages ---
      case Op.S_TRADE_INCOMING: {
        store.setTradeIncoming({ requesterEid: msg.d.requesterEid, requesterName: msg.d.requesterName });
        break;
      }

      case Op.S_TRADE_START: {
        store.setTradeIncoming(null);
        store.setTradeSession({ partnerEid: msg.d.partnerEid, partnerName: msg.d.partnerName });
        break;
      }

      case Op.S_TRADE_UPDATE: {
        store.updateTradeSlots(msg.d.side, msg.d.slots, msg.d.confirmed);
        break;
      }

      case Op.S_TRADE_COMPLETE: {
        const items = msg.d.received.map((r: { itemId: string; quantity: number }) => `${r.quantity}x ${r.itemId}`).join(", ");
        this.showSystemMessage(items.length > 0 ? `Trade complete! Received: ${items}` : "Trade complete!");
        store.clearTrade();
        break;
      }

      case Op.S_TRADE_CANCELLED: {
        this.showSystemMessage(msg.d.reason);
        store.clearTrade();
        break;
      }

      case Op.S_ABILITY_LIST: {
        store.setAbilities(msg.d.abilities);
        break;
      }

      case Op.S_SKILL_COOLDOWN: {
        store.setAbilityCooldown(msg.d.abilityId, msg.d.remainingMs);
        // Ability cast particles
        const lpCast = store.localPlayer;
        if (lpCast) {
          const castIso = toIso(lpCast.x, lpCast.y);
          const px = castIso.x;
          const py = castIso.y;
          const ABILITY_VFX: Record<string, { tint: number; texType: "circle" | "glow" | "star" | "trail"; count: number; speed: number; spread: number; life: number; gravity: number }> = {
            power_strike: { tint: 0xff6644, texType: "star", count: 10, speed: 60, spread: Math.PI, life: 0.4, gravity: 40 },
            shield_bash: { tint: 0xffdd44, texType: "circle", count: 8, speed: 40, spread: Math.PI * 0.8, life: 0.3, gravity: 40 },
            heal: { tint: 0x44ff88, texType: "glow", count: 15, speed: 30, spread: Math.PI * 2, life: 0.8, gravity: -30 },
            sprint: { tint: 0x44aaff, texType: "trail", count: 8, speed: 50, spread: Math.PI * 0.5, life: 0.3, gravity: 40 },
            poison_strike: { tint: 0x44ff44, texType: "circle", count: 10, speed: 50, spread: Math.PI, life: 0.5, gravity: 40 },
            war_cry: { tint: 0xffaa00, texType: "star", count: 20, speed: 80, spread: Math.PI * 2, life: 0.6, gravity: 0 },
            dodge_roll: { tint: 0xccccff, texType: "trail", count: 6, speed: 70, spread: Math.PI * 0.4, life: 0.25, gravity: 40 },
          };
          const vfx = ABILITY_VFX[msg.d.abilityId];
          if (vfx) {
            this.particles.emit(px, py, vfx.count, {
              texType: vfx.texType, tint: vfx.tint, speed: vfx.speed,
              spread: vfx.spread, life: vfx.life, gravity: vfx.gravity,
              dirY: -1, baseScale: 1.0,
            });
          }
        }
        break;
      }

      case Op.S_STATUS_EFFECT: {
        const targetEntity = store.entities.get(msg.d.targetEid);
        const lp = store.localPlayer;
        if (msg.d.action === "apply") {
          const STATUS_COLORS: Record<string, number> = {
            stun: 0xffff00, poison: 0x44ff44, speed_boost: 0x44aaff,
            damage_boost: 0xffaa00, invulnerable: 0xffffff,
          };
          const color = STATUS_COLORS[msg.d.effectId] ?? 0xffffff;
          const tx = targetEntity?.nextX ?? lp?.x ?? 0;
          const ty = targetEntity?.nextY ?? lp?.y ?? 0;
          const statusIso = toIso(tx, ty);
          this.particles.emit(statusIso.x, statusIso.y, 8, {
            texType: "glow",
            tint: color,
            speed: 30,
            spread: Math.PI * 2,
            life: 0.8,
            gravity: -15,
            baseScale: 0.6,
          });
          this.entityRenderer.applyStatusTint(msg.d.targetEid, color, (msg.d.durationMs ?? 5000) / 1000);
        } else if (msg.d.action === "remove") {
          this.entityRenderer.removeStatusTint(msg.d.targetEid);
        } else if (msg.d.action === "tick") {
          const tx = targetEntity?.nextX ?? lp?.x ?? 0;
          const ty = targetEntity?.nextY ?? lp?.y ?? 0;
          if (msg.d.effectId === "poison") {
            const tickIso = toIso(tx, ty);
            this.particles.emit(tickIso.x, tickIso.y, 3, {
              tint: 0x44ff44, speed: 15, spread: Math.PI, life: 0.4, gravity: 10, baseScale: 0.4,
            });
          }
        }
        break;
      }

      case Op.S_SHOP_OPEN: {
        store.setShopData(msg.d);
        break;
      }

      case Op.S_FISH_BITE: {
        this.audio.playSfx("chat_blip");
        this.showSystemMessage("Fish on the line! Reel in!");
        break;
      }

      case Op.S_FISH_RESULT: {
        if (msg.d.success) {
          this.showSystemMessage(`Caught a fish! (+${msg.d.xp ?? 0} fishing XP)`);
        } else {
          this.showSystemMessage("The fish got away...");
        }
        break;
      }

      // ---- Procedural world / chunk streaming ----

      case Op.S_CHUNK_DATA: {
        store.addChunkData(
          msg.d.chunkX,
          msg.d.chunkY,
          msg.d.biome,
          msg.d.tiles,
          msg.d.lights,
        );
        break;
      }

      case Op.S_CHUNK_UNLOAD: {
        store.removeChunkData(msg.d.chunkX, msg.d.chunkY);
        break;
      }

      case Op.S_DISCOVERY_INIT: {
        store.setDiscoveredChunks(msg.d.chunks);
        break;
      }

      case Op.S_DISCOVERY_UPDATE: {
        store.addDiscoveredChunks(msg.d.chunks);
        if (msg.d.xp && msg.d.xp > 0) {
          this.showSystemMessage(`Explored new territory! +${msg.d.xp} XP`);
        }
        break;
      }

      case Op.S_WEATHER_UPDATE: {
        // Store weather state for rendering systems to read
        store.setWeather(msg.d.weather, msg.d.intensity, msg.d.durationTicks, msg.d.ambientTint);
        if (msg.d.weather !== "clear" && msg.d.intensity > 0.3) {
          const names: Record<string, string> = {
            rain: "Rain", heavy_rain: "Heavy Rain", snow: "Snow",
            blizzard: "Blizzard", sandstorm: "Sandstorm",
            fog: "Fog", thunderstorm: "Thunderstorm",
          };
          this.showSystemMessage(names[msg.d.weather] ?? msg.d.weather);
        }
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
