import { Op } from "./opcodes.js";
import type { EntityType } from "../types/entity.js";
import type { TileType } from "../types/map.js";
import type { Appearance } from "../types/player.js";
import type { PartyMemberInfo } from "../types/party.js";

// ---- Client -> Server Payloads ----

export interface C_AuthLogin {
  email: string;
  password: string;
}

export interface C_AuthRegister {
  email: string;
  password: string;
  displayName: string;
}

export interface C_Move {
  seq: number;
  dx: number;
  dy: number;
  timestamp: number;
}

export interface C_Attack {
  targetEid: number;
}

export interface C_ChatSend {
  channel: "global" | "zone" | "whisper";
  message: string;
  targetName?: string;
}

export interface C_InvMove {
  fromSlot: number;
  toSlot: number;
}

export interface C_Equip {
  inventorySlot: number;
}

export interface C_Unequip {
  slot: string;
}

export interface C_Pickup {
  targetEid: number;
}

// ---- Server -> Client Payloads ----

export interface S_AuthOk {
  token: string;
  playerId: number;
  eid: number;
  isGod?: boolean;
  appearance?: Appearance;
}

export interface S_AuthError {
  reason: string;
}

export interface S_EnterZone {
  zoneId: string;
  name: string;
  width: number;
  height: number;
  tiles: TileType[][];
  spawnX: number;
  spawnY: number;
  lights?: { x: number; y: number; radius: number; color: number; flicker?: boolean }[];
}

export interface S_EntitySpawn {
  eid: number;
  type: EntityType;
  x: number;
  y: number;
  name?: string;
  mobId?: string;
  appearance?: Appearance;
  hp?: number;
  maxHp?: number;
  level?: number;
  isGod?: boolean;
  equipment?: Record<string, string>;
}

export interface C_GodTeleport {
  x: number;
  y: number;
}

export interface S_EntityDespawn {
  eid: number;
}

export interface S_EntityMove {
  eid: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  seq?: number;
}

export interface S_EntityStop {
  eid: number;
  x: number;
  y: number;
}

export interface S_PlayerStats {
  hp: number;
  maxHp: number;
  level: number;
}

export interface S_Damage {
  sourceEid: number;
  targetEid: number;
  amount: number;
  isCrit: boolean;
  targetHpAfter: number;
}

export interface S_Death {
  eid: number;
}

export interface S_Respawn {
  eid: number;
  x: number;
  y: number;
  hp: number;
}

export interface S_InvUpdate {
  slots: Array<{
    index: number;
    itemId: string | null;
    quantity: number;
  }>;
}

export interface S_EquipUpdate {
  slot: string;
  itemId: string | null;
}

export interface S_XpGain {
  skillId: string;
  xp: number;
  totalXp: number;
}

export interface S_LevelUp {
  skillId: string;
  newLevel: number;
}

export interface S_ChatMessage {
  channel: "global" | "zone" | "whisper" | "system";
  senderName: string;
  senderEid?: number;
  message: string;
  timestamp: number;
}

export interface S_SystemMessage {
  message: string;
}

export interface S_Tick {
  tick: number;
  serverTime: number;
}

export interface S_Pong {
  t: number;
  serverTime: number;
}

// ---- Party Payloads ----

export interface C_PartyInvite {
  targetEid: number;
}

export interface C_PartyAccept {
  inviterEid: number;
}

export interface C_PartyDecline {
  inviterEid: number;
}

export interface C_PartyKick {
  targetEid: number;
}

export interface C_DungeonEnter {
  portalId: string;
}

export interface S_PartyInvite {
  inviterEid: number;
  inviterName: string;
  partySize: number;
}

export interface S_PartyUpdate {
  partyId: string;
  members: PartyMemberInfo[];
  leadEid: number;
}

export interface S_PartyDissolved {
  reason: "leader_left" | "last_member" | "kicked";
}

export interface S_PartyMemberHp {
  eid: number;
  hp: number;
  maxHp: number;
}

export interface S_DungeonEnter {
  dungeonId: string;
  dungeonName: string;
  instanceId: string;
}

export interface S_DungeonComplete {
  dungeonId: string;
  instanceId: string;
}

export interface S_DungeonWipe {
  instanceId: string;
}

export interface S_DungeonExit {
  returnZoneId: string;
  returnX: number;
  returnY: number;
}

export interface S_BossAbility {
  bossEid: number;
  abilityId: string;
  targetX: number;
  targetY: number;
  radius: number;
}

// ---- NPC / Quest Payloads ----

export interface C_NpcInteract {
  targetEid: number;
}

export interface C_QuestAccept {
  questId: string;
}

export interface C_QuestTurnIn {
  questId: string;
}

export interface S_NpcDialog {
  npcName: string;
  dialog: string;
  availableQuests: string[];
  turnInQuests: string[];
}

export interface S_QuestUpdate {
  questId: string;
  stepIndex: number;
  progress: Record<string, number>;
}

export interface S_QuestComplete {
  questId: string;
}

export interface S_QuestList {
  active: { questId: string; stepIndex: number; progress: Record<string, number> }[];
  completed: string[];
}

// ---- Abilities ----
export interface C_UseSkill {
  abilityId: string;
  targetEid?: number;
}

export interface S_SkillCooldown {
  abilityId: string;
  remainingMs: number;
}

export interface S_StatusEffect {
  targetEid: number;
  effectId: string;
  action: "apply" | "remove" | "tick";
  durationMs?: number;
  stacks?: number;
}

export interface S_AbilityList {
  abilities: { slot: number; abilityId: string; cooldownMs: number }[];
}

// ---- Shop ----
export interface C_ShopBuy {
  npcEid: number;
  itemId: string;
  quantity: number;
}

export interface C_ShopSell {
  npcEid: number;
  inventorySlot: number;
  quantity: number;
}

export interface S_ShopOpen {
  npcName: string;
  items: { itemId: string; buyPrice: number; stock: number }[];
}

// ---- Fishing ----
export interface S_FishBite {
  spotId: string;
}

export interface S_FishResult {
  success: boolean;
  itemId?: string;
  xp?: number;
}

// ---- Discriminated Unions ----

export type ClientMessage =
  | { op: Op.C_AUTH_LOGIN; d: C_AuthLogin }
  | { op: Op.C_AUTH_REGISTER; d: C_AuthRegister }
  | { op: Op.C_MOVE; d: C_Move }
  | { op: Op.C_STOP; d: { seq: number } }
  | { op: Op.C_ATTACK; d: C_Attack }
  | { op: Op.C_FISH_CAST; d: { rodItemId: string } }
  | { op: Op.C_FISH_REEL; d: Record<string, never> }
  | { op: Op.C_COOK_START; d: { recipeId: string } }
  | { op: Op.C_INV_MOVE; d: C_InvMove }
  | { op: Op.C_INV_DROP; d: { slot: number; quantity: number } }
  | { op: Op.C_INV_USE; d: { slot: number } }
  | { op: Op.C_EQUIP; d: C_Equip }
  | { op: Op.C_UNEQUIP; d: C_Unequip }
  | { op: Op.C_PICKUP; d: C_Pickup }
  | { op: Op.C_CHAT_SEND; d: C_ChatSend }
  | { op: Op.C_TRADE_REQUEST; d: { targetEid: number } }
  | { op: Op.C_TRADE_ACCEPT; d: Record<string, never> }
  | { op: Op.C_TRADE_CANCEL; d: Record<string, never> }
  | { op: Op.C_TRADE_SET_ITEM; d: { slot: number; inventorySlot: number; quantity: number } }
  | { op: Op.C_TRADE_CONFIRM; d: Record<string, never> }
  | { op: Op.C_PARTY_INVITE; d: C_PartyInvite }
  | { op: Op.C_PARTY_ACCEPT; d: C_PartyAccept }
  | { op: Op.C_PARTY_DECLINE; d: C_PartyDecline }
  | { op: Op.C_PARTY_LEAVE; d: Record<string, never> }
  | { op: Op.C_PARTY_KICK; d: C_PartyKick }
  | { op: Op.C_DUNGEON_ENTER; d: C_DungeonEnter }
  | { op: Op.C_NPC_INTERACT; d: C_NpcInteract }
  | { op: Op.C_QUEST_ACCEPT; d: C_QuestAccept }
  | { op: Op.C_QUEST_TURN_IN; d: C_QuestTurnIn }
  | { op: Op.C_USE_SKILL; d: C_UseSkill }
  | { op: Op.C_SHOP_BUY; d: C_ShopBuy }
  | { op: Op.C_SHOP_SELL; d: C_ShopSell }
  | { op: Op.C_GOD_TELEPORT; d: C_GodTeleport }
  | { op: Op.C_PING; d: { t: number } };

export type ServerMessage =
  | { op: Op.S_AUTH_OK; d: S_AuthOk }
  | { op: Op.S_AUTH_ERROR; d: S_AuthError }
  | { op: Op.S_ENTER_ZONE; d: S_EnterZone }
  | { op: Op.S_ENTITY_SPAWN; d: S_EntitySpawn }
  | { op: Op.S_ENTITY_DESPAWN; d: S_EntityDespawn }
  | { op: Op.S_ENTITY_MOVE; d: S_EntityMove }
  | { op: Op.S_ENTITY_STOP; d: S_EntityStop }
  | { op: Op.S_PLAYER_STATS; d: S_PlayerStats }
  | { op: Op.S_DAMAGE; d: S_Damage }
  | { op: Op.S_DEATH; d: S_Death }
  | { op: Op.S_RESPAWN; d: S_Respawn }
  | { op: Op.S_INV_UPDATE; d: S_InvUpdate }
  | { op: Op.S_EQUIP_UPDATE; d: S_EquipUpdate }
  | { op: Op.S_XP_GAIN; d: S_XpGain }
  | { op: Op.S_LEVEL_UP; d: S_LevelUp }
  | { op: Op.S_CHAT_MESSAGE; d: S_ChatMessage }
  | { op: Op.S_SYSTEM_MESSAGE; d: S_SystemMessage }
  | { op: Op.S_PARTY_INVITE; d: S_PartyInvite }
  | { op: Op.S_PARTY_UPDATE; d: S_PartyUpdate }
  | { op: Op.S_PARTY_DISSOLVED; d: S_PartyDissolved }
  | { op: Op.S_PARTY_MEMBER_HP; d: S_PartyMemberHp }
  | { op: Op.S_DUNGEON_ENTER; d: S_DungeonEnter }
  | { op: Op.S_DUNGEON_COMPLETE; d: S_DungeonComplete }
  | { op: Op.S_DUNGEON_WIPE; d: S_DungeonWipe }
  | { op: Op.S_DUNGEON_EXIT; d: S_DungeonExit }
  | { op: Op.S_BOSS_ABILITY; d: S_BossAbility }
  | { op: Op.S_NPC_DIALOG; d: S_NpcDialog }
  | { op: Op.S_QUEST_UPDATE; d: S_QuestUpdate }
  | { op: Op.S_QUEST_COMPLETE; d: S_QuestComplete }
  | { op: Op.S_QUEST_LIST; d: S_QuestList }
  | { op: Op.S_SKILL_COOLDOWN; d: S_SkillCooldown }
  | { op: Op.S_STATUS_EFFECT; d: S_StatusEffect }
  | { op: Op.S_ABILITY_LIST; d: S_AbilityList }
  | { op: Op.S_SHOP_OPEN; d: S_ShopOpen }
  | { op: Op.S_FISH_BITE; d: S_FishBite }
  | { op: Op.S_FISH_RESULT; d: S_FishResult }
  | { op: Op.S_TICK; d: S_Tick }
  | { op: Op.S_PONG; d: S_Pong };
