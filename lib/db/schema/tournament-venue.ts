import { int, sqliteTable } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { tournament } from "./tournament";
import { venue } from "./venue";

export const tournamentVenue = sqliteTable("tournamentvenues", {
  id: int().primaryKey({ autoIncrement: true }),
  tournamentId: int().notNull().references(() => tournament.id),
  venueId: int().notNull().references(() => venue.id),
  changedBy: int().notNull().references(() => user.id),
  createdAt: int().notNull().$default(() => Date.now()),
  changedAt: int().notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
});
