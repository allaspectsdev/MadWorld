export interface PartyMemberInfo {
  eid: number;
  playerId: number;
  name: string;
  hp: number;
  maxHp: number;
  level: number;
  zoneId: string;
  zoneName: string;
  isLeader: boolean;
  /** World position for map display (party members visible through fog). */
  worldX?: number;
  worldY?: number;
}
