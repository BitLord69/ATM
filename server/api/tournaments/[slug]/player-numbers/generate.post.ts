import { and, eq } from "drizzle-orm";

import { playerNumberGenerateBodySchema } from "#shared/schemas/player-numbers";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { eventEntry, player, tournament, tournamentMembership, tournamentPlayerNumber, user } from "../../../../../lib/db/schema";

function canManageTournament(globalRole: string | undefined, membership: { role: string; status: string } | undefined) {
  if (globalRole === "admin") {
    return true;
  }

  if (!membership || membership.status !== "active") {
    return false;
  }

  return ["owner", "admin", "td", "scorer"].includes(membership.role);
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, message: "Tournament slug is required" });
  }

  const bodyResult = playerNumberGenerateBodySchema.safeParse(await readBody(event));
  if (!bodyResult.success) {
    throw createError({ statusCode: 400, message: bodyResult.error.issues[0]?.message || "Invalid request body" });
  }

  const body = bodyResult.data;

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

  if (!canManageTournament(session.user.role, membershipRows[0])) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const existingNumberRows = await db
    .select({ id: tournamentPlayerNumber.id })
    .from(tournamentPlayerNumber)
    .where(eq(tournamentPlayerNumber.tournamentId, foundTournament.id))
    .limit(1);

  if (existingNumberRows.length > 0) {
    throw createError({
      statusCode: 409,
      message: "Player numbers already initialized. Only manual assignment for newly added players is allowed.",
    });
  }

  const entryRows = await db
    .select({
      playerId: player.id,
      playerName: player.displayName,
      userName: user.name,
      userCountry: user.country,
    })
    .from(eventEntry)
    .innerJoin(player, eq(player.id, eventEntry.playerId))
    .leftJoin(user, eq(user.id, player.userId))
    .where(eq(eventEntry.tournamentId, foundTournament.id));

  const uniquePlayers = new Map<string, { playerId: string; playerName: string | null; userName: string | null; userCountry: string | null }>();
  for (const row of entryRows) {
    if (!uniquePlayers.has(row.playerId)) {
      uniquePlayers.set(row.playerId, row);
    }
  }

  const sortedPlayers = [...uniquePlayers.values()].sort((left, right) => {
    const countryCompare = (left.userCountry || "").localeCompare(right.userCountry || "");
    if (countryCompare !== 0) {
      return countryCompare;
    }

    const nameCompare = (left.playerName || left.userName || "").localeCompare(right.playerName || right.userName || "");
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return left.playerId.localeCompare(right.playerId);
  });

  if (sortedPlayers.length === 0) {
    throw createError({ statusCode: 400, message: "No registered players found for this tournament" });
  }

  const now = Date.now();
  const rowsToInsert = sortedPlayers.map((item, index) => ({
    id: crypto.randomUUID(),
    tournamentId: foundTournament.id,
    playerId: item.playerId,
    playerNumber: body.startAt + index * body.gap,
    assignmentMode: "auto",
    assignedBy: session.user.id,
    assignedAt: now,
    createdAt: now,
    updatedAt: now,
  }));

  await db.insert(tournamentPlayerNumber).values(rowsToInsert);

  return {
    success: true,
    assignedCount: rowsToInsert.length,
    startAt: body.startAt,
    gap: body.gap,
  };
});
