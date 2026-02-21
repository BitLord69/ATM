import { eq } from "drizzle-orm";

import db from "../../../lib/db";
import { tournament, tournamentVenue, venue } from "../../../lib/db/schema";
import { getTournamentStatus } from "../../utils/authorization.ts";

/**
 * Public API endpoint - returns tournament details by slug
 * Accessible to all users including guests
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: "Tournament slug is required",
    });
  }

  const tournaments = await db
    .select({
      id: tournament.id,
      name: tournament.name,
      slug: tournament.slug,
      description: tournament.description,
      country: tournament.country,
      city: tournament.city,
      lat: tournament.lat,
      long: tournament.long,
      contactName: tournament.contactName,
      contactEmail: tournament.contactEmail,
      contactPhone: tournament.contactPhone,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      hasGolf: tournament.hasGolf,
      hasAccuracy: tournament.hasAccuracy,
      hasDistance: tournament.hasDistance,
      hasSCF: tournament.hasSCF,
      hasDiscathon: tournament.hasDiscathon,
      hasDDC: tournament.hasDDC,
      hasFreestyle: tournament.hasFreestyle,
      organizationId: tournament.organizationId,
    })
    .from(tournament)
    .where(eq(tournament.slug, slug))
    .limit(1);

  if (tournaments.length === 0) {
    throw createError({
      statusCode: 404,
      message: "Tournament not found",
    });
  }

  const t = tournaments[0];
  const tournamentStatus = getTournamentStatus(t.startDate, t.endDate);

  // Fetch associated venues for discipline locations
  const venues = await db
    .select({
      id: venue.id,
      name: venue.name,
      description: venue.description,
      facilities: venue.facilities,
      lat: venue.lat,
      long: venue.long,
    })
    .from(tournamentVenue)
    .innerJoin(venue, eq(tournamentVenue.venueId, venue.id))
    .where(eq(tournamentVenue.tournamentId, t.id));

  return {
    ...t,
    status: tournamentStatus,
    isActive: tournamentStatus === "active",
    venues,
  };
});
