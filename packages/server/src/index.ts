import { Hono } from "hono";
import { config } from "./config.js";
import { authRoutes } from "./auth/routes.js";
import { world } from "./game/World.js";
import { startGameLoop, stopGameLoop } from "./game/GameLoop.js";
import {
  handleMessage,
  handleDisconnect,
  createSocketData,
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

// Start game loop
startGameLoop();

// Start server
const server = Bun.serve<SocketData>({
  port: config.port,
  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, {
        data: createSocketData(),
      });
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    // HTTP routes
    return app.fetch(req, { ip: server.requestIP(req) });
  },
  websocket: {
    idleTimeout: 60,
    maxPayloadLength: 4096,

    open(ws) {
      // Wait for auth message
    },

    async message(ws, message) {
      await handleMessage(ws as GameWebSocket, String(message));
    },

    async close(ws) {
      await handleDisconnect(ws as GameWebSocket);
    },
  },
});

console.log(`[MadWorld] Server running on http://localhost:${config.port}`);

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[MadWorld] Shutting down...");
  stopGameLoop();
  // Save all players
  const { savePlayer } = await import("./services/PlayerService.js");
  for (const [, player] of world.playersByEid) {
    await savePlayer(player).catch(console.error);
  }
  process.exit(0);
});
