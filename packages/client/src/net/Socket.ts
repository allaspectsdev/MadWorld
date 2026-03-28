import { Op, type ServerMessage, type ClientMessage, decodeBinary } from "@madworld/shared";

type MessageHandler = (msg: ServerMessage) => void;

export class Socket {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectDelay = 1000;
  private shouldReconnect = true;

  connect(token: string): void {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${location.host}/ws`;
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer"; // Receive binary as ArrayBuffer

    this.ws.onopen = () => {
      console.log("[WS] Connected");
      this.reconnectDelay = 1000;
      // Authenticate
      this.send({ op: Op.C_AUTH_LOGIN, d: { token } } as any);
    };

    this.ws.onmessage = (event) => {
      try {
        let msg: ServerMessage;

        if (event.data instanceof ArrayBuffer) {
          // Binary hot-path message
          const decoded = decodeBinary(event.data);
          if (!decoded) return;
          msg = decoded as unknown as ServerMessage;
        } else {
          // JSON message (everything else)
          msg = JSON.parse(event.data) as ServerMessage;
        }

        for (const handler of this.handlers) {
          handler(msg);
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      console.log("[WS] Disconnected");
      if (this.shouldReconnect) {
        setTimeout(() => this.connect(token), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000);
      }
    };

    this.ws.onerror = () => {
      // onclose will fire next
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.ws?.close();
  }
}
