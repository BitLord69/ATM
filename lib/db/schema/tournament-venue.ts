import { int, integer, sqliteTable } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { tournament } from "./tournament";
import { venue } from "./venue";

export const tournamentVenue = sqliteTable("tournamentvenues", {
  id: int().primaryKey({ autoIncrement: true }),
  tournamentId: int().notNull().references(() => tournament.id),
  venueId: int().notNull().references(() => venue.id),
  hasGolf: integer({ mode: "boolean" }).notNull().default(false),
  hasAccuracy: integer({ mode: "boolean" }).notNull().default(false),
  hasDistance: integer({ mode: "boolean" }).notNull().default(false),
  hasSCF: integer({ mode: "boolean" }).notNull().default(false),
  hasDiscathon: integer({ mode: "boolean" }).notNull().default(false),
  hasDDC: integer({ mode: "boolean" }).notNull().default(false),
  hasFreestyle: integer({ mode: "boolean" }).notNull().default(false),
  changedBy: int().notNull().references(() => user.id),
  createdAt: int().notNull().$default(() => Date.now()),
  changedAt: int().notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
});
