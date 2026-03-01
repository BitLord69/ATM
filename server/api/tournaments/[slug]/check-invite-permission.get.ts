import { and, eq } from "drizzle-orm";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { tournament, tournamentMembership } from "../../../../lib/db/schema";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: "Tournament slug is required",
    });
  }

  const tournaments = await db
    .select({ id: tournament.id, endDate: tournament.endDate, closedAt: tournament.closedAt })
    .from(tournament)
    .where(eq(tournament.slug, slug))
    .limit(1);

  if (tournaments.length === 0) {
    throw createError({
      statusCode: 404,
      message: "Tournament not found",
    });
  }

  const tournamentId = tournaments[0].id;
  const isClosed = tournaments[0].closedAt != null;
  const hasEnded = typeof tournaments[0].endDate === "number" ? tournaments[0].endDate < Date.now() : false;
  const session = await auth.api.getSession({ headers: event.headers });

  if (!session?.user) {
    return { canInvite: false };
  }

  const user = session.user;

  if (isClosed || hasEnded) {
    return { canInvite: false };
  }

  if (user.role === "admin") {
    return { canInvite: true };
  }

  const memberships = await db
    .select({
      role: tournamentMembership.role,
      status: tournamentMembership.status,
    })
    .from(tournamentMembership)
    .where(
      and(
        eq(tournamentMembership.userId, user.id),
        eq(tournamentMembership.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (memberships.length === 0) {
    return { canInvite: false };
  }

  const membership = memberships[0];
  const canInvite = membership.status === "active" && (membership.role === "owner" || membership.role === "admin");

  return { canInvite };
});
