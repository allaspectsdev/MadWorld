import { useGameStore } from "../../state/GameStore.js";
import { Op, type ClientMessage } from "@madworld/shared";
import type { Socket } from "../../net/Socket.js";
import { escapeHtml } from "../escapeHtml.js";

export class PartyInviteModal {
  private modal: HTMLElement;
  private socket: Socket;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(socket: Socket) {
    this.socket = socket;
    this.modal = document.getElementById("party-invite-modal")!;

    document.getElementById("invite-accept")!.addEventListener("click", () => {
      const invite = useGameStore.getState().partyInvite;
      if (invite) {
        this.socket.send({
          op: Op.C_PARTY_ACCEPT,
          d: { inviterEid: invite.inviterEid },
        } as ClientMessage);
      }
      this.hide();
    });

    document.getElementById("invite-decline")!.addEventListener("click", () => {
      const invite = useGameStore.getState().partyInvite;
      if (invite) {
        this.socket.send({
          op: Op.C_PARTY_DECLINE,
          d: { inviterEid: invite.inviterEid },
        } as ClientMessage);
      }
      this.hide();
    });
  }

  start(): void {
    this.unsubscribe = useGameStore.subscribe((state) => {
      if (state.partyInvite) {
        this.show(state.partyInvite.inviterName, state.partyInvite.partySize);
      }
    });
  }

  stop(): void {
    this.unsubscribe?.();
  }

  private show(inviterName: string, partySize: number): void {
    const text = this.modal.querySelector("#invite-text") as HTMLElement;
    if (text) {
      text.innerHTML = `<strong>${escapeHtml(inviterName)}</strong> invited you to their party (${partySize}/5)`;
    }
    this.modal.style.display = "flex";

    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => this.hide(), 15000);
  }

  private hide(): void {
    this.modal.style.display = "none";
    useGameStore.getState().setPartyInvite(null);
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }
}
