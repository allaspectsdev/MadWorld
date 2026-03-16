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
  highland_patrol: {
    id: "highland_patrol", name: "Highland Patrol", description: "Scout Ember needs help clearing the scorched highlands of dangerous creatures.",
    requirements: { quests: ["goblin_menace"] },
    steps: [
      { description: "Kill 8 Fire Imps", type: "kill", target: "fire_imp", quantity: 8 },
      { description: "Kill 5 Lava Beetles", type: "kill", target: "lava_beetle", quantity: 5 },
    ],
    rewards: { xp: { melee: 200 }, gold: 100 },
  },
  lava_beetles: {
    id: "lava_beetles", name: "Elemental Threat", description: "The Magma Elementals near the lava lake are growing in power. Destroy them before they become unstoppable.",
    requirements: { quests: ["highland_patrol"] },
    steps: [{ description: "Kill 10 Magma Elementals", type: "kill", target: "magma_elemental", quantity: 10 }],
    rewards: { xp: { melee: 300 }, gold: 150 },
  },
  dragon_lair_key: {
    id: "dragon_lair_key", name: "Path to the Dragon", description: "Clear the Scorched Warriors guarding the Dragon's Lair entrance and venture inside.",
    requirements: { quests: ["lava_beetles"] },
    steps: [
      { description: "Kill 5 Scorched Warriors", type: "kill", target: "scorched_warrior", quantity: 5 },
      { description: "Enter the Dragon's Lair", type: "reach", target: "dragons_lair", quantity: 1 },
    ],
    rewards: { xp: { melee: 250 }, items: [{ itemId: "steel_sword", quantity: 1 }] },
  },
  frozen_hunt: {
    id: "frozen_hunt", name: "Frozen Hunt", description: "Ranger Frost needs help thinning the predators in the Frozen Wastes.",
    requirements: { quests: ["spider_silk"] },
    steps: [
      { description: "Kill 6 Frost Wolves", type: "kill", target: "frost_wolf", quantity: 6 },
      { description: "Kill 4 Ice Wraiths", type: "kill", target: "ice_wraith", quantity: 4 },
    ],
    rewards: { xp: { melee: 400 }, gold: 200 },
  },
  crystal_shards: {
    id: "crystal_shards", name: "Crystal Shards", description: "Ranger Frost believes Crystal Cores hold the key to weakening the Elder Drake's defenses.",
    requirements: { quests: ["frozen_hunt"] },
    steps: [
      { description: "Collect 3 Crystal Cores", type: "gather", target: "crystal_core", quantity: 3 },
      { description: "Deliver cores to Ranger Frost", type: "deliver", target: "ranger_frost", quantity: 3 },
    ],
    rewards: { xp: { melee: 500 }, gold: 300 },
  },
  slay_the_drake: {
    id: "slay_the_drake", name: "Slay the Drake", description: "The Elder Drake threatens all the lands. Enter its lair and end its reign of fire.",
    requirements: { quests: ["crystal_shards"] },
    steps: [{ description: "Defeat the Elder Drake", type: "kill", target: "elder_drake", quantity: 1 }],
    rewards: { xp: { melee: 1000 }, gold: 500 },
  },
};
