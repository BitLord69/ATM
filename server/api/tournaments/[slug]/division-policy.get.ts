import { and, asc, eq } from "drizzle-orm";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { divisionPolicy, tournament, tournamentDivision, tournamentMembership } from "../../../../lib/db/schema";

function canManageTournament(globalRole: string | undefined, membership: { role: string; status: string } | undefined) {
  if (globalRole === "admin") {
    return true;
  }

  if (!membership || membership.status !== "active") {
    return false;
  }

  return ["owner", "admin", "td"].includes(membership.role);
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

  const policyRows = await db
    .select({
      id: divisionPolicy.id,
      ageReferenceMode: divisionPolicy.ageReferenceMode,
      startingListMode: divisionPolicy.startingListMode,
      showMinorOverlays: divisionPolicy.showMinorOverlays,
    })
    .from(divisionPolicy)
    .where(eq(divisionPolicy.tournamentId, foundTournament.id))
    .limit(1);

  const offeredDivisions = await db
    .select({
      id: tournamentDivision.id,
      code: tournamentDivision.code,
      label: tournamentDivision.label,
      isEnabled: tournamentDivision.isEnabled,
      sortOrder: tournamentDivision.sortOrder,
    })
    .from(tournamentDivision)
    .where(eq(tournamentDivision.tournamentId, foundTournament.id))
    .orderBy(asc(tournamentDivision.sortOrder), asc(tournamentDivision.code));

  const policy = policyRows[0] ?? {
    id: null,
    ageReferenceMode: "calendar_year",
    startingListMode: "major_only",
    showMinorOverlays: true,
  };

  return {
    tournamentId: foundTournament.id,
    policy,
    divisions: offeredDivisions,
  };
});
