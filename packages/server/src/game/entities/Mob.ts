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

  constructor(def: MobDef, zoneId: string, x: number, y: number, wanderRadius: number) {
    super(EntityType.MOB, zoneId, x, y);
    this.def = def;
    this.hp = def.maxHp;
    this.spawnX = x;
    this.spawnY = y;
    this.wanderRadius = wanderRadius;
    this.speed = 2;
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
  }
}
