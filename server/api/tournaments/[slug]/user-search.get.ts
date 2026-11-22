import { and, asc, eq, or, sql } from "drizzle-orm";

import { tournamentUserSearchQuerySchema } from "#shared/schemas/divisions";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { user } from "../../../../lib/db/schema";
import { hasTournamentRole } from "../../../utils/authorization";
import { loadRegistrationTournament, loadTournamentMembership } from "../../../utils/tournament-registration-context";

const MAX_RESULTS = 20;

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, char => `\\${char}`);
}

/**
 * Minimal user search for TD/Scorer registering existing platform users into a tournament.
 * Requires at least 2 characters, returns at most 20 non-banned users and only minimal fields.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, message: "Tournament slug is required" });
  }

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const queryResult = tournamentUserSearchQuerySchema.safeParse(getQuery(event));
  if (!queryResult.success) {
    throw createError({ statusCode: 400, message: queryResult.error.issues[0]?.message || "Invalid search query" });
  }

  const foundTournament = await loadRegistrationTournament(slug);
  const membership = await loadTournamentMembership(foundTournament.id, session.user.id);

  if (!hasTournamentRole(session.user.role, membership, "scorer")) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const pattern = `%${escapeLikePattern(queryResult.data.q.toLowerCase())}%`;

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      country: user.country,
    })
    .from(user)
    .where(
      and(
        eq(user.banned, false),
        or(
          sql`lower(${user.name}) like ${pattern} escape '\\'`,
          sql`lower(${user.email}) like ${pattern} escape '\\'`,
        ),
      ),
    )
    .orderBy(asc(user.name))
    .limit(MAX_RESULTS);

  return { users };
});
