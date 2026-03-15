import { Op, type ClientMessage } from "@madworld/shared";
import { Player } from "../game/entities/Player.js";
import { world } from "../game/World.js";
import { partyManager } from "../game/PartyManager.js";
import { verifyToken } from "../auth/jwt.js";
import { loadPlayer } from "../services/PlayerService.js";
import { savePlayer } from "../services/PlayerService.js";
import type { ServerWebSocket } from "bun";

export interface SocketData {
  userId: number | null;
  player: Player | null;
}

export type GameWebSocket = ServerWebSocket<SocketData>;

export function createSocketData(): SocketData {
  return { userId: null, player: null };
}

export async function handleMessage(
  ws: GameWebSocket,
  raw: string,
): Promise<void> {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  // Auth messages can come before authentication
  if (msg.op === Op.C_AUTH_LOGIN) {
    await handleAuth(ws, msg.d as { email: string; password: string });
    return;
  }

  // All other messages require authentication
  const player = ws.data.player;
  if (!player) {
    ws.send(
      JSON.stringify({ op: Op.S_AUTH_ERROR, d: { reason: "Not authenticated" } }),
    );
    return;
  }

  switch (msg.op) {
    case Op.C_MOVE:
      player.moveQueue.push({
        dx: msg.d.dx,
        dy: msg.d.dy,
        seq: msg.d.seq,
      });
      break;

    case Op.C_STOP:
      player.moveQueue = [];
      player.dx = 0;
      player.dy = 0;
      break;

    case Op.C_ATTACK:
      player.combatTarget = msg.d.targetEid;
      player.attackCooldown = 0;
      break;

    case Op.C_PARTY_INVITE:
      partyManager.invitePlayer(player, msg.d.targetEid);
      break;

    case Op.C_PARTY_ACCEPT:
      partyManager.acceptInvite(player, msg.d.inviterEid);
      break;

    case Op.C_PARTY_DECLINE:
      partyManager.declineInvite(player, msg.d.inviterEid);
      break;

    case Op.C_PARTY_LEAVE:
      partyManager.leaveParty(player);
      break;

    case Op.C_PARTY_KICK:
      partyManager.kickMember(player, msg.d.targetEid);
      break;

    case Op.C_CHAT_SEND: {
      const now = Date.now();
      // Rate limit: 1 message per second
      if (now - player.lastChatTime < 1000) break;

      const raw = msg.d.message;
      if (!raw || typeof raw !== "string") break;

      // Strip HTML and trim
      const message = raw.replace(/<[^>]*>/g, "").trim();
      if (message.length < 1 || message.length > 200) break;

      player.lastChatTime = now;
      const channel = msg.d.channel ?? "zone";
      const chatMsg = {
        op: Op.S_CHAT_MESSAGE,
        d: {
          channel,
          senderName: player.name,
          message,
          timestamp: now,
        },
      };

      if (channel === "global") {
        for (const [, p] of world.playersByEid) {
          p.send(chatMsg);
        }
      } else if (channel === "whisper") {
        const targetName = msg.d.targetName;
        if (!targetName) break;
        let target: Player | undefined;
        for (const [, p] of world.playersByEid) {
          if (p.name.toLowerCase() === targetName.toLowerCase()) {
            target = p;
            break;
          }
        }
        if (target) {
          target.send(chatMsg);
          // Echo back to sender so they see their own whisper
          player.send(chatMsg);
        } else {
          player.send({
            op: Op.S_CHAT_MESSAGE,
            d: { channel: "system" as const, senderName: "", message: `Player "${targetName}" not found.`, timestamp: now },
          });
        }
      } else {
        // Zone chat: broadcast to all players in same zone
        const zone = world.getZone(player.zoneId);
        if (zone) {
          for (const [, p] of zone.players) {
            p.send(chatMsg);
          }
        }
      }
      break;
    }

    case Op.C_PING:
      ws.send(
        JSON.stringify({
          op: Op.S_PONG,
          d: { t: msg.d.t, serverTime: Date.now() },
        }),
      );
      break;

    default:
      // Unknown or unimplemented opcode
      break;
  }
}

async function handleAuth(
  ws: GameWebSocket,
  data: { email: string; password: string },
): Promise<void> {
  // Simple auth: use the login endpoint logic inline for WS auth
  // In production, client would first POST /api/login, get a token, then send token over WS
  // For now, accept a token field
  const tokenData = data as unknown as { token: string };
  if (tokenData.token) {
    const userId = await verifyToken(tokenData.token);
    if (!userId) {
      ws.send(
        JSON.stringify({ op: Op.S_AUTH_ERROR, d: { reason: "Invalid token" } }),
      );
      return;
    }

    // Check if already logged in — kick old session cleanly
    const existing = world.getPlayerByUserId(userId);
    if (existing) {
      if (existing.partyId) {
        partyManager.leaveParty(existing);
      }
      if (existing.ws) {
        existing.ws.send(
          JSON.stringify({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Logged in from another device." } }),
        );
        existing.ws.close(1000, "Logged in elsewhere");
      }
      world.removePlayer(existing);
    }

    const player = await loadPlayer(userId);
    if (!player) {
      ws.send(
        JSON.stringify({ op: Op.S_AUTH_ERROR, d: { reason: "No character found" } }),
      );
      return;
    }

    ws.data.userId = userId;
    ws.data.player = player;
    player.ws = ws;

    world.addPlayer(player);

    ws.send(
      JSON.stringify({
        op: Op.S_AUTH_OK,
        d: { token: "", playerId: player.playerId, eid: player.eid },
      }),
    );

    // Send initial stats
    ws.send(
      JSON.stringify({
        op: Op.S_PLAYER_STATS,
        d: { hp: player.hp, maxHp: player.maxHp, level: 1 },
      }),
    );

    // Welcome message
    ws.send(
      JSON.stringify({
        op: Op.S_CHAT_MESSAGE,
        d: {
          channel: "system",
          senderName: "",
          message: "Welcome to MadWorld! Use WASD to move. Click mobs to attack. Press Enter to chat.",
          timestamp: Date.now(),
        },
      }),
    );
  }
}

export async function handleDisconnect(ws: GameWebSocket): Promise<void> {
  const player = ws.data.player;
  if (player) {
    player.ws = null;
    if (player.partyId) {
      partyManager.leaveParty(player);
    }
    await savePlayer(player).catch((err) =>
      console.error(`[Disconnect] Failed to save player ${player.name}:`, err),
    );
    world.removePlayer(player);
  }
}
