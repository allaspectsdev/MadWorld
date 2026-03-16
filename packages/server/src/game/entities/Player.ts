import { Entity } from "./Entity.js";
import {
  EntityType,
  type Appearance,
  type SkillName,
  ALL_SKILLS,
  PLAYER_SPEED,
  INVENTORY_SIZE,
} from "@madworld/shared";
import type { ServerWebSocket } from "bun";

export interface InventorySlot {
  itemId: string;
  quantity: number;
}

export interface SkillData {
  xp: number;
}

export class Player extends Entity {
  playerId: number;
  userId: number;
  name: string;
  appearance: Appearance;
  isGod: boolean;

  hp: number;
  maxHp: number;

  skills: Map<SkillName, SkillData> = new Map();
  inventory: (InventorySlot | null)[];
  equipment: Map<string, string> = new Map(); // slot -> itemId

  ws: ServerWebSocket<unknown> | null = null;

  // Movement
  lastMoveSeq: number = 0;
  moveQueue: { dx: number; dy: number; seq: number }[] = [];

  // Combat
  combatTarget: number | null = null;
  attackCooldown: number = 0;
  lastRangeMsg: number = 0;
  outOfRangeTicks: number = 0;

  // Abilities
  abilityCooldowns: Map<string, number> = new Map();
  statusEffects: Map<string, { defId: string; ticksLeft: number; sourceEid: number }> = new Map();
  stunTicks: number = 0;
  invulnerableTicks: number = 0;
  speedMultiplier: number = 1;
  damageMultiplier: number = 1;

  // Fishing
  fishingState: { startTick: number; fish: string; catchTick: number; biteSent: boolean } | null = null;

  // Party
  partyId: string | null = null;

  // Dungeon return position
  returnZoneId: string | null = null;
  returnX: number = 0;
  returnY: number = 0;

  // Party HP sync throttle
  lastSyncedHp: number = 0;

  // Chat rate limiting
  lastChatTime: number = 0;

  // Death respawn guard
  respawnPending: boolean = false;

  // Persistence
  dirty: boolean = false;

  constructor(
    playerId: number,
    userId: number,
    name: string,
    zoneId: string,
    x: number,
    y: number,
    hp: number,
    maxHp: number,
    appearance: Appearance,
    isGod: boolean = false,
  ) {
    super(EntityType.PLAYER, zoneId, x, y);
    this.playerId = playerId;
    this.userId = userId;
    this.name = name;
    this.hp = hp;
    this.maxHp = maxHp;
    this.appearance = appearance;
    this.isGod = isGod;
    this.speed = PLAYER_SPEED;

    this.inventory = new Array(INVENTORY_SIZE).fill(null);

    for (const skill of ALL_SKILLS) {
      this.skills.set(skill as SkillName, { xp: 0 });
    }
  }

  send(msg: object): void {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
