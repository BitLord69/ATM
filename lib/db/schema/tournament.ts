import { int, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tournament = sqliteTable("tournaments", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  slug: text().notNull().unique(),
  description: text(),
  lat: real().notNull(),
  long: real().notNull(),
  startDate: integer(),
  endDate: int(),
  hasGolf: int({ mode: "boolean" }),
  hasAccuracy: integer({ mode: "boolean" }),
  hasDistance: integer({ mode: "boolean" }),
  hasSCF: integer({ mode: "boolean" }),
  hasDiscathon: integer({ mode: "boolean" }),
  hasDDC: integer({ mode: "boolean" }),
  hasFreestyle: integer({ mode: "boolean" }),
  createdAt: int().notNull().$default(() => Date.now()),
  changedAt: int().notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
});
