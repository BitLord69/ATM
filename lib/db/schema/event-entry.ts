import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { player } from "./player";
import { tournament } from "./tournament";

export const eventEntry = sqliteTable(
  "event_entry",
  {
    id: text("id").primaryKey(),
    playerId: text("player_id").notNull().references(() => player.id, { onDelete: "cascade" }),
    tournamentId: integer("tournament_id").notNull().references(() => tournament.id, { onDelete: "cascade" }),
    discipline: text("discipline").notNull().default("overall"),
    majorDivision: text("major_division").notNull(),
    minorDivisionTags: text("minor_division_tags").notNull().default("[]"),
    primaryMinorDivision: text("primary_minor_division"),
    activeCompetitiveDivision: text("active_competitive_division").notNull(),
    status: text("status").notNull().default("registered"),
    createdAt: integer("created_at").notNull().$default(() => Date.now()),
    updatedAt: integer("updated_at").notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
    changedBy: text("changed_by"),
  },
  table => [
    index("event_entry_tournament_id_idx").on(table.tournamentId),
    index("event_entry_player_id_idx").on(table.playerId),
    uniqueIndex("event_entry_player_tournament_discipline_unique").on(table.playerId, table.tournamentId, table.discipline),
  ],
);

export const eventEntryRelations = relations(eventEntry, ({ one }) => ({
  player: one(player, {
    fields: [eventEntry.playerId],
    references: [player.id],
  }),
  tournament: one(tournament, {
    fields: [eventEntry.tournamentId],
    references: [tournament.id],
  }),
}));

export const startingListEntry = sqliteTable(
  "starting_list_entry",
  {
    id: text("id").primaryKey(),
    eventEntryId: text("event_entry_id").notNull().references(() => eventEntry.id, { onDelete: "cascade" }),
    tournamentId: integer("tournament_id").notNull().references(() => tournament.id, { onDelete: "cascade" }),
    discipline: text("discipline").notNull().default("overall"),
    roundNumber: integer("round_number").notNull().default(1),
    position: integer("position").notNull(),
    startNumber: integer("start_number"),
    activeCompetitiveDivisionSnapshot: text("active_competitive_division_snapshot").notNull(),
    createdAt: integer("created_at").notNull().$default(() => Date.now()),
    updatedAt: integer("updated_at").notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
  },
  table => [
    index("starting_list_entry_event_entry_id_idx").on(table.eventEntryId),
    index("starting_list_entry_tournament_id_idx").on(table.tournamentId),
    uniqueIndex("starting_list_entry_round_position_unique").on(table.tournamentId, table.discipline, table.roundNumber, table.position),
    uniqueIndex("starting_list_entry_round_start_number_unique").on(table.tournamentId, table.discipline, table.roundNumber, table.startNumber),
    uniqueIndex("starting_list_entry_round_event_entry_unique").on(table.roundNumber, table.eventEntryId),
  ],
);

export const startingListEntryRelations = relations(startingListEntry, ({ one }) => ({
  eventEntry: one(eventEntry, {
    fields: [startingListEntry.eventEntryId],
    references: [eventEntry.id],
  }),
}));

export const startingListLock = sqliteTable(
  "starting_list_lock",
  {
    id: text("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull().references(() => tournament.id, { onDelete: "cascade" }),
    discipline: text("discipline").notNull().default("overall"),
    roundNumber: integer("round_number").notNull().default(1),
    isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(true),
    lockedBy: text("locked_by"),
    lockedAt: integer("locked_at"),
    createdAt: integer("created_at").notNull().$default(() => Date.now()),
    updatedAt: integer("updated_at").notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
  },
  table => [
    index("starting_list_lock_tournament_id_idx").on(table.tournamentId),
    uniqueIndex("starting_list_lock_scope_unique").on(table.tournamentId, table.discipline, table.roundNumber),
  ],
);

export const startingListLockRelations = relations(startingListLock, ({ one }) => ({
  tournament: one(tournament, {
    fields: [startingListLock.tournamentId],
    references: [tournament.id],
  }),
}));

export const tournamentRegistrationLock = sqliteTable(
  "tournament_registration_lock",
  {
    id: text("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull().references(() => tournament.id, { onDelete: "cascade" }),
    isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
    lockedBy: text("locked_by"),
    lockedAt: integer("locked_at"),
    createdAt: integer("created_at").notNull().$default(() => Date.now()),
    updatedAt: integer("updated_at").notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
  },
  table => [
    uniqueIndex("tournament_registration_lock_tournament_unique").on(table.tournamentId),
    index("tournament_registration_lock_tournament_id_idx").on(table.tournamentId),
  ],
);

export const tournamentRegistrationLockRelations = relations(tournamentRegistrationLock, ({ one }) => ({
  tournament: one(tournament, {
    fields: [tournamentRegistrationLock.tournamentId],
    references: [tournament.id],
  }),
}));
