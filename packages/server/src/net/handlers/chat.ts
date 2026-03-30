import { Op, EMOTES, EMOTE_COOLDOWN_MS, type ServerMessage } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { world } from "../../game/World.js";

export function handleChatSend(player: Player, d: any): void {
  const now = Date.now();
  if (now - player.lastChatTime < 1000) return;

  const raw = d.message;
  if (!raw || typeof raw !== "string") return;

  const message = raw.replace(/<[^>]*>/g, "").trim();
  if (message.length < 1 || message.length > 200) return;

  player.lastChatTime = now;

  const channel = d.channel ?? "zone";
  const chatMsg = {
    op: Op.S_CHAT_MESSAGE,
    d: {
      channel,
      senderName: player.name,
      senderEid: player.eid,
      message,
      timestamp: now,
    },
  };

  if (channel === "global") {
    for (const [, p] of world.playersByEid) {
      p.send(chatMsg);
    }
  } else if (channel === "whisper") {
    const targetName = d.targetName;
    if (!targetName) return;
    let target: Player | undefined;
    for (const [, p] of world.playersByEid) {
      if (p.name.toLowerCase() === targetName.toLowerCase()) {
        target = p;
        break;
      }
    }
    if (target) {
      target.send(chatMsg);
      player.send(chatMsg);
    } else {
      player.send({
        op: Op.S_CHAT_MESSAGE,
        d: { channel: "system" as const, senderName: "", message: `Player "${targetName}" not found.`, timestamp: now },
      });
    }
  } else {
    const zone = world.getZone(player.zoneId);
    if (zone) {
      for (const [, p] of zone.players) {
        p.send(chatMsg);
      }
    }
  }
}

export function handleEmote(player: Player, emoteId: string): void {
  const now = Date.now();
  if (now - player.lastEmoteTime < EMOTE_COOLDOWN_MS) return;

  const def = EMOTES[emoteId];
  if (!def) return;

  player.lastEmoteTime = now;

  const zone = world.getZone(player.zoneId);
  if (!zone) return;

  const emoteMsg: ServerMessage = {
    op: Op.S_EMOTE,
    d: {
      senderEid: player.eid,
      senderName: player.name,
      emoteId: def.id,
      timestamp: now,
    },
  };

  zone.broadcastToNearby(player.x, player.y, emoteMsg);
}
