import { and, asc, eq } from "drizzle-orm";

import { startingListQuerySchema } from "#shared/schemas/starting-lists";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import {
  eventEntry,
  player,
  startingListEntry,
  startingListLock,
  tournament,
  tournamentMembership,
  tournamentPlayerNumber,
  user,
} from "../../../../lib/db/schema";
import { hasTournamentRole } from "../../../utils/authorization";
import { getPoolLabels } from "../../../utils/starting-list";

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }
  catch {
    return [];
  }
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
    .select({
      id: tournament.id,
      golfRounds: tournament.golfRounds,
      golfCumulativeRounds: tournament.golfCumulativeRounds,
      golfPoolMode: tournament.golfPoolMode,
      golfPoolCount: tournament.golfPoolCount,
      golfStartEnabled: tournament.golfStartEnabled,
      golfRoundPars: tournament.golfRoundPars,
      golfRoundLayouts: tournament.golfRoundLayouts,
    })
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

  if (!hasTournamentRole(session.user.role, membershipRows[0], "viewer")) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const canManage = hasTournamentRole(session.user.role, membershipRows[0], "scorer");

  const [rows, lockRows, playerNumberRows] = await Promise.all([
    db
      .select({
        id: startingListEntry.id,
        eventEntryId: startingListEntry.eventEntryId,
        discipline: startingListEntry.discipline,
        roundNumber: startingListEntry.roundNumber,
        position: startingListEntry.position,
        poolName: startingListEntry.poolName,
        activeCompetitiveDivisionSnapshot: startingListEntry.activeCompetitiveDivisionSnapshot,
        entryDiscipline: eventEntry.discipline,
        majorDivision: eventEntry.majorDivision,
        minorDivisionTags: eventEntry.minorDivisionTags,
        primaryMinorDivision: eventEntry.primaryMinorDivision,
        activeCompetitiveDivision: eventEntry.activeCompetitiveDivision,
        entryStatus: eventEntry.status,
        playerId: player.id,
        playerName: player.displayName,
        playerCountry: player.country,
        userName: user.name,
        userEmail: user.email,
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
      .orderBy(asc(startingListEntry.position), asc(startingListEntry.id)),
    db
      .select({ isLocked: startingListLock.isLocked, lockedBy: startingListLock.lockedBy, lockedAt: startingListLock.lockedAt })
      .from(startingListLock)
      .where(
        and(
          eq(startingListLock.tournamentId, foundTournament.id),
          eq(startingListLock.discipline, query.discipline),
          eq(startingListLock.roundNumber, query.roundNumber),
        ),
      )
      .limit(1),
    db
      .select({
        playerId: tournamentPlayerNumber.playerId,
        playerNumber: tournamentPlayerNumber.playerNumber,
      })
      .from(tournamentPlayerNumber)
      .where(eq(tournamentPlayerNumber.tournamentId, foundTournament.id)),
  ]);

  const playerNumberByPlayerId = new Map(
    playerNumberRows.map(item => [item.playerId, item.playerNumber]),
  );

  const lockState = lockRows[0] ?? { isLocked: false, lockedBy: null, lockedAt: null };
  const poolCount = typeof foundTournament.golfPoolCount === "number" && foundTournament.golfPoolCount >= 1
    ? foundTournament.golfPoolCount
    : 1;
  const roundPars = parseJsonArray<number | null>(foundTournament.golfRoundPars);
  const roundLayouts = parseJsonArray<{
    venueId?: number | null;
    venueName?: string | null;
    layoutId?: string | null;
    layoutName?: string | null;
  } | null>(foundTournament.golfRoundLayouts);
  const roundIndex = Math.max(0, query.roundNumber - 1);

  return {
    tournamentId: foundTournament.id,
    discipline: query.discipline,
    roundNumber: query.roundNumber,
    canManage,
    golfSettings: {
      rounds: foundTournament.golfRounds ?? null,
      cumulativeRounds: foundTournament.golfCumulativeRounds ?? null,
      poolMode: foundTournament.golfPoolMode === "dynamic" ? "dynamic" : "static",
      poolCount,
      poolLabels: getPoolLabels(poolCount),
      golfStartEnabled: !!foundTournament.golfStartEnabled,
      roundPar: typeof roundPars[roundIndex] === "number" ? roundPars[roundIndex] : null,
      roundLayout: roundLayouts[roundIndex] ?? null,
    },
    lock: {
      isLocked: !!lockState.isLocked,
      lockedBy: lockState.lockedBy,
      lockedAt: lockState.lockedAt,
    },
    entries: rows.map(row => ({
      ...row,
      playerName: row.playerName || row.userName || row.userEmail || null,
      userCountry: row.playerCountry ?? null,
      playerNumber: playerNumberByPlayerId.get(row.playerId) ?? null,
      minorDivisionTags: parseJsonArray<string>(row.minorDivisionTags).filter(
        (item): item is string => typeof item === "string",
      ),
    })),
  };
});
