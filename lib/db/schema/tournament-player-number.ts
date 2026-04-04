import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { player } from "./player";
import { tournament } from "./tournament";

export const tournamentPlayerNumber = sqliteTable(
  "tournament_player_number",
  {
    id: text("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull().references(() => tournament.id, { onDelete: "cascade" }),
    playerId: text("player_id").notNull().references(() => player.id, { onDelete: "cascade" }),
    playerNumber: integer("player_number").notNull(),
    assignmentMode: text("assignment_mode").notNull().default("manual"),
    assignedBy: text("assigned_by"),
    assignedAt: integer("assigned_at").notNull().$default(() => Date.now()),
    createdAt: integer("created_at").notNull().$default(() => Date.now()),
    updatedAt: integer("updated_at").notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
  },
  table => [
    uniqueIndex("tournament_player_number_tournament_player_unique").on(table.tournamentId, table.playerId),
    uniqueIndex("tournament_player_number_tournament_number_unique").on(table.tournamentId, table.playerNumber),
    index("tournament_player_number_tournament_id_idx").on(table.tournamentId),
    index("tournament_player_number_player_id_idx").on(table.playerId),
  ],
);

export const tournamentPlayerNumberRelations = relations(tournamentPlayerNumber, ({ one }) => ({
  tournament: one(tournament, {
    fields: [tournamentPlayerNumber.tournamentId],
    references: [tournament.id],
  }),
  player: one(player, {
    fields: [tournamentPlayerNumber.playerId],
    references: [player.id],
  }),
}));
