import { and, eq } from "drizzle-orm";

import { slugParamSchema } from "#shared/schemas/tournament-edit";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { tournament, tournamentMembership, tournamentVenue, venue } from "../../../../lib/db/schema";
import { distanceKm } from "../../../utils/geo";

function canEditTournament(globalRole: string | undefined, membership: { role: string; status: string } | undefined) {
  if (globalRole === "admin") {
    return true;
  }
  if (!membership || membership.status !== "active") {
    return false;
  }
  return ["owner", "admin", "td"].includes(membership.role);
}

export default defineEventHandler(async (event) => {
  const radiusQuery = Number(getQuery(event).radiusKm);
  const requestedRadiusKm = Number.isFinite(radiusQuery) ? Math.round(radiusQuery) : 300;
  const nearbyRadiusKm = Math.max(10, Math.min(2000, requestedRadiusKm));

  const slugResult = slugParamSchema.safeParse({ slug: getRouterParam(event, "slug") });

  if (!slugResult.success) {
    throw createError({
      statusCode: 400,
      message: slugResult.error.issues[0]?.message || "Tournament slug is required",
    });
  }

  const slug = slugResult.data.slug;

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const rows = await db
    .select({
      id: tournament.id,
      name: tournament.name,
      slug: tournament.slug,
      description: tournament.description,
      country: tournament.country,
      city: tournament.city,
      contactName: tournament.contactName,
      contactEmail: tournament.contactEmail,
      contactPhone: tournament.contactPhone,
      directorName: tournament.directorName,
      directorEmail: tournament.directorEmail,
      directorPhone: tournament.directorPhone,
      lat: tournament.lat,
      long: tournament.long,
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
      banRequestEmailEnabled: tournament.banRequestEmailEnabled,
      organizationId: tournament.organizationId,
      venueId: venue.id,
      venueName: venue.name,
      venueDescription: venue.description,
      venueFacilities: venue.facilities,
      venueLat: venue.lat,
      venueLong: venue.long,
      venueBaseHasGolf: venue.hasGolf,
      venueBaseHasAccuracy: venue.hasAccuracy,
      venueBaseHasDistance: venue.hasDistance,
      venueBaseHasSCF: venue.hasSCF,
      venueBaseHasDiscathon: venue.hasDiscathon,
      venueBaseHasDDC: venue.hasDDC,
      venueBaseHasFreestyle: venue.hasFreestyle,
      venueHasGolf: tournamentVenue.hasGolf,
      venueHasAccuracy: tournamentVenue.hasAccuracy,
      venueHasDistance: tournamentVenue.hasDistance,
      venueHasSCF: tournamentVenue.hasSCF,
      venueHasDiscathon: tournamentVenue.hasDiscathon,
      venueHasDDC: tournamentVenue.hasDDC,
      venueHasFreestyle: tournamentVenue.hasFreestyle,
    })
    .from(tournament)
    .leftJoin(tournamentVenue, eq(tournamentVenue.tournamentId, tournament.id))
    .leftJoin(venue, eq(venue.id, tournamentVenue.venueId))
    .where(eq(tournament.slug, slug))
    ;

  const [t] = rows;

  if (!t) {
    throw createError({
      statusCode: 404,
      message: "Tournament not found",
    });
  }

  if (t.closedAt && session.user.role !== "admin") {
    throw createError({
      statusCode: 403,
      message: "Closed tournaments can only be edited by sysadmin",
    });
  }

  const membershipRows = await db
    .select({
      role: tournamentMembership.role,
      status: tournamentMembership.status,
    })
    .from(tournamentMembership)
    .where(
      and(
        eq(tournamentMembership.tournamentId, t.id),
        eq(tournamentMembership.userId, session.user.id),
      ),
    )
    .limit(1);

  const membership = membershipRows[0];
  if (!canEditTournament(session.user.role, membership)) {
    throw createError({
      statusCode: 403,
      message: "Forbidden",
    });
  }

  const venues = rows
    .filter(row => row.venueId != null)
    .map(row => ({
      id: row.venueId as number,
      name: row.venueName as string,
      description: row.venueDescription,
      facilities: row.venueFacilities,
      lat: row.venueLat as number,
      long: row.venueLong as number,
      baseHasGolf: !!row.venueBaseHasGolf,
      baseHasAccuracy: !!row.venueBaseHasAccuracy,
      baseHasDistance: !!row.venueBaseHasDistance,
      baseHasSCF: !!row.venueBaseHasSCF,
      baseHasDiscathon: !!row.venueBaseHasDiscathon,
      baseHasDDC: !!row.venueBaseHasDDC,
      baseHasFreestyle: !!row.venueBaseHasFreestyle,
      hasGolf: !!row.venueHasGolf,
      hasAccuracy: !!row.venueHasAccuracy,
      hasDistance: !!row.venueHasDistance,
      hasSCF: !!row.venueHasSCF,
      hasDiscathon: !!row.venueHasDiscathon,
      hasDDC: !!row.venueHasDDC,
      hasFreestyle: !!row.venueHasFreestyle,
    }));

  const availableVenues = await db
    .select({
      id: venue.id,
      name: venue.name,
      description: venue.description,
      facilities: venue.facilities,
      lat: venue.lat,
      long: venue.long,
      hasGolf: venue.hasGolf,
      hasAccuracy: venue.hasAccuracy,
      hasDistance: venue.hasDistance,
      hasSCF: venue.hasSCF,
      hasDiscathon: venue.hasDiscathon,
      hasDDC: venue.hasDDC,
      hasFreestyle: venue.hasFreestyle,
    })
    .from(venue);

  const hasTournamentCoordinates = typeof t.lat === "number" && typeof t.long === "number" && t.lat !== 0 && t.long !== 0;
  const availableNearbyVenues = hasTournamentCoordinates
    ? availableVenues.filter(v => distanceKm(t.lat as number, t.long as number, v.lat, v.long) <= nearbyRadiusKm)
    : availableVenues;

  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    country: t.country,
    city: t.city,
    contactName: t.contactName,
    contactEmail: t.contactEmail,
    contactPhone: t.contactPhone,
    directorName: t.directorName,
    directorEmail: t.directorEmail,
    directorPhone: t.directorPhone,
    lat: t.lat,
    long: t.long,
    startDate: t.startDate,
    endDate: t.endDate,
    closedAt: t.closedAt,
    hasGolf: t.hasGolf,
    hasAccuracy: t.hasAccuracy,
    hasDistance: t.hasDistance,
    hasSCF: t.hasSCF,
    hasDiscathon: t.hasDiscathon,
    hasDDC: t.hasDDC,
    hasFreestyle: t.hasFreestyle,
    banRequestEmailEnabled: t.banRequestEmailEnabled,
    organizationId: t.organizationId,
    venues,
    availableVenues: availableNearbyVenues,
    availableVenueRadiusKm: nearbyRadiusKm,
  };
});
