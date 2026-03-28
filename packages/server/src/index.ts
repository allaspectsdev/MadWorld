import { Hono } from "hono";
import { config } from "./config.js";
import { authRoutes } from "./auth/routes.js";
import { world } from "./game/World.js";
import { startGameLoop, stopGameLoop, setPlayerPersist } from "./game/GameLoop.js";
import { savePlayer } from "./services/PlayerService.js";
import {
  handleMessage,
  handleDisconnect,
  createSocketData,
  trackConnection,
  untrackConnection,
  type GameWebSocket,
  type SocketData,
} from "./net/MessageHandler.js";
import type { ServerWebSocket } from "bun";

const app = new Hono();

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", players: world.playersByEid.size }));

// Auth routes
app.route("/", authRoutes);

// Initialize world
world.init();

// Inject persistence function to break circular dep, then start game loop
setPlayerPersist(savePlayer);
startGameLoop();

// Connection limit
let activeConnections = 0;
const MAX_CONNECTIONS = 200;

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

// Start server
const server = Bun.serve<SocketData>({
  port: config.port,
  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      if (activeConnections >= MAX_CONNECTIONS) {
        return new Response("Too many connections", { status: 503, headers: securityHeaders });
      }
      const upgraded = server.upgrade(req, {
        data: createSocketData(),
      });
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400, headers: securityHeaders });
      }
      return undefined;
    }

    // HTTP routes — add security headers to all responses
    const result = app.fetch(req, { ip: server.requestIP(req) });
    const addHeaders = (res: Response) => {
      const newRes = new Response(res.body, res);
      for (const [k, v] of Object.entries(securityHeaders)) {
        newRes.headers.set(k, v);
      }
      return newRes;
    };
    return result instanceof Promise ? result.then(addHeaders) : addHeaders(result);
  },
  websocket: {
    idleTimeout: 60,
    maxPayloadLength: 4096,

    open(ws) {
      activeConnections++;
      trackConnection(ws as GameWebSocket);
    },

    async message(ws, message) {
      await handleMessage(ws as GameWebSocket, String(message));
    },

    async close(ws) {
      activeConnections--;
      untrackConnection(ws as GameWebSocket);
      await handleDisconnect(ws as GameWebSocket);
    },
  },
});

console.log(`[MadWorld] Server running on http://localhost:${config.port}`);

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[MadWorld] Shutting down...");
  stopGameLoop();
  for (const [, player] of world.playersByEid) {
    await savePlayer(player).catch(console.error);
  }
  process.exit(0);
});
