import type { QuestDef } from "../types/quest.js";

export const QUESTS: Record<string, QuestDef> = {
  pest_control: {
    id: "pest_control",
    name: "Pest Control",
    description: "The village chickens are getting out of hand. Cull the flock.",
    steps: [
      { description: "Kill 5 chickens", type: "kill", target: "chicken", quantity: 5 },
    ],
    rewards: { xp: { melee: 50 }, gold: 25 },
  },
  goblin_menace: {
    id: "goblin_menace",
    name: "Goblin Menace",
    description: "Goblins have been spotted in the Darkwood Forest. Thin their numbers.",
    requirements: { quests: ["pest_control"] },
    steps: [
      { description: "Kill 10 goblins", type: "kill", target: "goblin", quantity: 10 },
    ],
    rewards: { xp: { melee: 150 }, items: [{ itemId: "iron_sword", quantity: 1 }], gold: 50 },
  },
  spider_silk: {
    id: "spider_silk",
    name: "Spider Silk",
    description: "Forest spiders are infesting the clearings. Clear them out.",
    requirements: { quests: ["pest_control"] },
    steps: [
      { description: "Kill 8 forest spiders", type: "kill", target: "forest_spider", quantity: 8 },
    ],
    rewards: { xp: { melee: 200, defense: 100 }, gold: 75 },
  },
  into_the_warren: {
    id: "into_the_warren",
    name: "Into the Warren",
    description: "The Goblin Chieftain must be defeated. Enter the Goblin Warren and slay the Chieftain.",
    requirements: { quests: ["goblin_menace"] },
    steps: [
      { description: "Defeat the Goblin Chieftain", type: "kill", target: "goblin_chieftain", quantity: 1 },
    ],
    rewards: { xp: { melee: 500 }, gold: 200 },
  },
  the_lichs_end: {
    id: "the_lichs_end",
    name: "The Lich's End",
    description: "A powerful Lich dwells in the Crypt of Bones. End his reign of terror.",
    requirements: { quests: ["into_the_warren"] },
    steps: [
      { description: "Defeat the Lich King", type: "kill", target: "lich_king", quantity: 1 },
    ],
    rewards: { xp: { melee: 1000, defense: 500 }, gold: 500 },
  },
  forest_exploration: {
    id: "forest_exploration",
    name: "Into the Wild",
    description: "Explore the Darkwood Forest to learn the lay of the land.",
    requirements: { quests: ["pest_control"] },
    steps: [
      { description: "Travel to Darkwood Forest", type: "reach", target: "darkwood", quantity: 1 },
    ],
    rewards: { xp: { agility: 100 }, gold: 30 },
  },
  field_survey: {
    id: "field_survey",
    name: "Field Survey",
    description: "The Guard needs someone to scout the Open Fields.",
    requirements: { quests: ["pest_control"] },
    steps: [
      { description: "Travel to the Open Fields", type: "reach", target: "fields", quantity: 1 },
    ],
    rewards: { xp: { agility: 100 }, gold: 30 },
  },
  lyras_supplies: {
    id: "lyras_supplies",
    name: "Lyra's Supplies",
    description: "Merchant Lyra needs herbs from the forest. Gather some and bring them to her.",
    requirements: { quests: ["pest_control"] },
    steps: [
      { description: "Collect 5 herbs", type: "gather", target: "herb", quantity: 5 },
      { description: "Deliver herbs to Merchant Lyra", type: "deliver", target: "shopkeeper", quantity: 5 },
    ],
    rewards: { xp: { foraging: 75 }, items: [{ itemId: "bread", quantity: 10 }], gold: 60 },
  },
};
