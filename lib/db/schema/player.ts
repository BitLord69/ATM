import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { eventEntry } from "./event-entry";

export const player = sqliteTable(
  "player",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    pdgaNumber: text("pdga_number"),
    homeClub: text("home_club"),
    dateOfBirth: text("date_of_birth"),
    genderCategory: text("gender_category"),
    createdAt: integer("created_at").notNull().$default(() => Date.now()),
    updatedAt: integer("updated_at").notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
  },
  table => [
    uniqueIndex("player_user_id_unique").on(table.userId),
    index("player_pdga_number_idx").on(table.pdgaNumber),
  ],
);

export const playerRelations = relations(player, ({ one, many }) => ({
  user: one(user, {
    fields: [player.userId],
    references: [user.id],
  }),
  eventEntries: many(eventEntry),
}));
