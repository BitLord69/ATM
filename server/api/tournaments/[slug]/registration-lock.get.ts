import { and, eq } from "drizzle-orm";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { tournament, tournamentMembership, tournamentRegistrationLock } from "../../../../lib/db/schema";

function canViewRegistrationLock(globalRole: string | undefined, membership: { role: string; status: string } | undefined) {
  if (globalRole === "admin") {
    return true;
  }

  if (!membership || membership.status !== "active") {
    return false;
  }

  return ["owner", "admin", "td", "scorer", "viewer"].includes(membership.role);
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
    .select({ id: tournament.id, startDate: tournament.startDate })
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

  if (!canViewRegistrationLock(session.user.role, membershipRows[0])) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const lockRows = await db
    .select({ isLocked: tournamentRegistrationLock.isLocked, lockedBy: tournamentRegistrationLock.lockedBy, lockedAt: tournamentRegistrationLock.lockedAt })
    .from(tournamentRegistrationLock)
    .where(eq(tournamentRegistrationLock.tournamentId, foundTournament.id))
    .limit(1);

  const lock = lockRows[0] ?? { isLocked: false, lockedBy: null, lockedAt: null };

  return {
    tournamentId: foundTournament.id,
    hasStarted: !!foundTournament.startDate && Date.now() >= foundTournament.startDate,
    lock: {
      isLocked: !!lock.isLocked,
      lockedBy: lock.lockedBy,
      lockedAt: lock.lockedAt,
    },
  };
});
