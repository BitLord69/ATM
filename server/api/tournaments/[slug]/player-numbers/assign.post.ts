import { and, eq } from "drizzle-orm";

import { playerNumberManualAssignBodySchema } from "#shared/schemas/player-numbers";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { eventEntry, tournament, tournamentMembership, tournamentPlayerNumber } from "../../../../../lib/db/schema";

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

  const bodyResult = playerNumberManualAssignBodySchema.safeParse(await readBody(event));
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

  const hasEntryRows = await db
    .select({ id: eventEntry.id })
    .from(eventEntry)
    .where(
      and(
        eq(eventEntry.tournamentId, foundTournament.id),
        eq(eventEntry.playerId, body.playerId),
      ),
    )
    .limit(1);

  if (hasEntryRows.length === 0) {
    throw createError({ statusCode: 404, message: "Player is not registered in this tournament" });
  }

  const existingPlayerNumberRows = await db
    .select({ id: tournamentPlayerNumber.id })
    .from(tournamentPlayerNumber)
    .where(
      and(
        eq(tournamentPlayerNumber.tournamentId, foundTournament.id),
        eq(tournamentPlayerNumber.playerId, body.playerId),
      ),
    )
    .limit(1);

  if (existingPlayerNumberRows.length > 0) {
    throw createError({
      statusCode: 409,
      message: "This player already has a tournament player number. Existing numbers are not auto-overwritten.",
    });
  }

  const existingNumberRows = await db
    .select({ id: tournamentPlayerNumber.id })
    .from(tournamentPlayerNumber)
    .where(
      and(
        eq(tournamentPlayerNumber.tournamentId, foundTournament.id),
        eq(tournamentPlayerNumber.playerNumber, body.playerNumber),
      ),
    )
    .limit(1);

  if (existingNumberRows.length > 0) {
    throw createError({ statusCode: 409, message: "This tournament player number is already in use" });
  }

  const now = Date.now();
  await db.insert(tournamentPlayerNumber).values({
    id: crypto.randomUUID(),
    tournamentId: foundTournament.id,
    playerId: body.playerId,
    playerNumber: body.playerNumber,
    assignmentMode: "manual",
    assignedBy: session.user.id,
    assignedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return {
    success: true,
    playerId: body.playerId,
    playerNumber: body.playerNumber,
    assignmentMode: "manual",
  };
});
