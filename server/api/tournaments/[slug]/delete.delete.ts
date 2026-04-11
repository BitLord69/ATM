import { and, eq } from "drizzle-orm";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { tournament, tournamentMembership } from "../../../../lib/db/schema";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw createError({ statusCode: 400, message: "Tournament slug is required" });
  }

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const rows = await db
    .select({ id: tournament.id })
    .from(tournament)
    .where(eq(tournament.slug, slug))
    .limit(1);

  const [tournamentRow] = rows;

  if (!tournamentRow) {
    throw createError({ statusCode: 404, message: "Tournament not found" });
  }

  const tournamentId = tournamentRow.id;

  if (session.user.role !== "admin") {
    const membershipRows = await db
      .select({ role: tournamentMembership.role, status: tournamentMembership.status })
      .from(tournamentMembership)
      .where(
        and(
          eq(tournamentMembership.tournamentId, tournamentId),
          eq(tournamentMembership.userId, session.user.id),
        ),
      )
      .limit(1);

    const membership = membershipRows[0];
    const canDelete = membership?.status === "active" && (membership.role === "owner" || membership.role === "admin");

    if (!canDelete) {
      throw createError({ statusCode: 403, message: "Forbidden" });
    }
  }

  await db.delete(tournament).where(eq(tournament.id, tournamentId));

  return { success: true };
});
