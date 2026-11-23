import { index, int, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const venue = sqliteTable("venues", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  description: text(),
  facilities: text(),
  lat: real().notNull(),
  long: real().notNull(),
  hasGolf: integer("has_golf", { mode: "boolean" }).notNull().default(false),
  hasAccuracy: integer("has_accuracy", { mode: "boolean" }).notNull().default(false),
  hasDistance: integer("has_distance", { mode: "boolean" }).notNull().default(false),
  hasSCF: integer("has_scf", { mode: "boolean" }).notNull().default(false),
  hasDiscathon: integer("has_discathon", { mode: "boolean" }).notNull().default(false),
  hasDDC: integer("has_ddc", { mode: "boolean" }).notNull().default(false),
  hasFreestyle: integer("has_freestyle", { mode: "boolean" }).notNull().default(false),
  changedBy: text().notNull().references(() => user.id),
  createdAt: int().notNull().$default(() => Date.now()),
  changedAt: int().notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
});

export const venueCourseLayout = sqliteTable(
  "venue_course_layout",
  {
    id: text("id").primaryKey(),
    venueId: integer("venue_id").notNull().references(() => venue.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    par: integer("par").notNull(),
    holeCount: integer("hole_count"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at").notNull().$default(() => Date.now()),
    updatedAt: integer("updated_at").notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
  },
  table => [
    index("venue_course_layout_venue_id_idx").on(table.venueId),
  ],
);
