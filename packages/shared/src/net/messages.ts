import { Op } from "./opcodes.js";
import type { EntityType } from "../types/entity.js";
import type { TileType } from "../types/map.js";
import type { Appearance } from "../types/player.js";

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
}

export interface S_EntitySpawn {
  eid: number;
  type: EntityType;
  x: number;
  y: number;
  name?: string;
  appearance?: Appearance;
  hp?: number;
  maxHp?: number;
  level?: number;
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
  | { op: Op.S_TICK; d: S_Tick }
  | { op: Op.S_PONG; d: S_Pong };
