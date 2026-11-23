import { and, asc, eq } from "drizzle-orm";

import { golfScoresQuerySchema } from "#shared/schemas/golf-scores";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import {
  eventEntry,
  eventRoundScore,
  player,
  startingListEntry,
  startingListLock,
  tournament,
  tournamentMembership,
  tournamentPlayerNumber,
  user,
} from "../../../../../lib/db/schema";
import { hasTournamentRole } from "../../../../utils/authorization";
import { computeGolfStandings } from "../../../../utils/golf-scoring";
import { getPoolLabels } from "../../../../utils/starting-list";

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

  const queryResult = golfScoresQuerySchema.safeParse(getQuery(event));
  if (!queryResult.success) {
    throw createError({ statusCode: 400, message: queryResult.error.issues[0]?.message || "Invalid query" });
  }
  const { roundNumber } = queryResult.data;

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const tournamentRows = await db
    .select({
      id: tournament.id,
      hasGolf: tournament.hasGolf,
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

  const [entryRows, startingRows, lockRows, scoreRows, numberRows] = await Promise.all([
    db
      .select({
        eventEntryId: eventEntry.id,
        majorDivision: eventEntry.majorDivision,
        minorDivisionTags: eventEntry.minorDivisionTags,
        playoffRank: eventEntry.playoffRank,
        status: eventEntry.status,
        playerId: player.id,
        playerName: player.displayName,
        playerCountry: player.country,
        userName: user.name,
        userEmail: user.email,
      })
      .from(eventEntry)
      .innerJoin(player, eq(player.id, eventEntry.playerId))
      .leftJoin(user, eq(user.id, player.userId))
      .where(
        and(
          eq(eventEntry.tournamentId, foundTournament.id),
          eq(eventEntry.discipline, "golf"),
        ),
      )
      .orderBy(asc(eventEntry.majorDivision), asc(player.displayName)),
    db
      .select({
        eventEntryId: startingListEntry.eventEntryId,
        poolName: startingListEntry.poolName,
        position: startingListEntry.position,
      })
      .from(startingListEntry)
      .where(
        and(
          eq(startingListEntry.tournamentId, foundTournament.id),
          eq(startingListEntry.discipline, "golf"),
          eq(startingListEntry.roundNumber, roundNumber),
        ),
      )
      .orderBy(asc(startingListEntry.position)),
    db
      .select({ isLocked: startingListLock.isLocked })
      .from(startingListLock)
      .where(
        and(
          eq(startingListLock.tournamentId, foundTournament.id),
          eq(startingListLock.discipline, "golf"),
          eq(startingListLock.roundNumber, roundNumber),
        ),
      )
      .limit(1),
    db
      .select({
        eventEntryId: eventRoundScore.eventEntryId,
        roundNumber: eventRoundScore.roundNumber,
        rawScore: eventRoundScore.rawScore,
        status: eventRoundScore.status,
      })
      .from(eventRoundScore)
      .where(
        and(
          eq(eventRoundScore.tournamentId, foundTournament.id),
          eq(eventRoundScore.discipline, "golf"),
        ),
      ),
    db
      .select({
        playerId: tournamentPlayerNumber.playerId,
        playerNumber: tournamentPlayerNumber.playerNumber,
      })
      .from(tournamentPlayerNumber)
      .where(eq(tournamentPlayerNumber.tournamentId, foundTournament.id)),
  ]);

  const hasStartingList = startingRows.length > 0;
  const isStartingListLocked = !!lockRows[0]?.isLocked;
  const canEnterScores = canManage && hasStartingList && isStartingListLocked;

  const activeEntries = entryRows.filter(row => row.status !== "withdrawn");
  const startingByEntryId = new Map(startingRows.map(r => [r.eventEntryId, r]));
  const numberByPlayerId = new Map(numberRows.map(r => [r.playerId, r.playerNumber]));

  const currentRoundScoreByEntryId = new Map(
    scoreRows
      .filter(s => s.roundNumber === roundNumber)
      .map(s => [s.eventEntryId, s]),
  );

  const poolCount = typeof foundTournament.golfPoolCount === "number" && foundTournament.golfPoolCount >= 1
    ? foundTournament.golfPoolCount
    : 1;
  const totalRounds = typeof foundTournament.golfRounds === "number" && foundTournament.golfRounds >= 1
    ? foundTournament.golfRounds
    : Math.max(1, roundNumber);
  const roundPars = parseJsonArray<number | null>(foundTournament.golfRoundPars);
  const roundLayouts = parseJsonArray<{
    venueId?: number | null;
    venueName?: string | null;
    layoutId?: string | null;
    layoutName?: string | null;
  } | null>(foundTournament.golfRoundLayouts);
  const roundIndex = Math.max(0, roundNumber - 1);

  const playersForStandings = activeEntries.map(row => ({
    eventEntryId: row.eventEntryId,
    playerId: row.playerId,
    playerName: row.playerName || row.userName || row.userEmail || row.playerId,
    country: row.playerCountry ?? null,
    playerNumber: numberByPlayerId.get(row.playerId) ?? null,
    majorDivision: row.majorDivision,
    minorDivisionTags: parseJsonArray<string>(row.minorDivisionTags).filter(
      (item): item is string => typeof item === "string",
    ),
    playoffRank: row.playoffRank ?? null,
  }));

  const { standings, podiumTies } = computeGolfStandings(
    playersForStandings,
    scoreRows,
    roundPars,
    totalRounds,
  );

  const players = playersForStandings
    .map((p) => {
      const startInfo = startingByEntryId.get(p.eventEntryId);
      const roundScore = currentRoundScoreByEntryId.get(p.eventEntryId);
      return {
        ...p,
        poolName: startInfo?.poolName ?? null,
        startPosition: startInfo?.position ?? null,
        strokes: roundScore && roundScore.status === "ok" && typeof roundScore.rawScore === "number"
          ? Math.round(roundScore.rawScore)
          : null,
        status: (roundScore?.status === "DNS" || roundScore?.status === "DNF" || roundScore?.status === "SCR")
          ? roundScore.status
          : "ok",
      };
    })
    .sort((left, right) => {
      if (left.startPosition != null && right.startPosition != null) {
        return left.startPosition - right.startPosition;
      }
      if (left.startPosition != null) {
        return -1;
      }
      if (right.startPosition != null) {
        return 1;
      }
      return left.playerName.localeCompare(right.playerName);
    });

  return {
    tournamentId: foundTournament.id,
    roundNumber,
    canManage,
    startingListStatus: {
      hasStartingList,
      isLocked: isStartingListLocked,
      canEnterScores,
    },
    golfSettings: {
      rounds: totalRounds,
      cumulativeRounds: foundTournament.golfCumulativeRounds ?? null,
      poolMode: foundTournament.golfPoolMode === "dynamic" ? "dynamic" : "static",
      poolCount,
      poolLabels: getPoolLabels(poolCount),
      golfStartEnabled: !!foundTournament.golfStartEnabled,
      roundPars,
      roundPar: typeof roundPars[roundIndex] === "number" ? roundPars[roundIndex] : null,
      roundLayout: roundLayouts[roundIndex] ?? null,
    },
    players,
    standings,
    podiumTies,
  };
});
