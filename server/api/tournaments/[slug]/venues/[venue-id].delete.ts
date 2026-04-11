import { and, eq } from "drizzle-orm";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { tournament, tournamentMembership, tournamentVenue, venue } from "../../../../../lib/db/schema";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  const venueId = Number(getRouterParam(event, "venue-id"));

  if (!slug || !Number.isFinite(venueId) || venueId <= 0) {
    throw createError({ statusCode: 400, message: "Invalid tournament slug or venue id" });
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

  const [tournamentRow] = tournamentRows;

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
    const canDeleteVenue = membership?.status === "active" && (membership.role === "owner" || membership.role === "admin");

    if (!canDeleteVenue) {
      throw createError({ statusCode: 403, message: "Forbidden" });
    }
  }

  const linkedToTournament = await db
    .select({ id: tournamentVenue.id })
    .from(tournamentVenue)
    .where(
      and(
        eq(tournamentVenue.tournamentId, tournamentId),
        eq(tournamentVenue.venueId, venueId),
      ),
    )
    .limit(1);

  if (linkedToTournament.length === 0) {
    throw createError({ statusCode: 404, message: "Venue is not linked to this tournament" });
  }

  const otherLinks = await db
    .select({ id: tournamentVenue.id })
    .from(tournamentVenue)
    .where(eq(tournamentVenue.venueId, venueId));

  if (otherLinks.length > 1) {
    throw createError({
      statusCode: 409,
      message: "Venue is linked to multiple tournaments. Remove it from this tournament instead of deleting globally.",
    });
  }

  await db.delete(tournamentVenue).where(eq(tournamentVenue.venueId, venueId));
  await db.delete(venue).where(eq(venue.id, venueId));

  return { success: true };
});
