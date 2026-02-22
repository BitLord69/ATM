import { and, eq } from "drizzle-orm";

import type { TournamentContext } from "../../../utils/authorization";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { tournament, tournamentMembership } from "../../../../lib/db/schema";
import { can } from "../../../utils/authorization";

/**
 * Check if the current user can edit a tournament
 * Returns { canEdit: boolean }
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: "Tournament slug is required",
    });
  }

  // Get the tournament
  const tournaments = await db
    .select({ id: tournament.id })
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

  // Get authenticated user
  const session = await auth.api.getSession({ headers: event.headers });

  if (!session?.user) {
    return { canEdit: false };
  }

  const user = session.user;

  // Sysadmins can always edit
  if (user.role === "admin") {
    return { canEdit: true };
  }

  // Check if user is a member of this tournament
  const memberships = await db
    .select({
      role: tournamentMembership.role,
      status: tournamentMembership.status,
      organizationId: tournamentMembership.organizationId,
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
    return { canEdit: false };
  }

  const membership = memberships[0];

  // Check if membership is active
  if (membership.status !== "active") {
    return { canEdit: false };
  }

  const tournamentContext: TournamentContext = {
    tournamentId,
    organizationId: membership.organizationId,
    role: membership.role,
    status: "active", // We already checked above
  };

  const canEdit = can({ id: user.id, email: user.email || "", role: user.role as any }, "tournament:edit", tournamentContext);

  return { canEdit };
});
