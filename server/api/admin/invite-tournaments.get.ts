import { and, asc, eq, exists, gte, isNotNull, isNull, or } from "drizzle-orm";

import { auth } from "../../../lib/auth";
import db from "../../../lib/db";
import { organization, tournament, tournamentMembership } from "../../../lib/db/schema";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const isAdmin = session.user.role === "admin";

  if (!isAdmin) {
    const tdMembership = await db
      .select({ id: tournamentMembership.id })
      .from(tournamentMembership)
      .where(
        and(
          eq(tournamentMembership.userId, session.user.id),
          eq(tournamentMembership.role, "td"),
          eq(tournamentMembership.status, "active"),
        ),
      )
      .limit(1);

    if (tdMembership.length === 0) {
      throw createError({ statusCode: 403, message: "Forbidden" });
    }
  }

  const now = Date.now();

  const activeOrUpcomingTournamentCondition = and(
    isNotNull(tournament.organizationId),
    isNull(tournament.closedAt),
    or(isNull(tournament.endDate), gte(tournament.endDate, now)),
  );

  const tdScopeCondition = exists(
    db
      .select({ id: tournamentMembership.id })
      .from(tournamentMembership)
      .where(
        and(
          eq(tournamentMembership.tournamentId, tournament.id),
          eq(tournamentMembership.userId, session.user.id),
          eq(tournamentMembership.role, "td"),
          eq(tournamentMembership.status, "active"),
        ),
      ),
  );

  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    })
    .from(organization)
    .where(
      exists(
        db
          .select({ id: tournament.id })
          .from(tournament)
          .where(
            and(
              eq(tournament.organizationId, organization.id),
              activeOrUpcomingTournamentCondition,
              isAdmin ? undefined : tdScopeCondition,
            ),
          ),
      ),
    )
    .orderBy(asc(organization.name));

  return rows;
});
