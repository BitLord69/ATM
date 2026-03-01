import { eq } from "drizzle-orm";

import { auth } from "../../../lib/auth";
import db from "../../../lib/db";
import { tournament, tournamentMembership } from "../../../lib/db/schema";
import { getTournamentStatus } from "../../utils/authorization";

export default defineEventHandler(async (event) => {
  // Get authenticated user from better-auth session
  const session = await auth.api.getSession({ headers: event.headers });

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const userId = session.user.id;
  const userRole = session.user.role;

  // Fetch all tournament memberships for the current user
  const memberships = await db
    .select({
      membershipId: tournamentMembership.id,
      tournamentId: tournamentMembership.tournamentId,
      organizationId: tournamentMembership.organizationId,
      role: tournamentMembership.role,
      status: tournamentMembership.status,
      tournamentName: tournament.name,
      tournamentSlug: tournament.slug,
      tournamentDescription: tournament.description,
      country: tournament.country,
      city: tournament.city,
      contactName: tournament.contactName,
      contactEmail: tournament.contactEmail,
      contactPhone: tournament.contactPhone,
      contactUserId: tournament.contactUserId,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      closedAt: tournament.closedAt,
      hasGolf: tournament.hasGolf,
      hasAccuracy: tournament.hasAccuracy,
      hasDistance: tournament.hasDistance,
      hasSCF: tournament.hasSCF,
      hasDiscathon: tournament.hasDiscathon,
      hasDDC: tournament.hasDDC,
      hasFreestyle: tournament.hasFreestyle,
    })
    .from(tournamentMembership)
    .innerJoin(tournament, eq(tournamentMembership.tournamentId, tournament.id))
    .where(eq(tournamentMembership.userId, userId));

  // Enrich with computed status
  const enrichedTournaments = memberships.map((m) => {
    const tournamentStatus = getTournamentStatus(m.startDate, m.endDate);
    const isClosed = m.closedAt != null;
    const hasEnded = typeof m.endDate === "number" ? m.endDate < Date.now() : false;
    const isActiveMembership = m.status === "active";
    const isPrivilegedMember = m.role === "owner" || m.role === "admin";
    const canEdit = userRole === "admin" || (isActiveMembership && !isClosed && !hasEnded && (m.role === "owner" || m.role === "admin" || m.role === "td"));
    const canInvite = !isClosed && !hasEnded && (userRole === "admin" || (isActiveMembership && isPrivilegedMember));

    return {
      ...m,
      tournamentStatus,
      isActive: tournamentStatus === "active",
      isClosed,
      canEdit,
      canInvite,
    };
  });

  return {
    tournaments: enrichedTournaments,
    isSysadmin: userRole === "admin",
  };
});
