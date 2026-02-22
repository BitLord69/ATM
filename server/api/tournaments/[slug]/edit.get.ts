import { and, eq } from "drizzle-orm";

import { slugParamSchema } from "#shared/schemas/tournament-edit";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { tournament, tournamentMembership, tournamentVenue, venue } from "../../../../lib/db/schema";

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
      lat: tournament.lat,
      long: tournament.long,
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
      venueId: venue.id,
      venueName: venue.name,
      venueDescription: venue.description,
      venueFacilities: venue.facilities,
      venueLat: venue.lat,
      venueLong: venue.long,
    })
    .from(tournament)
    .leftJoin(tournamentVenue, eq(tournamentVenue.tournamentId, tournament.id))
    .leftJoin(venue, eq(venue.id, tournamentVenue.venueId))
    .where(eq(tournament.slug, slug))
    ;

  if (rows.length === 0) {
    throw createError({
      statusCode: 404,
      message: "Tournament not found",
    });
  }

  const t = rows[0];

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
    }));

  const availableVenues = await db
    .select({
      id: venue.id,
      name: venue.name,
      description: venue.description,
      facilities: venue.facilities,
      lat: venue.lat,
      long: venue.long,
    })
    .from(venue);

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
    lat: t.lat,
    long: t.long,
    startDate: t.startDate,
    endDate: t.endDate,
    hasGolf: t.hasGolf,
    hasAccuracy: t.hasAccuracy,
    hasDistance: t.hasDistance,
    hasSCF: t.hasSCF,
    hasDiscathon: t.hasDiscathon,
    hasDDC: t.hasDDC,
    hasFreestyle: t.hasFreestyle,
    organizationId: t.organizationId,
    venues,
    availableVenues,
  };
});
