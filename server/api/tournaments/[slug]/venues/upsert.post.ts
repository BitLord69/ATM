import { and, eq } from "drizzle-orm";

import { slugParamSchema, venueInputSchema } from "#shared/schemas/tournament-edit";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { tournament, tournamentMembership, tournamentVenue, venue } from "../../../../../lib/db/schema";

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
    throw createError({ statusCode: 400, message: slugResult.error.issues[0]?.message || "Tournament slug is required" });
  }

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const bodyResult = venueInputSchema.safeParse(await readBody(event));
  if (!bodyResult.success) {
    throw createError({
      statusCode: 400,
      message: bodyResult.error.issues[0]?.message || "Invalid venue payload",
    });
  }
  const body = bodyResult.data;

  const tournamentRows = await db
    .select({ id: tournament.id, closedAt: tournament.closedAt })
    .from(tournament)
    .where(eq(tournament.slug, slugResult.data.slug))
    .limit(1);

  if (tournamentRows.length === 0) {
    throw createError({ statusCode: 404, message: "Tournament not found" });
  }

  const tournamentId = tournamentRows[0].id;
  if (tournamentRows[0].closedAt && session.user.role !== "admin") {
    throw createError({ statusCode: 403, message: "Closed tournaments can only be edited by sysadmin" });
  }

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
  if (!canEditTournament(session.user.role, membership)) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const changedBy = session.user.id as any;

  let venueId = body.id;

  if (venueId) {
    const existing = await db
      .select({ id: venue.id })
      .from(venue)
      .where(eq(venue.id, venueId))
      .limit(1);

    if (existing.length === 0) {
      throw createError({ statusCode: 404, message: "Venue not found" });
    }
  }
  else {
    const inserted = await db
      .insert(venue)
      .values({
        name: body.name.trim(),
        description: body.description ?? null,
        facilities: body.facilities ?? null,
        lat: body.lat,
        long: body.long,
        hasGolf: !!body.hasGolf,
        hasAccuracy: !!body.hasAccuracy,
        hasDistance: !!body.hasDistance,
        hasSCF: !!body.hasSCF,
        hasDiscathon: !!body.hasDiscathon,
        hasDDC: !!body.hasDDC,
        hasFreestyle: !!body.hasFreestyle,
        changedBy,
        changedAt: Date.now(),
      })
      .returning({ id: venue.id });

    venueId = inserted[0]?.id;
  }

  if (!venueId) {
    throw createError({ statusCode: 500, message: "Failed to resolve venue id" });
  }

  const linkRows = await db
    .select({ id: tournamentVenue.id })
    .from(tournamentVenue)
    .where(
      and(
        eq(tournamentVenue.tournamentId, tournamentId),
        eq(tournamentVenue.venueId, venueId),
      ),
    )
    .limit(1);

  const linkValues = {
    hasGolf: !!body.hasGolf,
    hasAccuracy: !!body.hasAccuracy,
    hasDistance: !!body.hasDistance,
    hasSCF: !!body.hasSCF,
    hasDiscathon: !!body.hasDiscathon,
    hasDDC: !!body.hasDDC,
    hasFreestyle: !!body.hasFreestyle,
    changedBy,
    changedAt: Date.now(),
  };

  if (linkRows.length > 0) {
    await db
      .update(tournamentVenue)
      .set(linkValues)
      .where(eq(tournamentVenue.id, linkRows[0].id));
  }
  else {
    await db.insert(tournamentVenue).values({
      tournamentId,
      venueId,
      ...linkValues,
    });
  }

  const venueRows = await db
    .select({
      id: venue.id,
      name: venue.name,
      description: venue.description,
      facilities: venue.facilities,
      lat: venue.lat,
      long: venue.long,
    })
    .from(venue)
    .where(eq(venue.id, venueId))
    .limit(1);

  if (venueRows.length === 0) {
    throw createError({ statusCode: 404, message: "Venue not found" });
  }

  return {
    success: true,
    venue: {
      id: venueRows[0].id,
      name: venueRows[0].name,
      description: venueRows[0].description,
      facilities: venueRows[0].facilities,
      lat: venueRows[0].lat,
      long: venueRows[0].long,
      hasGolf: !!body.hasGolf,
      hasAccuracy: !!body.hasAccuracy,
      hasDistance: !!body.hasDistance,
      hasSCF: !!body.hasSCF,
      hasDiscathon: !!body.hasDiscathon,
      hasDDC: !!body.hasDDC,
      hasFreestyle: !!body.hasFreestyle,
    },
  };
});
