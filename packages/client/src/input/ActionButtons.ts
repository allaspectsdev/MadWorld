import { EntityType, Op, type ClientMessage } from "@madworld/shared";
import { movementFormulas } from "@madworld/shared";
import { useGameStore } from "../state/GameStore.js";
import type { Socket } from "../net/Socket.js";

export class ActionButtons {
  private container: HTMLElement;
  private attackBtn: HTMLButtonElement;
  private partyBtn: HTMLButtonElement;
  private leaveBtn: HTMLButtonElement;
  private socket: Socket;
  private unsubscribe: (() => void) | null = null;

  constructor(socket: Socket) {
    this.socket = socket;
    this.container = document.getElementById("action-buttons")!;

    this.attackBtn = document.getElementById("btn-attack") as HTMLButtonElement;
    this.partyBtn = document.getElementById("btn-party") as HTMLButtonElement;
    this.leaveBtn = document.getElementById("btn-leave-party") as HTMLButtonElement;

    this.attackBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.attackNearest();
    });

    this.partyBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.inviteNearest();
    });

    this.leaveBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.socket.send({ op: Op.C_PARTY_LEAVE, d: {} } as ClientMessage);
    });
  }

  start(): void {
    this.unsubscribe = useGameStore.subscribe((state) => {
      this.leaveBtn.style.display = state.party ? "flex" : "none";
    });
    this.leaveBtn.style.display = useGameStore.getState().party ? "flex" : "none";
  }

  private attackNearest(): void {
    const state = useGameStore.getState();
    const lp = state.localPlayer;
    if (!lp) return;

    let closest: number | null = null;
    let closestDist = 3; // max range in tiles

    for (const [eid, entity] of state.entities) {
      if (entity.type !== EntityType.MOB) continue;
      const dist = movementFormulas.distance(lp.x, lp.y, entity.nextX, entity.nextY);
      if (dist < closestDist) {
        closestDist = dist;
        closest = eid;
      }
    }

    if (closest !== null) {
      this.socket.send({ op: Op.C_ATTACK, d: { targetEid: closest } } as ClientMessage);
    } else {
      this.attackBtn.classList.add("flash");
      setTimeout(() => this.attackBtn.classList.remove("flash"), 200);
    }
  }

  private inviteNearest(): void {
    const state = useGameStore.getState();
    const lp = state.localPlayer;
    if (!lp) return;

    let closest: number | null = null;
    let closestDist = 5;

    for (const [eid, entity] of state.entities) {
      if (entity.type !== EntityType.PLAYER) continue;
      const dist = movementFormulas.distance(lp.x, lp.y, entity.nextX, entity.nextY);
      if (dist < closestDist) {
        closestDist = dist;
        closest = eid;
      }
    }

    if (closest !== null) {
      this.socket.send({ op: Op.C_PARTY_INVITE, d: { targetEid: closest } } as ClientMessage);
    } else {
      this.partyBtn.classList.add("flash");
      setTimeout(() => this.partyBtn.classList.remove("flash"), 200);
    }
  }

  destroy(): void {
    this.unsubscribe?.();
  }
}
