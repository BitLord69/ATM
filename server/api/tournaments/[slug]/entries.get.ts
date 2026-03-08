import { and, asc, eq } from "drizzle-orm";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { eventEntry, player, tournament, tournamentMembership, user } from "../../../../lib/db/schema";

function canManageTournament(globalRole: string | undefined, membership: { role: string; status: string } | undefined) {
  if (globalRole === "admin") {
    return true;
  }

  if (!membership || membership.status !== "active") {
    return false;
  }

  return ["owner", "admin", "td", "scorer", "viewer"].includes(membership.role);
}

function safeParseMinorTags(raw: string | null | undefined) {
  if (!raw) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
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

  const rows = await db
    .select({
      id: eventEntry.id,
      playerId: eventEntry.playerId,
      discipline: eventEntry.discipline,
      majorDivision: eventEntry.majorDivision,
      minorDivisionTags: eventEntry.minorDivisionTags,
      primaryMinorDivision: eventEntry.primaryMinorDivision,
      activeCompetitiveDivision: eventEntry.activeCompetitiveDivision,
      status: eventEntry.status,
      createdAt: eventEntry.createdAt,
      playerDisplayName: player.displayName,
      playerDateOfBirth: player.dateOfBirth,
      playerGenderCategory: player.genderCategory,
      userName: user.name,
      userEmail: user.email,
    })
    .from(eventEntry)
    .innerJoin(player, eq(player.id, eventEntry.playerId))
    .leftJoin(user, eq(user.id, player.userId))
    .where(eq(eventEntry.tournamentId, foundTournament.id))
    .orderBy(asc(eventEntry.discipline), asc(eventEntry.majorDivision), asc(eventEntry.createdAt));

  return {
    tournamentId: foundTournament.id,
    entries: rows.map(row => ({
      ...row,
      minorDivisionTags: safeParseMinorTags(row.minorDivisionTags),
    })),
  };
});
