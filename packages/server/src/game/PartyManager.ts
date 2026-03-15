import { Op, MAX_PARTY_SIZE, PARTY_XP_RANGE, type ServerMessage, type PartyMemberInfo } from "@madworld/shared";
import { movementFormulas } from "@madworld/shared";
import { Player } from "./entities/Player.js";
import { world } from "./World.js";

interface Party {
  id: string;
  leaderEid: number;
  members: Set<number>;
  pendingInvites: Map<number, ReturnType<typeof setTimeout>>;
  dungeonInstanceId: string | null;
}

let partyIdCounter = 0;
function generatePartyId(): string {
  return `party_${++partyIdCounter}_${Date.now().toString(36)}`;
}

class PartyManager {
  private parties = new Map<string, Party>();
  private playerParty = new Map<number, string>();

  createParty(leader: Player): Party {
    const party: Party = {
      id: generatePartyId(),
      leaderEid: leader.eid,
      members: new Set([leader.eid]),
      pendingInvites: new Map(),
      dungeonInstanceId: null,
    };
    this.parties.set(party.id, party);
    this.playerParty.set(leader.eid, party.id);
    leader.partyId = party.id;
    return party;
  }

  invitePlayer(inviter: Player, targetEid: number): void {
    const target = world.getPlayer(targetEid);
    if (!target) {
      inviter.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Player not found." } } satisfies ServerMessage);
      return;
    }

    if (target.zoneId !== inviter.zoneId) {
      inviter.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Player is not in your zone." } } satisfies ServerMessage);
      return;
    }

    const dist = movementFormulas.distance(inviter.x, inviter.y, target.x, target.y);
    if (dist > 10) {
      inviter.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Player is too far away." } } satisfies ServerMessage);
      return;
    }

    if (this.playerParty.has(targetEid)) {
      inviter.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Player is already in a party." } } satisfies ServerMessage);
      return;
    }

    let party = this.getPartyForPlayer(inviter.eid);
    if (party && party.leaderEid !== inviter.eid) {
      inviter.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Only the party leader can invite." } } satisfies ServerMessage);
      return;
    }

    if (party && party.members.size >= MAX_PARTY_SIZE) {
      inviter.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Party is full." } } satisfies ServerMessage);
      return;
    }

    // Create party if inviter is solo
    if (!party) {
      party = this.createParty(inviter);
    }

    // Clear existing invite to this player if any
    const existingTimeout = party.pendingInvites.get(targetEid);
    if (existingTimeout) clearTimeout(existingTimeout);

    // Set invite with 30s expiry
    const timeout = setTimeout(() => {
      party!.pendingInvites.delete(targetEid);
    }, 30000);
    party.pendingInvites.set(targetEid, timeout);

    target.send({
      op: Op.S_PARTY_INVITE,
      d: { inviterEid: inviter.eid, inviterName: inviter.name, partySize: party.members.size },
    } satisfies ServerMessage);

    inviter.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Invited ${target.name} to the party.` } } satisfies ServerMessage);
  }

  acceptInvite(player: Player, inviterEid: number): void {
    // Find the party that has a pending invite for this player from inviterEid
    const inviterPartyId = this.playerParty.get(inviterEid);
    if (!inviterPartyId) {
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Invite expired." } } satisfies ServerMessage);
      return;
    }
    const party = this.parties.get(inviterPartyId);
    if (!party || !party.pendingInvites.has(player.eid)) {
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Invite expired." } } satisfies ServerMessage);
      return;
    }

    if (party.members.size >= MAX_PARTY_SIZE) {
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Party is full." } } satisfies ServerMessage);
      return;
    }

    // Clear invite
    clearTimeout(party.pendingInvites.get(player.eid)!);
    party.pendingInvites.delete(player.eid);

    // Add to party
    party.members.add(player.eid);
    this.playerParty.set(player.eid, party.id);
    player.partyId = party.id;

    this.broadcastPartyUpdate(party);
  }

  declineInvite(player: Player, inviterEid: number): void {
    const inviterPartyId = this.playerParty.get(inviterEid);
    if (!inviterPartyId) return;
    const party = this.parties.get(inviterPartyId);
    if (!party) return;

    const timeout = party.pendingInvites.get(player.eid);
    if (timeout) {
      clearTimeout(timeout);
      party.pendingInvites.delete(player.eid);
    }

    const inviter = world.getPlayer(inviterEid);
    if (inviter) {
      inviter.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `${player.name} declined the invite.` } } satisfies ServerMessage);
    }
  }

  leaveParty(player: Player): void {
    const party = this.getPartyForPlayer(player.eid);
    if (!party) return;

    party.members.delete(player.eid);
    this.playerParty.delete(player.eid);
    player.partyId = null;

    // Transfer leadership if leader left
    if (party.leaderEid === player.eid && party.members.size > 0) {
      party.leaderEid = party.members.values().next().value!;
    }

    if (party.members.size === 0) {
      this.dissolveParty(party.id, "last_member");
    } else {
      this.broadcastPartyUpdate(party);
      player.send({ op: Op.S_PARTY_DISSOLVED, d: { reason: "leader_left" } } satisfies ServerMessage);
    }
  }

  kickMember(leader: Player, targetEid: number): void {
    const party = this.getPartyForPlayer(leader.eid);
    if (!party || party.leaderEid !== leader.eid) {
      leader.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You are not the party leader." } } satisfies ServerMessage);
      return;
    }

    if (!party.members.has(targetEid)) return;
    if (targetEid === leader.eid) return;

    const target = world.getPlayer(targetEid);
    party.members.delete(targetEid);
    this.playerParty.delete(targetEid);

    if (target) {
      target.partyId = null;
      // If in dungeon, eject
      if (target.returnZoneId) {
        // Handled by InstanceManager when it exists
      }
      target.send({ op: Op.S_PARTY_DISSOLVED, d: { reason: "kicked" } } satisfies ServerMessage);
    }

    this.broadcastPartyUpdate(party);
  }

  dissolveParty(partyId: string, reason: "leader_left" | "last_member" | "kicked" = "last_member"): void {
    const party = this.parties.get(partyId);
    if (!party) return;

    // Clear all pending invites
    for (const timeout of party.pendingInvites.values()) {
      clearTimeout(timeout);
    }

    // Notify and clean up members
    for (const eid of party.members) {
      const player = world.getPlayer(eid);
      if (player) {
        player.partyId = null;
        player.send({ op: Op.S_PARTY_DISSOLVED, d: { reason } } satisfies ServerMessage);
      }
      this.playerParty.delete(eid);
    }

    this.parties.delete(partyId);
  }

  getParty(partyId: string): Party | undefined {
    return this.parties.get(partyId);
  }

  getPartyForPlayer(eid: number): Party | undefined {
    const partyId = this.playerParty.get(eid);
    if (!partyId) return undefined;
    return this.parties.get(partyId);
  }

  broadcastToParty(partyId: string, msg: ServerMessage, excludeEid?: number): void {
    const party = this.parties.get(partyId);
    if (!party) return;
    for (const eid of party.members) {
      if (eid === excludeEid) continue;
      const player = world.getPlayer(eid);
      if (player) player.send(msg);
    }
  }

  getPartyMembersInRange(party: Party, x: number, y: number, zoneId: string, range: number): Player[] {
    const result: Player[] = [];
    for (const eid of party.members) {
      const member = world.getPlayer(eid);
      if (!member || member.zoneId !== zoneId || member.hp <= 0) continue;
      const dist = movementFormulas.distance(x, y, member.x, member.y);
      if (dist <= range) {
        result.push(member);
      }
    }
    return result;
  }

  syncPartyMemberHp(player: Player): void {
    if (!player.partyId || player.hp === player.lastSyncedHp) return;
    player.lastSyncedHp = player.hp;

    this.broadcastToParty(player.partyId, {
      op: Op.S_PARTY_MEMBER_HP,
      d: { eid: player.eid, hp: player.hp, maxHp: player.maxHp },
    } satisfies ServerMessage, player.eid);
  }

  private broadcastPartyUpdate(party: Party): void {
    const members: PartyMemberInfo[] = [];
    for (const eid of party.members) {
      const p = world.getPlayer(eid);
      if (!p) continue;
      const zone = world.getZone(p.zoneId);
      members.push({
        eid: p.eid,
        playerId: p.playerId,
        name: p.name,
        hp: p.hp,
        maxHp: p.maxHp,
        level: 1,
        zoneId: p.zoneId,
        zoneName: zone?.def.name ?? p.zoneId,
        isLeader: eid === party.leaderEid,
      });
    }

    const msg: ServerMessage = {
      op: Op.S_PARTY_UPDATE,
      d: { partyId: party.id, members, leadEid: party.leaderEid },
    };
    for (const eid of party.members) {
      const p = world.getPlayer(eid);
      if (p) p.send(msg);
    }
  }
}

export const partyManager = new PartyManager();
