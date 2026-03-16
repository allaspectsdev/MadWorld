import { Player } from "../entities/Player.js";
import { Op, QUESTS, ITEMS, type ServerMessage, type SkillName, levelForXp } from "@madworld/shared";
import { loadQuestProgress, saveQuestProgress } from "../../services/PlayerService.js";

// Player quest state (in-memory, backed by DB)
export interface PlayerQuestState {
  active: Map<string, { stepIndex: number; progress: Map<string, number> }>;
  completed: Set<string>;
}

// Store quest state per player eid
const questStates = new Map<number, PlayerQuestState>();

export function getQuestState(player: Player): PlayerQuestState {
  let state = questStates.get(player.eid);
  if (!state) {
    state = { active: new Map(), completed: new Set() };
    questStates.set(player.eid, state);
  }
  return state;
}

export async function initQuestState(player: Player): Promise<void> {
  const state: PlayerQuestState = {
    active: new Map(),
    completed: new Set(),
  };

  // Load saved quest progress from DB
  const saved = await loadQuestProgress(player.playerId);
  for (const row of saved) {
    if (row.completed) {
      state.completed.add(row.questId);
    } else {
      const progress = new Map<string, number>();
      if (row.data) {
        for (const [k, v] of Object.entries(row.data)) {
          progress.set(k, v as number);
        }
      }
      state.active.set(row.questId, { stepIndex: row.step, progress });
    }
  }

  questStates.set(player.eid, state);
}

export async function persistQuestState(player: Player): Promise<void> {
  const state = questStates.get(player.eid);
  if (!state) return;

  // Save active quests
  for (const [questId, quest] of state.active) {
    const data: Record<string, number> = {};
    for (const [k, v] of quest.progress) data[k] = v;
    await saveQuestProgress(player.playerId, questId, quest.stepIndex, false, data);
  }

  // Save completed quests
  for (const questId of state.completed) {
    await saveQuestProgress(player.playerId, questId, 0, true);
  }
}

export function cleanupQuestState(playerEid: number): void {
  questStates.delete(playerEid);
}

export function canAcceptQuest(player: Player, questId: string): boolean {
  const quest = QUESTS[questId];
  if (!quest) return false;

  const state = getQuestState(player);
  if (state.active.has(questId)) return false;
  if (state.completed.has(questId)) return false;

  // Check prerequisite quests
  if (quest.requirements?.quests) {
    for (const reqId of quest.requirements.quests) {
      if (!state.completed.has(reqId)) return false;
    }
  }

  // Check skill requirements
  if (quest.requirements?.skills) {
    for (const [skill, reqLevel] of Object.entries(quest.requirements.skills)) {
      const skillData = player.skills.get(skill as SkillName);
      if (!skillData) return false;
      if (levelForXp(skillData.xp) < reqLevel!) return false;
    }
  }

  return true;
}

export function acceptQuest(player: Player, questId: string): void {
  if (!canAcceptQuest(player, questId)) return;

  const state = getQuestState(player);
  state.active.set(questId, { stepIndex: 0, progress: new Map() });

  const progress: Record<string, number> = {};
  player.send({
    op: Op.S_QUEST_UPDATE,
    d: { questId, stepIndex: 0, progress },
  } satisfies ServerMessage);

  player.send({
    op: Op.S_SYSTEM_MESSAGE,
    d: { message: `Quest accepted: ${QUESTS[questId].name}` },
  } satisfies ServerMessage);
}

export function onMobKill(player: Player, mobId: string): void {
  const state = getQuestState(player);

  for (const [questId, questProgress] of state.active) {
    const quest = QUESTS[questId];
    if (!quest) continue;

    const step = quest.steps[questProgress.stepIndex];
    if (!step || step.type !== "kill") continue;
    if (step.target !== mobId) continue;

    const current = questProgress.progress.get(step.target) ?? 0;
    const required = step.quantity ?? 1;
    if (current >= required) continue;

    const newCount = current + 1;
    questProgress.progress.set(step.target, newCount);

    const progress: Record<string, number> = {};
    for (const [k, v] of questProgress.progress) {
      progress[k] = v;
    }

    player.send({
      op: Op.S_QUEST_UPDATE,
      d: { questId, stepIndex: questProgress.stepIndex, progress },
    } satisfies ServerMessage);

    if (newCount >= required) {
      player.send({
        op: Op.S_SYSTEM_MESSAGE,
        d: { message: `Quest objective complete: ${step.description}` },
      } satisfies ServerMessage);
    }
  }
}

export function onItemPickup(player: Player, itemId: string): void {
  const state = getQuestState(player);

  for (const [questId, questProgress] of state.active) {
    const quest = QUESTS[questId];
    if (!quest) continue;

    const step = quest.steps[questProgress.stepIndex];
    if (!step || step.type !== "gather") continue;
    if (step.target !== itemId) continue;

    const current = questProgress.progress.get(step.target) ?? 0;
    const required = step.quantity ?? 1;
    if (current >= required) continue;

    const newCount = current + 1;
    questProgress.progress.set(step.target, newCount);

    const progress: Record<string, number> = {};
    for (const [k, v] of questProgress.progress) {
      progress[k] = v;
    }

    player.send({
      op: Op.S_QUEST_UPDATE,
      d: { questId, stepIndex: questProgress.stepIndex, progress },
    } satisfies ServerMessage);

    if (newCount >= required) {
      player.send({
        op: Op.S_SYSTEM_MESSAGE,
        d: { message: `Quest objective complete: ${step.description}` },
      } satisfies ServerMessage);
    }
  }
}

export function onZoneEnter(player: Player, zoneId: string): void {
  const state = getQuestState(player);

  for (const [questId, questProgress] of state.active) {
    const quest = QUESTS[questId];
    if (!quest) continue;

    const step = quest.steps[questProgress.stepIndex];
    if (!step || step.type !== "reach") continue;
    if (step.target !== zoneId) continue;

    const current = questProgress.progress.get(step.target) ?? 0;
    if (current >= 1) continue;

    questProgress.progress.set(step.target, 1);

    const progress: Record<string, number> = {};
    for (const [k, v] of questProgress.progress) {
      progress[k] = v;
    }

    player.send({
      op: Op.S_QUEST_UPDATE,
      d: { questId, stepIndex: questProgress.stepIndex, progress },
    } satisfies ServerMessage);

    player.send({
      op: Op.S_SYSTEM_MESSAGE,
      d: { message: `Quest objective complete: ${step.description}` },
    } satisfies ServerMessage);
  }
}

function isQuestReadyToTurnIn(state: PlayerQuestState, questId: string): boolean {
  const questProgress = state.active.get(questId);
  if (!questProgress) return false;

  const quest = QUESTS[questId];
  if (!quest) return false;

  // Check all steps are complete
  for (let i = 0; i <= questProgress.stepIndex; i++) {
    const step = quest.steps[i];
    if (!step) continue;
    if (step.type === "kill" || step.type === "gather") {
      const current = questProgress.progress.get(step.target) ?? 0;
      const required = step.quantity ?? 1;
      if (current < required) return false;
    }
    if (step.type === "reach") {
      const current = questProgress.progress.get(step.target) ?? 0;
      if (current < 1) return false;
    }
  }

  // Must be on last step (or past it) and that step must be complete
  if (questProgress.stepIndex < quest.steps.length - 1) return false;

  return true;
}

export function turnInQuest(player: Player, questId: string): void {
  const state = getQuestState(player);

  if (!isQuestReadyToTurnIn(state, questId)) return;

  const quest = QUESTS[questId];
  if (!quest) return;

  // Grant rewards
  if (quest.rewards.xp) {
    for (const [skill, xp] of Object.entries(quest.rewards.xp)) {
      if (xp === undefined) continue;
      const skillData = player.skills.get(skill as SkillName);
      if (!skillData) continue;
      const oldLevel = levelForXp(skillData.xp);
      skillData.xp += xp;
      const newLevel = levelForXp(skillData.xp);

      player.send({
        op: Op.S_XP_GAIN,
        d: { skillId: skill, xp, totalXp: skillData.xp },
      } satisfies ServerMessage);

      if (newLevel > oldLevel) {
        player.send({
          op: Op.S_LEVEL_UP,
          d: { skillId: skill, newLevel },
        } satisfies ServerMessage);
      }
    }
  }

  // Grant gold as gold_coins in inventory
  if (quest.rewards.gold && quest.rewards.gold > 0) {
    addItemToInventory(player, "gold_coins", quest.rewards.gold);
  }

  // Grant item rewards
  if (quest.rewards.items) {
    for (const item of quest.rewards.items) {
      addItemToInventory(player, item.itemId, item.quantity);
    }
  }

  // Mark completed
  state.active.delete(questId);
  state.completed.add(questId);
  player.dirty = true;

  player.send({
    op: Op.S_QUEST_COMPLETE,
    d: { questId },
  } satisfies ServerMessage);

  player.send({
    op: Op.S_SYSTEM_MESSAGE,
    d: { message: `Quest complete: ${quest.name}` },
  } satisfies ServerMessage);
}

function addItemToInventory(player: Player, itemId: string, quantity: number): void {
  const itemDef = ITEMS[itemId];

  // Try to stack with existing item first
  let slotIndex = -1;
  if (itemDef && itemDef.stackable) {
    for (let i = 0; i < player.inventory.length; i++) {
      const slot = player.inventory[i];
      if (slot && slot.itemId === itemId && slot.quantity < itemDef.maxStack) {
        slotIndex = i;
        break;
      }
    }
  }

  // Otherwise find first empty slot
  if (slotIndex === -1) {
    slotIndex = player.inventory.indexOf(null);
  }
  if (slotIndex === -1) return; // Inventory full

  const existing = player.inventory[slotIndex];
  if (existing && existing.itemId === itemId) {
    existing.quantity += quantity;
  } else {
    player.inventory[slotIndex] = { itemId, quantity };
  }

  player.send({
    op: Op.S_INV_UPDATE,
    d: {
      slots: [{
        index: slotIndex,
        itemId: player.inventory[slotIndex]!.itemId,
        quantity: player.inventory[slotIndex]!.quantity,
      }],
    },
  } satisfies ServerMessage);

  player.dirty = true;
}

export function sendQuestList(player: Player): void {
  const state = getQuestState(player);

  const active: { questId: string; stepIndex: number; progress: Record<string, number> }[] = [];
  for (const [questId, qp] of state.active) {
    const progress: Record<string, number> = {};
    for (const [k, v] of qp.progress) {
      progress[k] = v;
    }
    active.push({ questId, stepIndex: qp.stepIndex, progress });
  }

  const completed = [...state.completed];

  player.send({
    op: Op.S_QUEST_LIST,
    d: { active, completed },
  } satisfies ServerMessage);
}

export function getAvailableQuests(player: Player, npcQuests: string[]): { available: string[]; turnIn: string[] } {
  const state = getQuestState(player);
  const available: string[] = [];
  const turnIn: string[] = [];

  for (const questId of npcQuests) {
    if (isQuestReadyToTurnIn(state, questId)) {
      turnIn.push(questId);
    } else if (canAcceptQuest(player, questId)) {
      available.push(questId);
    }
  }

  return { available, turnIn };
}
