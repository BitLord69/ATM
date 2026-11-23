import { relations } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { eventEntry } from "./event-entry";
import { tournament } from "./tournament";

export const eventRoundScore = sqliteTable(
  "event_round_score",
  {
    id: text("id").primaryKey(),
    eventEntryId: text("event_entry_id").notNull().references(() => eventEntry.id, { onDelete: "cascade" }),
    tournamentId: integer("tournament_id").notNull().references(() => tournament.id, { onDelete: "cascade" }),
    discipline: text("discipline").notNull(),
    roundNumber: integer("round_number").notNull(),
    rawScore: real("raw_score"),
    status: text("status").notNull().default("ok"), // "ok" | "DNS" | "DNF" | "SCR"
    notes: text("notes"),
    enteredBy: text("entered_by"),
    createdAt: integer("created_at").notNull().$default(() => Date.now()),
    updatedAt: integer("updated_at").notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
  },
  table => [
    uniqueIndex("event_round_score_entry_round_unique").on(table.eventEntryId, table.roundNumber),
    index("event_round_score_scope_idx").on(table.tournamentId, table.discipline, table.roundNumber),
    index("event_round_score_entry_idx").on(table.eventEntryId),
  ],
);

export const eventRoundScoreRelations = relations(eventRoundScore, ({ one }) => ({
  eventEntry: one(eventEntry, {
    fields: [eventRoundScore.eventEntryId],
    references: [eventEntry.id],
  }),
  tournament: one(tournament, {
    fields: [eventRoundScore.tournamentId],
    references: [tournament.id],
  }),
}));
