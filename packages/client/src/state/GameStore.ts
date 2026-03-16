import { create } from "zustand";
import type { EntityType, TileType, Appearance, PartyMemberInfo, S_ChatMessage, LightDef } from "@madworld/shared";

export interface InventorySlot {
  itemId: string;
  quantity: number;
}

export interface RemoteEntity {
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
  zoneLights: LightDef[] | null;

  // Party
  party: { partyId: string; members: PartyMemberInfo[]; leadEid: number } | null;
  partyInvite: { inviterEid: number; inviterName: string; partySize: number } | null;

  // Dungeon
  inDungeon: boolean;
  dungeonName: string | null;

  // Quests
  quests: { questId: string; stepIndex: number; progress: Record<string, number> }[];
  completedQuests: string[];
  questLogOpen: boolean;
  npcDialog: { npcName: string; dialog: string; availableQuests: string[]; turnInQuests: string[] } | null;
  setQuests: (quests: { questId: string; stepIndex: number; progress: Record<string, number> }[]) => void;
  setCompletedQuests: (completed: string[]) => void;
  updateQuest: (questId: string, stepIndex: number, progress: Record<string, number>) => void;
  completeQuest: (questId: string) => void;
  toggleQuestLog: () => void;
  setNpcDialog: (dialog: { npcName: string; dialog: string; availableQuests: string[]; turnInQuests: string[] } | null) => void;

  // Abilities & Shop
  abilities: { slot: number; abilityId: string; cooldownMs: number }[];
  shopData: { npcName: string; items: { itemId: string; buyPrice: number; stock: number }[] } | null;
  setAbilities: (abilities: { slot: number; abilityId: string; cooldownMs: number }[]) => void;
  setAbilityCooldown: (abilityId: string, remainingMs: number) => void;
  setShopData: (data: { npcName: string; items: { itemId: string; buyPrice: number; stock: number }[] } | null) => void;

  // Inventory & Equipment
  inventory: (InventorySlot | null)[];
  equipment: Record<string, string>;
  inventoryOpen: boolean;
  setInventory: (slots: { index: number; itemId: string | null; quantity: number }[]) => void;
  setEquipment: (slot: string, itemId: string | null) => void;
  toggleInventory: () => void;

  // Chat
  chatMessages: S_ChatMessage[];
  chatOpen: boolean;
  addChatMessage: (msg: S_ChatMessage) => void;
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;

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
    lights?: LightDef[],
  ) => void;

  setParty: (party: GameState["party"]) => void;
  setPartyInvite: (invite: GameState["partyInvite"]) => void;
  updatePartyMemberHp: (eid: number, hp: number, maxHp: number) => void;
  setInDungeon: (inDungeon: boolean, name?: string) => void;

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
  zoneLights: null,

  party: null,
  partyInvite: null,
  inDungeon: false,
  dungeonName: null,

  quests: [],
  completedQuests: [],
  questLogOpen: false,
  npcDialog: null,
  setQuests: (quests) => set({ quests }),
  setCompletedQuests: (completed) => set({ completedQuests: completed }),
  updateQuest: (questId, stepIndex, progress) =>
    set((state) => {
      const existing = state.quests.find((q) => q.questId === questId);
      if (existing) {
        return {
          quests: state.quests.map((q) =>
            q.questId === questId ? { ...q, stepIndex, progress } : q,
          ),
        };
      }
      return { quests: [...state.quests, { questId, stepIndex, progress }] };
    }),
  completeQuest: (questId) =>
    set((state) => ({
      quests: state.quests.filter((q) => q.questId !== questId),
      completedQuests: [...state.completedQuests, questId],
    })),
  toggleQuestLog: () => set((state) => ({ questLogOpen: !state.questLogOpen })),
  setNpcDialog: (dialog) => set({ npcDialog: dialog }),

  abilities: [],
  shopData: null,
  setAbilities: (abilities) => set({ abilities }),
  setAbilityCooldown: (abilityId, remainingMs) =>
    set((state) => ({
      abilities: state.abilities.map((a) =>
        a.abilityId === abilityId ? { ...a, cooldownMs: remainingMs } : a,
      ),
    })),
  setShopData: (data) => set({ shopData: data }),

  inventory: new Array<InventorySlot | null>(28).fill(null),
  equipment: {},
  inventoryOpen: false,
  setInventory: (slots) =>
    set((state) => {
      const inv = [...state.inventory];
      for (const s of slots) {
        if (s.index >= 0 && s.index < 28) {
          inv[s.index] = s.itemId ? { itemId: s.itemId, quantity: s.quantity } : null;
        }
      }
      return { inventory: inv };
    }),
  setEquipment: (slot, itemId) =>
    set((state) => {
      const equipment = { ...state.equipment };
      if (itemId) {
        equipment[slot] = itemId;
      } else {
        delete equipment[slot];
      }
      return { equipment };
    }),
  toggleInventory: () => set((state) => ({ inventoryOpen: !state.inventoryOpen })),

  chatMessages: [],
  chatOpen: false,
  addChatMessage: (msg) =>
    set((state) => {
      const msgs = [...state.chatMessages, msg];
      if (msgs.length > 100) msgs.shift();
      return { chatMessages: msgs };
    }),
  toggleChat: () => set((state) => ({ chatOpen: !state.chatOpen })),
  setChatOpen: (open) => set({ chatOpen: open }),

  setConnected: (v) => set({ connected: v }),
  setToken: (t) => set({ token: t }),
  setLocalPlayer: (p) => set({ localPlayer: p }),
  updateLocalPlayer: (updates) =>
    set((state) => ({
      localPlayer: state.localPlayer ? { ...state.localPlayer, ...updates } : null,
    })),
  setZone: (zoneId, name, width, height, tiles, lights) =>
    set({
      zoneWidth: width,
      zoneHeight: height,
      tiles,
      zoneLights: lights ?? null,
      entities: new Map(),
    }),

  setParty: (party) => set({ party }),
  setPartyInvite: (invite) => set({ partyInvite: invite }),
  updatePartyMemberHp: (eid, hp, maxHp) =>
    set((state) => {
      if (!state.party) return {};
      const members = state.party.members.map((m) =>
        m.eid === eid ? { ...m, hp, maxHp } : m,
      );
      return { party: { ...state.party, members } };
    }),
  setInDungeon: (inDungeon, name) => set({ inDungeon, dungeonName: name ?? null }),

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
