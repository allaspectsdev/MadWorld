import { Op, EntityType, type ServerMessage, EMOTES, xpForLevel, levelForXp } from "@madworld/shared";
import { useGameStore, type RemoteEntity } from "../state/GameStore.js";
import type { EntityRenderer3D } from "./EntityRenderer3D.js";
import type { ParticleSystem3D } from "./ParticleSystem3D.js";
import type { PostProcessing } from "./PostProcessing.js";
import type { TelegraphRenderer3D } from "./TelegraphRenderer3D.js";
import type { Minimap } from "../renderer/Minimap.js";
import type { AudioManager } from "../audio/AudioManager.js";
import type { Camera3D } from "./Camera3D.js";
import type { AchievementTracker } from "../ui/components/AchievementTracker.js";
import { isBossMob } from "./SpriteBakery.js";
import { createHitSplat, createChatBubble, type HitSplatOverlay, type ChatBubbleOverlay } from "./EntityOverlays.js";

/**
 * Server message dispatcher for the Three.js renderer.
 * Replaces the PixiJS Dispatcher — uses world coordinates directly
 * (no toIso() conversion), and wires to 3D renderer systems.
 */
export class Dispatcher3D {
  private entities: EntityRenderer3D;
  private particles: ParticleSystem3D;
  private postProcess: PostProcessing;
  private telegraphs: TelegraphRenderer3D;
  private minimap: Minimap;
  private audio: AudioManager;
  private camera: Camera3D;
  private achieve: AchievementTracker;
  private onZoneChange: (() => void) | null = null;
  private onEntityDeath: ((eid: number) => void) | null = null;

  // Active overlays
  private hitSplats: Array<{ overlay: HitSplatOverlay; eid: number }> = [];
  private chatBubbles: Array<{ overlay: ChatBubbleOverlay; eid: number }> = [];

  constructor(
    entities: EntityRenderer3D,
    particles: ParticleSystem3D,
    postProcess: PostProcessing,
    telegraphs: TelegraphRenderer3D,
    minimap: Minimap,
    audio: AudioManager,
    camera: Camera3D,
    achievements: AchievementTracker,
  ) {
    this.entities = entities;
    this.particles = particles;
    this.postProcess = postProcess;
    this.telegraphs = telegraphs;
    this.minimap = minimap;
    this.audio = audio;
    this.camera = camera;
    this.achieve = achievements;
  }

  setOnZoneChange(fn: () => void): void { this.onZoneChange = fn; }
  setOnEntityDeath(fn: (eid: number) => void): void { this.onEntityDeath = fn; }

  /** Update hit splats and chat bubbles each frame */
  updateOverlays(dt: number): void {
    // Hit splats
    for (let i = this.hitSplats.length - 1; i >= 0; i--) {
      const hs = this.hitSplats[i];
      if (!hs.overlay.update(dt)) {
        // Get entity group to remove from
        const pos = this.entities.getEntityPos(hs.eid);
        if (pos) {
          // Overlay auto-removes from CSS2D DOM
        }
        hs.overlay.dispose();
        this.hitSplats.splice(i, 1);
      }
    }

    // Chat bubbles
    for (let i = this.chatBubbles.length - 1; i >= 0; i--) {
      const cb = this.chatBubbles[i];
      if (!cb.overlay.update(dt)) {
        cb.overlay.dispose();
        this.chatBubbles.splice(i, 1);
      }
    }
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
            x: 0, y: 0,
            hp: 100, maxHp: 100,
            level: 1,
            zoneId: "", zoneName: "",
            isDead: false,
            isGod: msg.d.isGod,
            appearance: msg.d.appearance,
          });
        } else {
          store.updateLocalPlayer({ eid: msg.d.eid });
        }
        break;
      }

      case Op.S_ENTER_ZONE: {
        this.postProcess.fadeZoneTransition();
        store.setZone(msg.d.zoneId, msg.d.name, msg.d.width, msg.d.height, msg.d.tiles, msg.d.lights);
        store.updateLocalPlayer({
          zoneId: msg.d.zoneId,
          zoneName: msg.d.name,
          x: msg.d.spawnX,
          y: msg.d.spawnY,
        });
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
          store.updateLocalPlayer({
            ...(msg.d.name ? { name: msg.d.name } : {}),
            ...(msg.d.appearance ? { appearance: msg.d.appearance } : {}),
          });
          break;
        }
        const now = performance.now();
        const entity: RemoteEntity = {
          eid: msg.d.eid,
          type: msg.d.type as EntityType,
          x: msg.d.x, y: msg.d.y,
          name: msg.d.name,
          appearance: msg.d.appearance,
          hp: msg.d.hp, maxHp: msg.d.maxHp,
          level: msg.d.level,
          isGod: msg.d.isGod,
          equipment: msg.d.equipment,
          prevX: msg.d.x, prevY: msg.d.y, prevTime: now,
          nextX: msg.d.x, nextY: msg.d.y, nextTime: now,
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
        if (lp && msg.d.eid === lp.eid && msg.d.seq !== undefined) {
          const dx = msg.d.x - lp.x;
          const dy = msg.d.y - lp.y;
          const drift = Math.sqrt(dx * dx + dy * dy);
          if (drift > 1.5) {
            store.updateLocalPlayer({ x: msg.d.x, y: msg.d.y });
          } else if (drift > 0.3) {
            store.updateLocalPlayer({ x: lp.x + dx * 0.3, y: lp.y + dy * 0.3 });
          }
          break;
        }
        store.updateEntityPosition(msg.d.eid, msg.d.x, msg.d.y);
        break;
      }

      case Op.S_PLAYER_STATS: {
        store.updateLocalPlayer({ hp: msg.d.hp, maxHp: msg.d.maxHp, level: msg.d.level });
        this.updateHUD();
        break;
      }

      case Op.S_DAMAGE: {
        const target = store.entities.get(msg.d.targetEid);
        const lp = store.localPlayer;
        let tx: number, ty: number;

        if (target) {
          tx = target.nextX;
          ty = target.nextY;
          store.spawnEntity({ ...target, hp: msg.d.targetHpAfter });
        } else if (lp && msg.d.targetEid === lp.eid) {
          tx = lp.x;
          ty = lp.y;
          store.updateLocalPlayer({ hp: msg.d.targetHpAfter });
          this.updateHUD();
          this.flashHpBar();
        } else {
          break;
        }

        // Hit splat as CSS2D overlay
        const splatType = msg.d.amount <= 0 ? "miss" : msg.d.isCrit ? "crit" : "hit";
        const splat = createHitSplat(msg.d.amount, splatType);
        // Position at entity world coords
        splat.object.position.set(tx, 2.5, ty);
        // Add to scene (it's a CSS2DObject, will be rendered by labelRenderer)
        this.entities["app"].entityGroup.add(splat.object);
        this.hitSplats.push({ overlay: splat, eid: msg.d.targetEid });

        // Audio
        if (msg.d.amount > 0) {
          this.audio.playSfx(msg.d.isCrit ? "hit_crit" : "hit_melee");
        } else {
          this.audio.playSfx("miss");
        }

        // Combat particles (now in world coords, not iso)
        if (msg.d.amount > 0) {
          const sourceEntity = store.entities.get(msg.d.sourceEid);
          const dx = sourceEntity ? tx - sourceEntity.nextX : 0;
          const dy = sourceEntity ? ty - sourceEntity.nextY : 0;
          this.particles.emit(tx, 1, ty, msg.d.isCrit ? 14 : 8, {
            tint: msg.d.isCrit ? 0xffdd44 : 0xffaa44,
            speed: msg.d.isCrit ? 20 : 12,
            spread: Math.PI * 0.6,
            life: msg.d.isCrit ? 0.6 : 0.4,
            gravity: -15,
            dirX: dx || 0,
            dirZ: dy || 0,
            dirY: 1,
            baseScale: msg.d.isCrit ? 1.2 : 0.8,
            spin: msg.d.isCrit ? 8 : 0,
          });
          if (msg.d.isCrit) this.achieve.onCriticalHit();

          if (msg.d.isCrit) {
            this.particles.emit(tx, 1, ty, 15, {
              tint: 0xffaa00,
              speed: 18,
              spread: Math.PI * 2,
              life: 0.7,
              gravity: -5,
              baseScale: 1.4,
              spin: 6,
              scaleDecay: 1.5,
            });
          }

          this.entities.attackEntity(msg.d.sourceEid);

          if (lp && msg.d.targetEid === lp.eid) {
            this.postProcess.flashDamage();
            this.camera.shake(msg.d.isCrit ? 0.3 : 0.15, msg.d.isCrit ? 0.25 : 0.15);
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

        const deadEntity = store.entities.get(msg.d.eid);
        if (deadEntity) {
          const boss = deadEntity.type === EntityType.MOB && isBossMob(deadEntity.name ?? "");
          if (deadEntity.type === EntityType.MOB) this.achieve.onMobKill(deadEntity.name ?? "", boss);

          const wx = deadEntity.nextX;
          const wz = deadEntity.nextY;

          if (boss) {
            this.particles.emit(wx, 1, wz, 20, {
              tint: 0xffffff, speed: 15, spread: Math.PI * 2, life: 0.8, gravity: 0, baseScale: 1.5, scaleDecay: 2,
            });
            setTimeout(() => {
              const color = (deadEntity.name ?? "").includes("Lich") ? 0x8800ff : 0xffaa00;
              this.particles.emit(wx, 1, wz, 30, {
                tint: color, speed: 10, spread: Math.PI * 2, life: 1.2, gravity: -3, baseScale: 1.2,
              });
            }, 100);
            this.postProcess.flash(0xffffff, 0.3);
          } else {
            this.particles.emit(wx, 1, wz, 12, {
              tint: 0xffffff, speed: 8, spread: Math.PI * 2, life: 0.5, scaleDecay: 1.5,
            });
          }

          // Loot sparkle
          setTimeout(() => {
            this.particles.emit(wx, 0.5, wz, 8, {
              tint: 0xffd700, speed: 4, spread: Math.PI * 2, life: 1.2, gravity: -3, baseScale: 0.8, spin: 3,
            });
          }, 400);

          this.entities.killEntity(msg.d.eid);
          this.camera.shake(boss ? 0.4 : 0.2, boss ? 0.5 : 0.2);
        }
        this.onEntityDeath?.(msg.d.eid);
        setTimeout(() => store.despawnEntity(msg.d.eid), 300);
        break;
      }

      case Op.S_RESPAWN: {
        const lp = store.localPlayer;
        if (lp && msg.d.eid === lp.eid) {
          store.updateLocalPlayer({ x: msg.d.x, y: msg.d.y, hp: msg.d.hp, isDead: false });
          const overlay = document.getElementById("death-overlay");
          if (overlay) overlay.classList.remove("active");
          this.updateHUD();
          this.achieve.onRespawn();
          this.postProcess.flash(0xffffff, 0.4);
          this.particles.emit(msg.d.x, 1, msg.d.y, 25, {
            tint: 0x44ff88, speed: 8, spread: Math.PI * 2, life: 1.2, gravity: -5, baseScale: 1.0, scaleDecay: 1.0,
          });
        }
        break;
      }

      case Op.S_XP_GAIN: {
        this.showXpPopup(msg.d.skillId, msg.d.xp);
        store.setSkillXp(msg.d.skillId, msg.d.totalXp);
        this.updateXpBar(msg.d.skillId, msg.d.totalXp);
        break;
      }

      case Op.S_LEVEL_UP: {
        this.showLevelUp(msg.d.skillId, msg.d.newLevel);
        this.achieve.onLevelUp(msg.d.skillId, msg.d.newLevel);
        this.postProcess.flashLevelUp();
        this.audio.playSfx("level_up");
        const lpLvl = store.localPlayer;
        if (lpLvl) {
          this.particles.emit(lpLvl.x, 1, lpLvl.y, 25, {
            tint: 0xffd700, speed: 10, spread: Math.PI * 2, life: 1.5, gravity: -4, baseScale: 1.0, spin: 4,
          });
          setTimeout(() => {
            this.particles.emit(lpLvl.x, 1, lpLvl.y, 12, {
              tint: 0xffeeaa, speed: 5, spread: Math.PI * 2, life: 2.0, gravity: -5, baseScale: 0.8, spin: 3, scaleDecay: 0.8,
            });
          }, 150);
          setTimeout(() => {
            this.particles.emit(lpLvl.x, 1.5, lpLvl.y, 18, {
              tint: 0xffffff, speed: 12, spread: Math.PI * 0.8, dirY: 1, life: 1.0, gravity: -15, baseScale: 0.6, spin: 10,
            });
          }, 300);
        }
        break;
      }

      case Op.S_PARTY_INVITE: { store.setPartyInvite({ inviterEid: msg.d.inviterEid, inviterName: msg.d.inviterName, partySize: msg.d.partySize }); break; }
      case Op.S_PARTY_UPDATE: {
        store.setParty({ partyId: msg.d.partyId, members: msg.d.members, leadEid: msg.d.leadEid });
        if (msg.d.members.length > 1) this.achieve.onPartyJoin();
        break;
      }
      case Op.S_PARTY_DISSOLVED: { store.setParty(null); this.showSystemMessage("Party dissolved."); break; }
      case Op.S_PARTY_MEMBER_HP: { store.updatePartyMemberHp(msg.d.eid, msg.d.hp, msg.d.maxHp); break; }
      case Op.S_DUNGEON_ENTER: { store.setInDungeon(true, msg.d.dungeonName); this.achieve.onEnterDungeon(); break; }
      case Op.S_DUNGEON_COMPLETE: {
        const banner = document.getElementById("dungeon-complete-banner");
        if (banner) { banner.style.display = "flex"; setTimeout(() => { banner.style.display = "none"; }, 5000); }
        break;
      }
      case Op.S_DUNGEON_WIPE: {
        const wipeOverlay = document.getElementById("dungeon-wipe-overlay");
        if (wipeOverlay) { wipeOverlay.classList.add("active"); setTimeout(() => wipeOverlay.classList.remove("active"), 4000); }
        break;
      }
      case Op.S_DUNGEON_EXIT: { store.setInDungeon(false); break; }

      case Op.S_BOSS_ABILITY: {
        if (msg.d.radius > 0) {
          this.telegraphs.add(
            msg.d.targetX,
            msg.d.targetY, // game Y -> Three.js Z
            msg.d.radius / 32, // convert from pixel radius to world units
            1.0, // 1 second duration
            msg.d.abilityId.includes("soul") ? 0x8800ff : 0xff0000,
          );
        }
        break;
      }

      case Op.S_NPC_DIALOG: { store.setNpcDialog(msg.d); break; }
      case Op.S_QUEST_UPDATE: { store.updateQuest(msg.d.questId, msg.d.stepIndex, msg.d.progress); break; }
      case Op.S_QUEST_COMPLETE: { store.completeQuest(msg.d.questId); this.showSystemMessage("Quest complete!"); this.audio.playSfx("level_up"); break; }
      case Op.S_QUEST_LIST: { store.setQuests(msg.d.active); store.setCompletedQuests(msg.d.completed); break; }

      case Op.S_INV_UPDATE: {
        const oldSlots = store.inventory;
        store.setInventory(msg.d.slots);
        this.audio.playSfx("item_pickup");
        const lpInv = store.localPlayer;
        if (lpInv) {
          this.particles.emit(lpInv.x, 1.5, lpInv.y, 6, {
            tint: 0xffd700, speed: 5, spread: Math.PI * 2, life: 0.8, gravity: -5, baseScale: 0.6, spin: 3, scaleDecay: 1.0,
          });
          for (const slot of msg.d.slots) {
            if (!slot || !slot.itemId) continue;
            const oldSlot = oldSlots.find((s: any) => s?.index === slot.index);
            if (!oldSlot || oldSlot.itemId !== slot.itemId || (oldSlot.quantity ?? 1) < (slot.quantity ?? 1)) {
              const itemName = slot.itemId.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
              const qty = slot.quantity && slot.quantity > 1 ? `+${slot.quantity - (oldSlot?.quantity ?? 0)}` : "+1";
              this.showItemPickup(`${qty} ${itemName}`);
              break;
            }
          }
        }
        break;
      }

      case Op.S_EQUIP_UPDATE: { store.setEquipment(msg.d.slot, msg.d.itemId); if (msg.d.itemId) this.achieve.onEquip(); break; }

      case Op.S_CHAT_MESSAGE: {
        store.addChatMessage(msg.d);
        if (msg.d.senderEid && msg.d.channel !== "system") {
          const senderEntity = store.entities.get(msg.d.senderEid);
          const type = senderEntity?.type === EntityType.NPC ? "npc" : "player";
          const bubble = createChatBubble(msg.d.message, type);
          const pos = this.entities.getEntityPos(msg.d.senderEid);
          if (pos) {
            bubble.object.position.set(pos.x, 3, pos.y);
            this.entities["app"].entityGroup.add(bubble.object);
            this.chatBubbles.push({ overlay: bubble, eid: msg.d.senderEid });
          }
        }
        break;
      }

      case Op.S_SYSTEM_MESSAGE: { this.showSystemMessage(msg.d.message); break; }

      case Op.S_EMOTE: {
        const emoteDef = EMOTES[msg.d.emoteId];
        if (!emoteDef) break;
        // Show bubble
        const bubble = createChatBubble(emoteDef.bubbleText, "player");
        const pos = this.entities.getEntityPos(msg.d.senderEid);
        const lp = store.localPlayer;
        let wx: number | undefined, wz: number | undefined;
        if (pos) { wx = pos.x; wz = pos.y; }
        else if (lp && msg.d.senderEid === lp.eid) { wx = lp.x; wz = lp.y; }
        if (wx !== undefined && wz !== undefined) {
          bubble.object.position.set(wx, 3, wz);
          this.entities["app"].entityGroup.add(bubble.object);
          this.chatBubbles.push({ overlay: bubble, eid: msg.d.senderEid });
          if (emoteDef.particles) {
            this.particles.emit(wx, 1, wz, emoteDef.particles.count, {
              tint: emoteDef.particles.tint,
              speed: emoteDef.particles.speed / 8,
              spread: emoteDef.particles.spread,
              life: emoteDef.particles.life,
              gravity: emoteDef.particles.gravity / 8,
              baseScale: emoteDef.particles.baseScale,
            });
          }
        }
        store.addChatMessage({ channel: "system", senderName: "", message: `* ${msg.d.senderName} ${emoteDef.actionText}`, timestamp: msg.d.timestamp });
        break;
      }

      case Op.S_TRADE_INCOMING: { store.setTradeIncoming({ requesterEid: msg.d.requesterEid, requesterName: msg.d.requesterName }); break; }
      case Op.S_TRADE_START: { store.setTradeIncoming(null); store.setTradeSession({ partnerEid: msg.d.partnerEid, partnerName: msg.d.partnerName }); break; }
      case Op.S_TRADE_UPDATE: { store.updateTradeSlots(msg.d.side, msg.d.slots, msg.d.confirmed); break; }
      case Op.S_TRADE_COMPLETE: {
        const items = msg.d.received.map((r: { itemId: string; quantity: number }) => `${r.quantity}x ${r.itemId}`).join(", ");
        this.showSystemMessage(items.length > 0 ? `Trade complete! Received: ${items}` : "Trade complete!");
        store.clearTrade();
        break;
      }
      case Op.S_TRADE_CANCELLED: { this.showSystemMessage(msg.d.reason); store.clearTrade(); break; }

      case Op.S_ABILITY_LIST: { store.setAbilities(msg.d.abilities); break; }

      case Op.S_SKILL_COOLDOWN: {
        store.setAbilityCooldown(msg.d.abilityId, msg.d.remainingMs);
        const lpCast = store.localPlayer;
        if (lpCast) {
          const ABILITY_VFX: Record<string, { tint: number; count: number; speed: number; spread: number; life: number; gravity: number; spin?: number }> = {
            power_strike: { tint: 0xff6644, count: 12, speed: 12, spread: Math.PI, life: 0.4, gravity: -10 },
            shield_bash: { tint: 0xffdd44, count: 8, speed: 8, spread: Math.PI * 0.8, life: 0.3, gravity: -10 },
            heal: { tint: 0x44ff88, count: 18, speed: 5, spread: Math.PI * 2, life: 0.8, gravity: -8 },
            sprint: { tint: 0x44aaff, count: 8, speed: 10, spread: Math.PI * 0.5, life: 0.3, gravity: -10 },
            whirlwind: { tint: 0xaaddff, count: 20, speed: 15, spread: Math.PI * 2, life: 0.5, gravity: 0, spin: 8 },
            life_drain: { tint: 0xaa44ff, count: 14, speed: 8, spread: Math.PI * 2, life: 0.7, gravity: -5 },
            poison_strike: { tint: 0x44ff44, count: 10, speed: 10, spread: Math.PI, life: 0.5, gravity: -10 },
            war_cry: { tint: 0xffaa00, count: 20, speed: 14, spread: Math.PI * 2, life: 0.6, gravity: 0 },
            dodge_roll: { tint: 0xccccff, count: 8, speed: 12, spread: Math.PI * 0.4, life: 0.25, gravity: -10 },
          };
          const vfx = ABILITY_VFX[msg.d.abilityId];
          if (vfx) {
            this.particles.emit(lpCast.x, 1, lpCast.y, vfx.count, {
              tint: vfx.tint, speed: vfx.speed, spread: vfx.spread,
              life: vfx.life, gravity: vfx.gravity, dirY: 1, baseScale: 1.0, spin: vfx.spin,
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
          const tz = targetEntity?.nextY ?? lp?.y ?? 0;
          this.particles.emit(tx, 1, tz, 8, {
            tint: color, speed: 5, spread: Math.PI * 2, life: 0.8, gravity: -4, baseScale: 0.6,
          });
        } else if (msg.d.action === "tick") {
          const tx = targetEntity?.nextX ?? lp?.x ?? 0;
          const tz = targetEntity?.nextY ?? lp?.y ?? 0;
          if (msg.d.effectId === "poison") {
            this.particles.emit(tx, 1, tz, 3, {
              tint: 0x44ff44, speed: 3, spread: Math.PI, life: 0.4, gravity: -3, baseScale: 0.4,
            });
          }
        }
        break;
      }

      case Op.S_SHOP_OPEN: { store.setShopData(msg.d); break; }
      case Op.S_FISH_BITE: { this.audio.playSfx("chat_blip"); this.showSystemMessage("Fish on the line! Reel in!"); break; }
      case Op.S_FISH_RESULT: {
        if (msg.d.success) { this.achieve.onFishCaught(); this.showSystemMessage(`Caught a fish! (+${msg.d.xp ?? 0} fishing XP)`); }
        else { this.showSystemMessage("The fish got away..."); }
        break;
      }

      case Op.S_CHUNK_DATA: { store.addChunkData(msg.d.chunkX, msg.d.chunkY, msg.d.biome, msg.d.tiles, msg.d.lights); break; }
      case Op.S_CHUNK_UNLOAD: { store.removeChunkData(msg.d.chunkX, msg.d.chunkY); break; }
      case Op.S_DISCOVERY_INIT: { store.setDiscoveredChunks(msg.d.chunks); break; }
      case Op.S_DISCOVERY_UPDATE: { store.addDiscoveredChunks(msg.d.chunks); this.achieve.onDiscovery(store.discoveredChunks.size); if (msg.d.xp && msg.d.xp > 0) this.showSystemMessage(`Explored new territory! +${msg.d.xp} XP`); break; }
      case Op.S_WEATHER_UPDATE: {
        store.setWeather(msg.d.weather, msg.d.intensity, msg.d.durationTicks, msg.d.ambientTint);
        if (msg.d.weather !== "clear" && msg.d.intensity > 0.3) {
          const names: Record<string, string> = { rain: "Rain", heavy_rain: "Heavy Rain", snow: "Snow", blizzard: "Blizzard", sandstorm: "Sandstorm", fog: "Fog", thunderstorm: "Thunderstorm" };
          this.showSystemMessage(names[msg.d.weather] ?? msg.d.weather);
        }
        break;
      }
      case Op.S_TICK: break;
      case Op.S_PONG: break;
    }
  }

  // ── UI helpers (same as original Dispatcher) ──

  private showSystemMessage(message: string): void {
    const container = document.getElementById("system-messages");
    if (!container) return;
    const popup = document.createElement("div");
    popup.className = "system-msg";
    popup.textContent = message;
    container.appendChild(popup);
    requestAnimationFrame(() => popup.classList.add("visible"));
    setTimeout(() => { popup.classList.remove("visible"); setTimeout(() => popup.remove(), 500); }, 3000);
  }

  private updateHUD(): void {
    const lp = useGameStore.getState().localPlayer;
    if (!lp) return;
    const hpBar = document.getElementById("hp-bar");
    const hpText = document.getElementById("hp-text");
    if (hpBar) hpBar.style.width = `${(lp.hp / lp.maxHp) * 100}%`;
    if (hpText) hpText.textContent = `${Math.max(0, lp.hp)} / ${lp.maxHp}`;
  }

  private flashHpBar(): void {
    const container = document.querySelector(".bar-container") as HTMLElement;
    if (!container) return;
    container.classList.remove("damage-flash");
    void container.offsetWidth;
    container.classList.add("damage-flash");
    setTimeout(() => container.classList.remove("damage-flash"), 300);
  }

  private xpPopupStack = 0;
  private showXpPopup(skillId: string, xp: number): void {
    const popup = document.createElement("div");
    popup.className = "xp-popup";
    popup.textContent = `+${xp} ${skillId} XP`;
    popup.style.top = `${50 + this.xpPopupStack * 24}px`;
    this.xpPopupStack++;
    document.getElementById("ui-root")?.appendChild(popup);
    setTimeout(() => { popup.remove(); this.xpPopupStack = Math.max(0, this.xpPopupStack - 1); }, 2000);
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

  private updateXpBar(skillId: string, totalXp: number): void {
    const level = levelForXp(totalXp);
    const currentLevelXp = xpForLevel(level);
    const nextLevelXp = xpForLevel(level + 1);
    const xpInLevel = totalXp - currentLevelXp;
    const xpNeeded = nextLevelXp - currentLevelXp;
    const ratio = xpNeeded > 0 ? Math.min(xpInLevel / xpNeeded, 1) : 1;
    const xpBar = document.getElementById("xp-bar");
    const xpText = document.getElementById("xp-text");
    if (xpBar) {
      xpBar.style.width = `${ratio * 100}%`;
      xpBar.style.boxShadow = "0 0 8px rgba(142, 68, 173, 0.6)";
      setTimeout(() => { xpBar.style.boxShadow = ""; }, 600);
    }
    if (xpText) {
      const name = skillId.charAt(0).toUpperCase() + skillId.slice(1);
      xpText.textContent = `${name} ${xpInLevel} / ${xpNeeded}`;
    }
  }

  private itemPickupStack = 0;
  private showItemPickup(text: string): void {
    const popup = document.createElement("div");
    popup.className = "item-pickup-popup";
    popup.textContent = text;
    popup.style.top = `${120 + this.itemPickupStack * 28}px`;
    this.itemPickupStack++;
    document.getElementById("ui-root")?.appendChild(popup);
    requestAnimationFrame(() => popup.classList.add("visible"));
    setTimeout(() => { popup.classList.remove("visible"); setTimeout(() => { popup.remove(); this.itemPickupStack = Math.max(0, this.itemPickupStack - 1); }, 400); }, 2000);
  }
}
