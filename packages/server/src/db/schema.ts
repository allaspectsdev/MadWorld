import {
  pgTable,
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
