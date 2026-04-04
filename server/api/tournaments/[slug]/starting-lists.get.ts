import { and, asc, eq } from "drizzle-orm";

import { startingListQuerySchema } from "#shared/schemas/starting-lists";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { eventEntry, player, startingListEntry, startingListLock, tournament, tournamentMembership, user } from "../../../../lib/db/schema";

function canViewStartingLists(globalRole: string | undefined, membership: { role: string; status: string } | undefined) {
  if (globalRole === "admin") {
    return true;
  }

  if (!membership || membership.status !== "active") {
    return false;
  }

  return ["owner", "admin", "td", "scorer", "viewer"].includes(membership.role);
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, message: "Tournament slug is required" });
  }

  const queryResult = startingListQuerySchema.safeParse(getQuery(event));
  if (!queryResult.success) {
    throw createError({ statusCode: 400, message: queryResult.error.issues[0]?.message || "Invalid query" });
  }

  const query = queryResult.data;

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const tournamentRows = await db
    .select({ id: tournament.id })
    .from(tournament)
    .where(eq(tournament.slug, slug))
    .limit(1);

  const foundTournament = tournamentRows[0];
  if (!foundTournament) {
    throw createError({ statusCode: 404, message: "Tournament not found" });
  }

  const membershipRows = await db
    .select({ role: tournamentMembership.role, status: tournamentMembership.status })
    .from(tournamentMembership)
    .where(
      and(
        eq(tournamentMembership.tournamentId, foundTournament.id),
        eq(tournamentMembership.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!canViewStartingLists(session.user.role, membershipRows[0])) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const rows = await db
    .select({
      id: startingListEntry.id,
      eventEntryId: startingListEntry.eventEntryId,
      discipline: startingListEntry.discipline,
      roundNumber: startingListEntry.roundNumber,
      position: startingListEntry.position,
      startNumber: startingListEntry.startNumber,
      activeCompetitiveDivisionSnapshot: startingListEntry.activeCompetitiveDivisionSnapshot,
      entryDiscipline: eventEntry.discipline,
      majorDivision: eventEntry.majorDivision,
      minorDivisionTags: eventEntry.minorDivisionTags,
      primaryMinorDivision: eventEntry.primaryMinorDivision,
      activeCompetitiveDivision: eventEntry.activeCompetitiveDivision,
      entryStatus: eventEntry.status,
      playerId: player.id,
      playerName: player.displayName,
      userName: user.name,
      userEmail: user.email,
      userCountry: user.country,
    })
    .from(startingListEntry)
    .innerJoin(eventEntry, eq(eventEntry.id, startingListEntry.eventEntryId))
    .innerJoin(player, eq(player.id, eventEntry.playerId))
    .leftJoin(user, eq(user.id, player.userId))
    .where(
      and(
        eq(startingListEntry.tournamentId, foundTournament.id),
        eq(startingListEntry.discipline, query.discipline),
        eq(startingListEntry.roundNumber, query.roundNumber),
      ),
    )
    .orderBy(asc(startingListEntry.position), asc(startingListEntry.id));

  const lockRows = await db
    .select({ isLocked: startingListLock.isLocked, lockedBy: startingListLock.lockedBy, lockedAt: startingListLock.lockedAt })
    .from(startingListLock)
    .where(
      and(
        eq(startingListLock.tournamentId, foundTournament.id),
        eq(startingListLock.discipline, query.discipline),
        eq(startingListLock.roundNumber, query.roundNumber),
      ),
    )
    .limit(1);

  const lockState = lockRows[0] ?? { isLocked: false, lockedBy: null, lockedAt: null };

  return {
    tournamentId: foundTournament.id,
    discipline: query.discipline,
    roundNumber: query.roundNumber,
    lock: {
      isLocked: !!lockState.isLocked,
      lockedBy: lockState.lockedBy,
      lockedAt: lockState.lockedAt,
    },
    entries: rows.map(row => ({
      ...row,
      minorDivisionTags: (() => {
        try {
          const parsed = JSON.parse(row.minorDivisionTags || "[]");
          return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
        }
        catch {
          return [] as string[];
        }
      })(),
    })),
  };
});
