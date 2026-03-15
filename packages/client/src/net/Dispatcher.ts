import { Op, EntityType, type ServerMessage } from "@madworld/shared";
import { useGameStore, type RemoteEntity } from "../state/GameStore.js";
import type { HitSplatRenderer } from "../renderer/HitSplatRenderer.js";

export class Dispatcher {
  private hitSplats: HitSplatRenderer;
  private onZoneChange: (() => void) | null = null;

  constructor(hitSplats: HitSplatRenderer) {
    this.hitSplats = hitSplats;
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
        break;
      }

      case Op.S_DEATH: {
        const lp = store.localPlayer;
        if (lp && msg.d.eid === lp.eid) {
          store.updateLocalPlayer({ isDead: true });
          const overlay = document.getElementById("death-overlay");
          if (overlay) overlay.classList.add("active");
        }
        // Remove dead entity sprite (will respawn)
        store.despawnEntity(msg.d.eid);
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
        break;
      }

      case Op.S_TICK: {
        // Could use for time sync
        break;
      }

      case Op.S_PONG: {
        // RTT measurement
        break;
      }
    }
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
