import { Op, type ServerMessage } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { partyManager } from "../../game/PartyManager.js";

export function handlePartyInvite(player: Player, d: any): void {
  partyManager.invitePlayer(player, d.targetEid);
}

export function handlePartyAccept(player: Player, d: any): void {
  partyManager.acceptInvite(player, d.inviterEid);
}

export function handlePartyDecline(player: Player, d: any): void {
  partyManager.declineInvite(player, d.inviterEid);
}

export function handlePartyLeave(player: Player): void {
  partyManager.leaveParty(player);
}

export function handlePartyKick(player: Player, d: any): void {
  partyManager.kickMember(player, d.targetEid);
}
