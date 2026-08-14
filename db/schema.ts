import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("players_updated_at_idx").on(table.updatedAt)]);

export const gameSaves = sqliteTable("game_saves", {
  id: text("id").primaryKey(),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  slot: integer("slot").notNull().default(1),
  revision: integer("revision").notNull().default(0),
  schemaVersion: integer("schema_version").notNull(),
  stateJson: text("state_json").notNull(),
  checksum: text("checksum").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("game_saves_player_slot_uidx").on(table.playerId, table.slot),
  index("game_saves_updated_at_idx").on(table.updatedAt),
]);

export const saveSnapshots = sqliteTable("save_snapshots", {
  id: text("id").primaryKey(),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  schemaVersion: integer("schema_version").notNull(),
  reason: text("reason").notNull(),
  stateJson: text("state_json").notNull(),
  checksum: text("checksum").notNull(),
  stage: integer("stage").notNull(),
  level: integer("level").notNull(),
  power: integer("power").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("save_snapshots_player_created_idx").on(table.playerId, table.createdAt),
]);

export const leaderboard = sqliteTable("leaderboard", {
  playerId: text("player_id").primaryKey().references(() => players.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  power: integer("power").notNull(),
  stage: integer("stage").notNull(),
  level: integer("level").notNull(),
  realm: integer("realm").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("leaderboard_power_idx").on(table.power),
  index("leaderboard_stage_idx").on(table.stage),
]);
