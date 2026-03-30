import { useGameStore } from "../../state/GameStore.js";
import { Op, type ClientMessage } from "@madworld/shared";
import type { Socket } from "../../net/Socket.js";
import { escapeHtml } from "../escapeHtml.js";

export class TradeInviteModal {
  private modal: HTMLElement;
  private textEl: HTMLElement;
  private socket: Socket;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(socket: Socket) {
    this.socket = socket;

    // Build DOM
    this.modal = document.createElement("div");
    this.modal.className = "trade-invite-modal";
    this.modal.style.display = "none";

    this.textEl = document.createElement("div");
    this.textEl.className = "trade-invite-text";
    this.modal.appendChild(this.textEl);

    const btnRow = document.createElement("div");
    btnRow.className = "trade-invite-btns";

    const acceptBtn = document.createElement("button");
    acceptBtn.className = "trade-invite-accept";
    acceptBtn.textContent = "Accept";
    acceptBtn.addEventListener("click", () => {
      this.socket.send({ op: Op.C_TRADE_ACCEPT, d: {} } as ClientMessage);
      this.hide();
    });

    const declineBtn = document.createElement("button");
    declineBtn.className = "trade-invite-decline";
    declineBtn.textContent = "Decline";
    declineBtn.addEventListener("click", () => {
      this.socket.send({ op: Op.C_TRADE_CANCEL, d: {} } as ClientMessage);
      this.hide();
    });

    btnRow.appendChild(acceptBtn);
    btnRow.appendChild(declineBtn);
    this.modal.appendChild(btnRow);

    document.getElementById("ui-root")!.appendChild(this.modal);
  }

  start(): void {
    this.unsubscribe = useGameStore.subscribe((state) => {
      if (state.tradeIncoming) {
        this.show(state.tradeIncoming.requesterName);
      }
    });
  }

  stop(): void {
    this.unsubscribe?.();
  }

  private show(requesterName: string): void {
    this.textEl.innerHTML = `<strong>${escapeHtml(requesterName)}</strong> wants to trade`;
    this.modal.style.display = "flex";
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => this.hide(), 15000);
  }

  private hide(): void {
    this.modal.style.display = "none";
    useGameStore.getState().setTradeIncoming(null);
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }
}
