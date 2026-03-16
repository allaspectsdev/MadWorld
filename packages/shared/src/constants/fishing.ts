export interface FishingSpotDef {
  id: string;
  fish: string;
  levelReq: number;
  baseXp: number;
  catchTicks: number;
}

export const FISHING_SPOTS: FishingSpotDef[] = [
  { id: "shrimp_spot", fish: "raw_shrimp", levelReq: 1, baseXp: 10, catchTicks: 30 },
  { id: "trout_spot", fish: "raw_trout", levelReq: 15, baseXp: 30, catchTicks: 50 },
];
