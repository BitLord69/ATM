import { and, eq, or } from "drizzle-orm";

import { normalizePersistedUserRole } from "#shared/types/auth";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { eventEntry, player, tournament, tournamentMembership, user } from "../../../../../lib/db/schema";

type TournamentConnection = {
  tournamentId: number;
  tournamentName: string;
  tournamentSlug: string;
  startDate: number | null;
  endDate: number | null;
  roles: string[];
  membershipStatuses: string[];
  hasPlayerEntry: boolean;
  playerEntryCount: number;
};

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const targetUserId = getRouterParam(event, "id");
  if (!targetUserId) {
    throw createError({ statusCode: 400, message: "User ID required" });
  }

  const isAdmin = session.user.role === "admin";

  const [target] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);

  if (!target) {
    throw createError({ statusCode: 404, message: "User not found" });
  }

  const membershipRows = await db
    .select({
      tournamentId: tournamentMembership.tournamentId,
      role: tournamentMembership.role,
      status: tournamentMembership.status,
      tournamentName: tournament.name,
      tournamentSlug: tournament.slug,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
    })
    .from(tournamentMembership)
    .innerJoin(tournament, eq(tournament.id, tournamentMembership.tournamentId))
    .where(eq(tournamentMembership.userId, targetUserId));

  const playerEntryRows = await db
    .select({
      tournamentId: eventEntry.tournamentId,
      tournamentName: tournament.name,
      tournamentSlug: tournament.slug,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      entryId: eventEntry.id,
    })
    .from(player)
    .innerJoin(eventEntry, eq(eventEntry.playerId, player.id))
    .innerJoin(tournament, eq(tournament.id, eventEntry.tournamentId))
    .where(eq(player.userId, targetUserId));

  const byTournament = new Map<number, TournamentConnection>();

  for (const row of membershipRows) {
    const existing = byTournament.get(row.tournamentId);
    if (!existing) {
      byTournament.set(row.tournamentId, {
        tournamentId: row.tournamentId,
        tournamentName: row.tournamentName,
        tournamentSlug: row.tournamentSlug,
        startDate: row.startDate ?? null,
        endDate: row.endDate ?? null,
        roles: [row.role],
        membershipStatuses: [row.status],
        hasPlayerEntry: false,
        playerEntryCount: 0,
      });
      continue;
    }

    if (!existing.roles.includes(row.role)) {
      existing.roles.push(row.role);
    }

    if (!existing.membershipStatuses.includes(row.status)) {
      existing.membershipStatuses.push(row.status);
    }
  }

  for (const row of playerEntryRows) {
    const existing = byTournament.get(row.tournamentId);
    if (!existing) {
      byTournament.set(row.tournamentId, {
        tournamentId: row.tournamentId,
        tournamentName: row.tournamentName,
        tournamentSlug: row.tournamentSlug,
        startDate: row.startDate ?? null,
        endDate: row.endDate ?? null,
        roles: ["player"],
        membershipStatuses: [],
        hasPlayerEntry: true,
        playerEntryCount: 1,
      });
      continue;
    }

    existing.hasPlayerEntry = true;
    existing.playerEntryCount += 1;

    if (!existing.roles.includes("player")) {
      existing.roles.push("player");
    }
  }

  const connections = [...byTournament.values()].sort((a, b) => a.tournamentName.localeCompare(b.tournamentName));

  if (!isAdmin) {
    const tdTournaments = await db
      .select({ tournamentId: tournamentMembership.tournamentId })
      .from(tournamentMembership)
      .where(
        and(
          eq(tournamentMembership.userId, session.user.id),
          or(
            eq(tournamentMembership.role, "owner"),
            eq(tournamentMembership.role, "admin"),
            eq(tournamentMembership.role, "td"),
          ),
          eq(tournamentMembership.status, "active"),
        ),
      );

    const tdTournamentIds = [...new Set(tdTournaments.map(row => row.tournamentId))];
    if (tdTournamentIds.length === 0) {
      throw createError({ statusCode: 403, message: "Forbidden" });
    }
    const isVisibleToTd = tdTournamentIds.length > 0 && connections.some(c => tdTournamentIds.includes(c.tournamentId));

    if (!isVisibleToTd) {
      throw createError({ statusCode: 403, message: "Forbidden" });
    }
  }

  const tournamentIds = [...new Set(connections.map(c => c.tournamentId))];

  return {
    user: {
      ...target,
      role: normalizePersistedUserRole(target.role),
    },
    connections,
    summary: {
      tournamentCount: connections.length,
      connectedAsPlayerCount: connections.filter(c => c.hasPlayerEntry).length,
      allRoles: [...new Set(connections.flatMap(c => c.roles))],
    },
    scope: {
      type: isAdmin ? "admin" : "td",
      tournamentIds: isAdmin ? null : tournamentIds,
    },
  };
});
