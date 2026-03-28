import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  boolean,
  real,
  smallint,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: varchar("display_name", { length: 32 }).notNull().unique(),
  isBanned: boolean("is_banned").notNull().default(false),
  isGod: boolean("is_god").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const players = pgTable("players", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 24 }).notNull().unique(),
  zoneId: varchar("zone_id", { length: 64 }).notNull().default("greendale"),
  posX: real("pos_x").notNull().default(10),
  posY: real("pos_y").notNull().default(10),
  currentHp: integer("current_hp").notNull().default(100),
  maxHp: integer("max_hp").notNull().default(100),
  appearance: jsonb("appearance").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSavedAt: timestamp("last_saved_at", { withTimezone: true }).notNull().defaultNow(),
});

export const skills = pgTable(
  "skills",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    skillId: varchar("skill_id", { length: 32 }).notNull(),
    xp: integer("xp").notNull().default(0),
  },
  (table) => [uniqueIndex("skills_player_skill_idx").on(table.playerId, table.skillId)],
);

export const inventory = pgTable(
  "inventory",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    slotIndex: smallint("slot_index").notNull(),
    itemId: varchar("item_id", { length: 64 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
  },
  (table) => [uniqueIndex("inventory_player_slot_idx").on(table.playerId, table.slotIndex)],
);

export const equipment = pgTable(
  "equipment",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    slot: varchar("slot", { length: 16 }).notNull(),
    itemId: varchar("item_id", { length: 64 }).notNull(),
  },
  (table) => [uniqueIndex("equipment_player_slot_idx").on(table.playerId, table.slot)],
);

export const questProgress = pgTable("quest_progress", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  questId: varchar("quest_id", { length: 64 }).notNull(),
  step: integer("step").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  data: jsonb("data"),
});

// ---- Pets ----

export const playerPets = pgTable(
  "player_pets",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    petId: varchar("pet_id", { length: 32 }).notNull(),
    name: varchar("name", { length: 24 }).notNull(),
    bondXp: integer("bond_xp").notNull().default(0),
    isActive: boolean("is_active").notNull().default(false),
    tamedAt: timestamp("tamed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("player_pets_player_pet_idx").on(table.playerId, table.petId),
  ],
);

// ---- Procedural world tables ----

export const worldChunks = pgTable(
  "world_chunks",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    worldSeed: integer("world_seed").notNull(),
    chunkX: integer("chunk_x").notNull(),
    chunkY: integer("chunk_y").notNull(),
    biome: varchar("biome", { length: 32 }).notNull(),
    tileData: jsonb("tile_data").notNull(),        // TileType[][] compressed
    mobSpawns: jsonb("mob_spawns").notNull(),       // ChunkMobSpawn[]
    lights: jsonb("lights").notNull(),              // ChunkLight[]
    landmarks: jsonb("landmarks").notNull().default([]), // LandmarkPlacement[]
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("world_chunks_seed_pos_idx").on(table.worldSeed, table.chunkX, table.chunkY),
  ],
);

export const partyCamps = pgTable(
  "party_camps",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    partyId: varchar("party_id", { length: 64 }).notNull(),
    ownerPlayerId: integer("owner_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 32 }).notNull().default("Camp"),
    worldX: real("world_x").notNull(),
    worldY: real("world_y").notNull(),
    chunkX: integer("chunk_x").notNull(),
    chunkY: integer("chunk_y").notNull(),
    tier: smallint("tier").notNull().default(1), // 1=campfire, 2=small camp, 3=full camp, 4=homestead
    storage: jsonb("storage").notNull().default([]),  // InventorySlot[]
    furniture: jsonb("furniture").notNull().default([]),  // PlacedFurniture[]
    gardens: jsonb("gardens").notNull().default([]),     // GardenPlant[] (with grid positions)
    visitorId: varchar("visitor_id", { length: 64 }),    // Current NPC visitor (null if none)
    visitorExpiresAt: timestamp("visitor_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("party_camps_party_idx").on(table.partyId, table.id),
  ],
);

export const playerDiscovery = pgTable(
  "player_discovery",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    chunkX: integer("chunk_x").notNull(),
    chunkY: integer("chunk_y").notNull(),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("player_discovery_player_chunk_idx").on(table.playerId, table.chunkX, table.chunkY),
  ],
);
