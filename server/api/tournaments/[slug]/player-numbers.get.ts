import { and, eq } from "drizzle-orm";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { eventEntry, player, tournament, tournamentMembership, tournamentPlayerNumber, user } from "../../../../lib/db/schema";
import { hasTournamentRole } from "../../../utils/authorization";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, message: "Tournament slug is required" });
  }

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

  if (!hasTournamentRole(session.user.role, membershipRows[0], "viewer")) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const entryRows = await db
    .select({
      playerId: player.id,
      playerName: player.displayName,
      playerCountry: player.country,
      playerEmail: player.email,
      userName: user.name,
      userCountry: user.country,
      userEmail: user.email,
    })
    .from(eventEntry)
    .innerJoin(player, eq(player.id, eventEntry.playerId))
    .leftJoin(user, eq(user.id, player.userId))
    .where(
      and(
        eq(eventEntry.tournamentId, foundTournament.id),
        eq(eventEntry.status, "registered"),
      ),
    );

  const numberRows = await db
    .select({
      playerId: tournamentPlayerNumber.playerId,
      playerNumber: tournamentPlayerNumber.playerNumber,
      assignmentMode: tournamentPlayerNumber.assignmentMode,
      assignedAt: tournamentPlayerNumber.assignedAt,
    })
    .from(tournamentPlayerNumber)
    .where(eq(tournamentPlayerNumber.tournamentId, foundTournament.id));

  const numberByPlayerId = new Map(numberRows.map(row => [row.playerId, row]));

  const playersMap = new Map<string, {
    playerId: string;
    playerName: string | null;
    userName: string | null;
    userCountry: string | null;
    userEmail: string | null;
    entryCount: number;
  }>();

  for (const row of entryRows) {
    const existing = playersMap.get(row.playerId);
    if (existing) {
      existing.entryCount += 1;
      continue;
    }

    playersMap.set(row.playerId, {
      playerId: row.playerId,
      playerName: row.playerName,
      userName: row.userName,
      userCountry: row.playerCountry || row.userCountry,
      userEmail: row.playerEmail || row.userEmail,
      entryCount: 1,
    });
  }

  const players = [...playersMap.values()]
    .sort((left, right) => {
      const countryCompare = (left.userCountry || "").localeCompare(right.userCountry || "");
      if (countryCompare !== 0) {
        return countryCompare;
      }
      const nameCompare = (left.playerName || left.userName || "").localeCompare(right.playerName || right.userName || "");
      if (nameCompare !== 0) {
        return nameCompare;
      }
      return left.playerId.localeCompare(right.playerId);
    })
    .map((item) => {
      const number = numberByPlayerId.get(item.playerId);
      return {
        ...item,
        playerNumber: number?.playerNumber ?? null,
        assignmentMode: number?.assignmentMode ?? null,
        assignedAt: number?.assignedAt ?? null,
      };
    });

  const assignedPlayers = players.filter(item => item.playerNumber != null).length;

  return {
    tournamentId: foundTournament.id,
    hasAnyAssignments: numberRows.length > 0,
    canAutoGenerate: numberRows.length === 0,
    summary: {
      registeredPlayers: players.length,
      assignedPlayers,
      unassignedPlayers: players.length - assignedPlayers,
    },
    players,
  };
});
