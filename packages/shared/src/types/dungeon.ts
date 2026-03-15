export interface BossAbilityDef {
  id: string;
  name: string;
  damage: number;
  radius: number;
  cooldownTicks: number;
  telegraphTicks: number;
}

export interface DungeonDef {
  id: string;
  name: string;
  minLevel: number;
  entrancePortalZoneId: string;
  entrancePortalX: number;
  entrancePortalY: number;
  exitReturnZoneId: string;
  exitReturnX: number;
  exitReturnY: number;
  bossId: string;
}
