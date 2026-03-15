import { Op, type ClientMessage } from "@madworld/shared";
import type { Socket } from "../net/Socket.js";

export class InputManager {
  private keys = new Set<string>();
  private seq = 0;
  private socket: Socket;
  private moveCooldown = 0;

  // Click handler for attacks
  onEntityClick: ((eid: number) => void) | null = null;

  constructor(socket: Socket) {
    this.socket = socket;

    window.addEventListener("keydown", (e) => {
      this.keys.add(e.key.toLowerCase());
    });

    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.key.toLowerCase());
    });

    // Reset on blur
    window.addEventListener("blur", () => {
      this.keys.clear();
    });
  }

  update(dt: number): { dx: number; dy: number; seq: number } | null {
    let dx = 0;
    let dy = 0;

    if (this.keys.has("w") || this.keys.has("arrowup")) dy -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) dy += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) dx -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) dx += 1;

    if (dx === 0 && dy === 0) return null;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    this.seq++;
    const move = { dx, dy, seq: this.seq };

    this.socket.send({
      op: Op.C_MOVE,
      d: { seq: this.seq, dx, dy, timestamp: Date.now() },
    } as ClientMessage);

    return move;
  }

  isKeyDown(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }
}
