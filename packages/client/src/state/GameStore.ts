import { create } from "zustand";
import type { EntityType, TileType, Appearance } from "@madworld/shared";

export interface RemoteEntity {
  eid: number;
  type: EntityType;
  x: number;
  y: number;
  name?: string;
  appearance?: Appearance;
  hp?: number;
  maxHp?: number;
  level?: number;
  // Interpolation state
  prevX: number;
  prevY: number;
  prevTime: number;
  nextX: number;
  nextY: number;
  nextTime: number;
}

export interface LocalPlayer {
  eid: number;
  playerId: number;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  zoneId: string;
  zoneName: string;
  isDead: boolean;
}

export interface GameState {
  connected: boolean;
  token: string | null;
  currentTick: number;
  serverTimeOffset: number;

  localPlayer: LocalPlayer | null;
  entities: Map<number, RemoteEntity>;

  zoneWidth: number;
  zoneHeight: number;
  tiles: TileType[][] | null;

  setConnected: (v: boolean) => void;
  setToken: (t: string) => void;
  setLocalPlayer: (p: LocalPlayer) => void;
  updateLocalPlayer: (updates: Partial<LocalPlayer>) => void;
  setZone: (
    zoneId: string,
    name: string,
    width: number,
    height: number,
    tiles: TileType[][],
  ) => void;

  spawnEntity: (e: RemoteEntity) => void;
  despawnEntity: (eid: number) => void;
  updateEntityPosition: (
    eid: number,
    x: number,
    y: number,
  ) => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  connected: false,
  token: null,
  currentTick: 0,
  serverTimeOffset: 0,

  localPlayer: null,
  entities: new Map(),

  zoneWidth: 0,
  zoneHeight: 0,
  tiles: null,

  setConnected: (v) => set({ connected: v }),
  setToken: (t) => set({ token: t }),
  setLocalPlayer: (p) => set({ localPlayer: p }),
  updateLocalPlayer: (updates) =>
    set((state) => ({
      localPlayer: state.localPlayer ? { ...state.localPlayer, ...updates } : null,
    })),
  setZone: (zoneId, name, width, height, tiles) =>
    set({
      zoneWidth: width,
      zoneHeight: height,
      tiles,
      entities: new Map(),
    }),

  spawnEntity: (e) =>
    set((state) => {
      const entities = new Map(state.entities);
      entities.set(e.eid, e);
      return { entities };
    }),
  despawnEntity: (eid) =>
    set((state) => {
      const entities = new Map(state.entities);
      entities.delete(eid);
      return { entities };
    }),
  updateEntityPosition: (eid, x, y) =>
    set((state) => {
      const entities = new Map(state.entities);
      const e = entities.get(eid);
      if (e) {
        const now = performance.now();
        entities.set(eid, {
          ...e,
          prevX: e.nextX,
          prevY: e.nextY,
          prevTime: e.nextTime,
          nextX: x,
          nextY: y,
          nextTime: now,
        });
      }
      return { entities };
    }),
}));
