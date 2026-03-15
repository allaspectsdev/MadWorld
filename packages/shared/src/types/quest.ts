import type { SkillName } from "./skill.js";

export interface QuestStep {
  description: string;
  type: "talk" | "kill" | "gather" | "deliver" | "reach";
  target: string;
  quantity?: number;
}

export interface QuestRewards {
  xp?: Partial<Record<SkillName, number>>;
  items?: { itemId: string; quantity: number }[];
  gold?: number;
}

export interface QuestDef {
  id: string;
  name: string;
  description: string;
  requirements?: {
    skills?: Partial<Record<SkillName, number>>;
    quests?: string[];
  };
  steps: QuestStep[];
  rewards: QuestRewards;
}
