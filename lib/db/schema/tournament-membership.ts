import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { organization } from "./organization";
import { tournament } from "./tournament";

export const TOURNAMENT_ROLES = [
  "owner",
  "admin",
  "td",
  "scorer",
  "viewer",
] as const;

export type TournamentRole = typeof TOURNAMENT_ROLES[number];

export const tournamentMembership = sqliteTable(
  "tournament_membership",
  {
    id: text("id").primaryKey(),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role").$type<TournamentRole>().notNull(),
    status: text("status").notNull().default("active"), // active, suspended, expired
    expiresAt: integer("expires_at"), // Optional expiry
    createdAt: integer("created_at").notNull().$default(() => Date.now()),
    updatedAt: integer("updated_at").$default(() => Date.now()).$onUpdate(() => Date.now()),
  },
  table => [
    index("tournament_membership_user_id_idx").on(table.userId),
    index("tournament_membership_tournament_id_idx").on(table.tournamentId),
    index("tournament_membership_organization_id_idx").on(table.organizationId),
    index("tournament_membership_user_tournament_idx").on(table.userId, table.tournamentId),
  ],
);

export const tournamentMembershipRelations = relations(tournamentMembership, ({ one }) => ({
  user: one(user, {
    fields: [tournamentMembership.userId],
    references: [user.id],
  }),
  tournament: one(tournament, {
    fields: [tournamentMembership.tournamentId],
    references: [tournament.id],
  }),
  organization: one(organization, {
    fields: [tournamentMembership.organizationId],
    references: [organization.id],
  }),
}));
