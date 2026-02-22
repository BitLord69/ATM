import { relations } from "drizzle-orm";
import { int, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { organization } from "./organization";
import { tournamentMembership } from "./tournament-membership";

export const tournament = sqliteTable("tournaments", {
  id: int().primaryKey({ autoIncrement: true }),
  organizationId: text("organization_id")
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text().notNull().unique(),
  slug: text().notNull().unique(),
  description: text(),
  country: text(),
  city: text(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  contactUserId: text("contact_user_id").references(() => user.id, { onDelete: "set null" }),
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
  changedBy: int().notNull().references(() => user.id),
  createdAt: int().notNull().$default(() => Date.now()),
  changedAt: int().notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
});

export const tournamentRelations = relations(tournament, ({ one, many }) => ({
  organization: one(organization, {
    fields: [tournament.organizationId],
    references: [organization.id],
  }),
  memberships: many(tournamentMembership),
}));
