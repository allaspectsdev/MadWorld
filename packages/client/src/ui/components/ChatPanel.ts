import { Op, EntityType, type ClientMessage, type S_ChatMessage, movementFormulas } from "@madworld/shared";
import type { Socket } from "../../net/Socket.js";
import { useGameStore } from "../../state/GameStore.js";

const CHANNEL_COLORS: Record<string, string> = {
  zone: "#ffffff",
  global: "#ffdd57",
  whisper: "#ff88cc",
  system: "#aaaaaa",
};

export class ChatPanel {
  private container: HTMLElement;
  private log: HTMLElement;
  private inputEl: HTMLInputElement;
  private socket: Socket;
  private channel: "zone" | "global" | "whisper" = "zone";
  private lastMsgCount = 0;
  private onFocusChange: ((focused: boolean) => void) | null = null;

  constructor(socket: Socket) {
    this.socket = socket;

    this.container = document.getElementById("chat-panel")!;
    this.log = document.getElementById("chat-log")!;
    this.inputEl = document.getElementById("chat-input") as HTMLInputElement;

    // Tab buttons
    const tabs = this.container.querySelectorAll<HTMLElement>(".chat-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        this.channel = tab.dataset.channel as typeof this.channel;
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.inputEl.focus();
      });
    });

    // Send on Enter
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.sendMessage();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
      e.stopPropagation();
    });

    // Prevent key events from bubbling to game when typing
    this.inputEl.addEventListener("keyup", (e) => e.stopPropagation());

    this.inputEl.addEventListener("focus", () => {
      this.onFocusChange?.(true);
    });

    this.inputEl.addEventListener("blur", () => {
      this.onFocusChange?.(false);
    });
  }

  setOnFocusChange(fn: (focused: boolean) => void): void {
    this.onFocusChange = fn;
  }

  open(): void {
    useGameStore.getState().setChatOpen(true);
    this.container.classList.add("open");
    this.inputEl.focus();
  }

  close(): void {
    useGameStore.getState().setChatOpen(false);
    this.container.classList.remove("open");
    this.inputEl.blur();
  }

  toggle(): void {
    if (useGameStore.getState().chatOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  isOpen(): boolean {
    return useGameStore.getState().chatOpen;
  }

  update(): void {
    const msgs = useGameStore.getState().chatMessages;
    if (msgs.length === this.lastMsgCount) return;

    // Render new messages
    for (let i = this.lastMsgCount; i < msgs.length; i++) {
      this.appendMessage(msgs[i]);
    }
    this.lastMsgCount = msgs.length;
  }

  private appendMessage(msg: S_ChatMessage): void {
    const div = document.createElement("div");
    div.className = "chat-msg";
    const color = CHANNEL_COLORS[msg.channel] ?? "#ffffff";

    if (msg.channel === "system") {
      div.innerHTML = `<span style="color:${color};font-style:italic">${this.escapeHtml(msg.message)}</span>`;
    } else {
      const prefix = msg.channel === "global" ? "[Global] " : msg.channel === "whisper" ? "[Whisper] " : "";
      div.innerHTML = `<span style="color:${color}">${prefix}<b>${this.escapeHtml(msg.senderName)}</b>: ${this.escapeHtml(msg.message)}</span>`;
    }

    this.log.appendChild(div);
    this.log.scrollTop = this.log.scrollHeight;
  }

  private sendMessage(): void {
    const raw = this.inputEl.value.trim();
    if (!raw) return;
    this.inputEl.value = "";

    // Parse slash commands
    let channel = this.channel;
    let message = raw;
    let targetName: string | undefined;

    if (raw.startsWith("/g ")) {
      channel = "global";
      message = raw.slice(3);
    } else if (raw.startsWith("/w ")) {
      channel = "whisper";
      const rest = raw.slice(3);
      const spaceIdx = rest.indexOf(" ");
      if (spaceIdx === -1) return;
      targetName = rest.slice(0, spaceIdx);
      message = rest.slice(spaceIdx + 1);
    }

    if (!message.trim()) return;

    // Client-side /trade command
    if (raw.toLowerCase().startsWith("/trade")) {
      this.handleTradeCommand(raw);
      return;
    }

    this.socket.send({
      op: Op.C_CHAT_SEND,
      d: { channel, message: message.trim(), targetName },
    } as ClientMessage);
  }

  private handleTradeCommand(raw: string): void {
    const state = useGameStore.getState();
    const lp = state.localPlayer;
    if (!lp) return;

    const parts = raw.split(" ");
    const targetName = parts[1]?.trim();

    if (targetName) {
      // Find player by name
      for (const [, e] of state.entities) {
        if (e.type === EntityType.PLAYER && e.name?.toLowerCase() === targetName.toLowerCase()) {
          this.socket.send({ op: Op.C_TRADE_REQUEST, d: { targetEid: e.eid } } as ClientMessage);
          return;
        }
      }
      state.addChatMessage({ channel: "system", senderName: "", message: `Player "${targetName}" not found nearby.`, timestamp: Date.now() });
    } else {
      // Find nearest player
      let nearestEid = -1;
      let nearestDist = Infinity;
      for (const [, e] of state.entities) {
        if (e.type === EntityType.PLAYER) {
          const d = movementFormulas.distance(lp.x, lp.y, e.nextX, e.nextY);
          if (d < nearestDist && d <= 5) {
            nearestDist = d;
            nearestEid = e.eid;
          }
        }
      }
      if (nearestEid !== -1) {
        this.socket.send({ op: Op.C_TRADE_REQUEST, d: { targetEid: nearestEid } } as ClientMessage);
      } else {
        state.addChatMessage({ channel: "system", senderName: "", message: "No players nearby to trade with. Use /trade <name>", timestamp: Date.now() });
      }
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
