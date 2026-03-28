import { Entity } from "./Entity.js";
import { EntityType, AIState, type MobDef } from "@madworld/shared";

export class Mob extends Entity {
  def: MobDef;
  hp: number;
  aiState: AIState = AIState.IDLE;
  targetEid: number | null = null;
  spawnX: number;
  spawnY: number;
  wanderRadius: number;
  respawnTimer: number = 0;
  attackCooldown: number = 0;
  idleTicks: number = 0;
  patrolTarget: { x: number; y: number } | null = null;

  // Status effects
  statusEffects: Map<string, { defId: string; ticksLeft: number; sourceEid: number }> = new Map();
  stunTicks: number = 0;

  // Elite variant (5% chance, 3x HP, 2x loot/XP)
  isElite: boolean;

  // Boss fields
  isBoss: boolean;
  abilityCooldowns: Map<string, number> = new Map();
  threatMap: Map<number, number> = new Map();

  /**
   * Tick-based pending actions queue. Each entry fires when
   * currentTick >= fireTick. Used for boss telegraph damage
   * instead of setTimeout so it stays inside the tick cadence.
   */
  pendingActions: Array<{ fireTick: number; action: () => void }> = [];

  constructor(def: MobDef, zoneId: string, x: number, y: number, wanderRadius: number) {
    super(EntityType.MOB, zoneId, x, y);
    this.def = def;
    this.hp = def.maxHp;
    this.spawnX = x;
    this.spawnY = y;
    this.wanderRadius = wanderRadius;
    this.speed = 2;
    this.isBoss = def.isBoss ?? false;
    this.isElite = !this.isBoss && Math.random() < 0.05;
    if (this.isElite) {
      this.hp = def.maxHp * 3;
    }

    if (this.isBoss && def.bossAbilities) {
      for (const ability of def.bossAbilities) {
        this.abilityCooldowns.set(ability.id, ability.cooldownTicks);
      }
    }
  }

  reset(): void {
    this.hp = this.def.maxHp;
    this.aiState = AIState.IDLE;
    this.targetEid = null;
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.dx = 0;
    this.dy = 0;
    this.attackCooldown = 0;
    this.idleTicks = 0;
    this.patrolTarget = null;
    this.threatMap.clear();
    this.statusEffects.clear();
    this.stunTicks = 0;
    this.pendingActions = [];
    if (this.isBoss && this.def.bossAbilities) {
      for (const ability of this.def.bossAbilities) {
        this.abilityCooldowns.set(ability.id, ability.cooldownTicks);
      }
    }
  }
}
