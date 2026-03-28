import { Entity } from "./Entity.js";
import { EntityType, AIState, type MobDef } from "@madworld/shared";

/** Elite multiplier applied to HP, checked in CombatSystem for XP/loot. */
export const ELITE_HP_MULTIPLIER = 3;
/** Threshold for the elite roll (0..1). Values below this → elite. */
export const ELITE_CHANCE = 0.05;

export class Mob extends Entity {
  def: MobDef;
  hp: number;
  /** Effective max HP (accounts for elite multiplier). Set once in constructor. */
  maxHp: number;
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

  // Elite variant
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

  /**
   * @param eliteRoll  A value in [0, 1). If < ELITE_CHANCE the mob becomes
   *                   elite. Pass a seeded RNG value for deterministic chunks,
   *                   or omit to use Math.random() (legacy/static zones).
   */
  constructor(
    def: MobDef,
    zoneId: string,
    x: number,
    y: number,
    wanderRadius: number,
    eliteRoll?: number,
  ) {
    super(EntityType.MOB, zoneId, x, y);
    this.def = def;
    this.spawnX = x;
    this.spawnY = y;
    this.wanderRadius = wanderRadius;
    this.speed = 2;
    this.isBoss = def.isBoss ?? false;

    // Elite determination — use provided roll for determinism, fall back to Math.random()
    this.isElite = !this.isBoss && (eliteRoll ?? Math.random()) < ELITE_CHANCE;
    this.maxHp = this.isElite ? def.maxHp * ELITE_HP_MULTIPLIER : def.maxHp;
    this.hp = this.maxHp;

    if (this.isBoss && def.bossAbilities) {
      for (const ability of def.bossAbilities) {
        this.abilityCooldowns.set(ability.id, ability.cooldownTicks);
      }
    }
  }

  reset(): void {
    this.hp = this.maxHp;
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
