import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { tournament } from "./tournament";

export const divisionPolicy = sqliteTable(
  "division_policy",
  {
    id: text("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull().references(() => tournament.id, { onDelete: "cascade" }),
    ageReferenceMode: text("age_reference_mode").notNull().default("calendar_year"),
    startingListMode: text("starting_list_mode").notNull().default("major_only"),
    showMinorOverlays: integer("show_minor_overlays", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull().$default(() => Date.now()),
    updatedAt: integer("updated_at").notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
  },
  table => [
    uniqueIndex("division_policy_tournament_id_unique").on(table.tournamentId),
    index("division_policy_tournament_id_idx").on(table.tournamentId),
  ],
);

export const tournamentDivision = sqliteTable(
  "tournament_division",
  {
    id: text("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull().references(() => tournament.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    label: text("label").notNull(),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at").notNull().$default(() => Date.now()),
    updatedAt: integer("updated_at").notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
  },
  table => [
    index("tournament_division_tournament_id_idx").on(table.tournamentId),
    uniqueIndex("tournament_division_tournament_code_unique").on(table.tournamentId, table.code),
  ],
);

export const divisionPolicyRelations = relations(divisionPolicy, ({ one }) => ({
  tournament: one(tournament, {
    fields: [divisionPolicy.tournamentId],
    references: [tournament.id],
  }),
}));

export const tournamentDivisionRelations = relations(tournamentDivision, ({ one }) => ({
  tournament: one(tournament, {
    fields: [tournamentDivision.tournamentId],
    references: [tournament.id],
  }),
}));
