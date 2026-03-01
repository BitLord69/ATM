import { and, eq, notInArray } from "drizzle-orm";

import { editTournamentBodySchema, slugParamSchema } from "#shared/schemas/tournament-edit";

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
    throw createError({ statusCode: 400, message: slugResult.error.issues[0]?.message || "Tournament slug is required" });
  }
  const slug = slugResult.data.slug;

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const rawBody = await readBody(event);
  const bodyResult = editTournamentBodySchema.safeParse(rawBody);
  if (!bodyResult.success) {
    throw createError({
      statusCode: 400,
      message: bodyResult.error.issues[0]?.message || "Invalid request body",
    });
  }
  const body = bodyResult.data;

  const rows = await db
    .select({ id: tournament.id, endDate: tournament.endDate, closedAt: tournament.closedAt })
    .from(tournament)
    .where(eq(tournament.slug, slug))
    .limit(1);

  if (rows.length === 0) {
    throw createError({ statusCode: 404, message: "Tournament not found" });
  }

  const tournamentId = rows[0].id;
  const now = Date.now();

  if (rows[0].closedAt && session.user.role !== "admin") {
    throw createError({ statusCode: 403, message: "Closed tournaments can only be edited by sysadmin" });
  }

  if (body.closeTournament) {
    if (rows[0].closedAt) {
      throw createError({ statusCode: 400, message: "Tournament is already closed" });
    }

    if (!rows[0].endDate) {
      throw createError({ statusCode: 400, message: "Tournament must have an end date before it can be closed" });
    }

    if (now < rows[0].endDate) {
      throw createError({ statusCode: 400, message: "Tournament can only be closed on or after the end date" });
    }
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

  const effectiveEndDate = body.endDate ?? null;
  const effectiveClosedAt = body.closeTournament ? now : rows[0].closedAt;

  await db
    .update(tournament)
    .set({
      name: body.name.trim(),
      description: body.description ?? null,
      country: body.country ?? null,
      city: body.city ?? null,
      contactName: body.contactName ?? null,
      contactEmail: body.contactEmail ?? null,
      contactPhone: body.contactPhone ?? null,
      directorName: body.directorName ?? null,
      directorEmail: body.directorEmail ?? null,
      directorPhone: body.directorPhone ?? null,
      lat: body.lat,
      long: body.long,
      startDate: body.startDate ?? null,
      endDate: effectiveEndDate,
      closedAt: effectiveClosedAt,
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
    .where(eq(tournament.id, tournamentId));

  const inputVenues = body.venues || [];
  const venueFlagsById = new Map<number, {
    hasGolf: boolean;
    hasAccuracy: boolean;
    hasDistance: boolean;
    hasSCF: boolean;
    hasDiscathon: boolean;
    hasDDC: boolean;
    hasFreestyle: boolean;
  }>();

  function buildVenueFlags(inputVenue: typeof inputVenues[number]) {
    return {
      hasGolf: !!inputVenue.hasGolf,
      hasAccuracy: !!inputVenue.hasAccuracy,
      hasDistance: !!inputVenue.hasDistance,
      hasSCF: !!inputVenue.hasSCF,
      hasDiscathon: !!inputVenue.hasDiscathon,
      hasDDC: !!inputVenue.hasDDC,
      hasFreestyle: !!inputVenue.hasFreestyle,
    };
  }

  const linkedRows = await db
    .select({
      venueId: tournamentVenue.venueId,
    })
    .from(tournamentVenue)
    .where(eq(tournamentVenue.tournamentId, tournamentId));

  const linkedVenueIds = linkedRows.map(v => v.venueId);
  const finalVenueIds: number[] = [];

  for (const inputVenue of inputVenues) {
    if (inputVenue.id) {
      const existing = await db
        .select({ id: venue.id })
        .from(venue)
        .where(eq(venue.id, inputVenue.id))
        .limit(1);

      if (existing.length > 0) {
        if (linkedVenueIds.includes(inputVenue.id)) {
          await db
            .update(tournamentVenue)
            .set({
              ...buildVenueFlags(inputVenue),
              changedBy,
              changedAt: Date.now(),
            })
            .where(
              and(
                eq(tournamentVenue.tournamentId, tournamentId),
                eq(tournamentVenue.venueId, inputVenue.id),
              ),
            );
        }

        venueFlagsById.set(inputVenue.id, buildVenueFlags(inputVenue));
        finalVenueIds.push(inputVenue.id);
        continue;
      }
    }

    if (!inputVenue.name?.trim()) {
      continue;
    }

    if (typeof inputVenue.lat !== "number" || typeof inputVenue.long !== "number") {
      continue;
    }

    const inserted = await db
      .insert(venue)
      .values({
        name: inputVenue.name.trim(),
        description: inputVenue.description ?? null,
        facilities: inputVenue.facilities ?? null,
        lat: inputVenue.lat,
        long: inputVenue.long,
        hasGolf: !!inputVenue.hasGolf,
        hasAccuracy: !!inputVenue.hasAccuracy,
        hasDistance: !!inputVenue.hasDistance,
        hasSCF: !!inputVenue.hasSCF,
        hasDiscathon: !!inputVenue.hasDiscathon,
        hasDDC: !!inputVenue.hasDDC,
        hasFreestyle: !!inputVenue.hasFreestyle,
        changedBy,
        changedAt: Date.now(),
      })
      .returning({ id: venue.id });

    if (inserted[0]?.id) {
      finalVenueIds.push(inserted[0].id);
      venueFlagsById.set(inserted[0].id, buildVenueFlags(inputVenue));
    }
  }

  const uniqueFinalVenueIds = [...new Set(finalVenueIds)];

  if (linkedVenueIds.length > 0 && uniqueFinalVenueIds.length === 0) {
    await db.delete(tournamentVenue).where(eq(tournamentVenue.tournamentId, tournamentId));
  }
  else if (linkedVenueIds.length > 0 && uniqueFinalVenueIds.length > 0) {
    await db
      .delete(tournamentVenue)
      .where(
        and(
          eq(tournamentVenue.tournamentId, tournamentId),
          notInArray(tournamentVenue.venueId, uniqueFinalVenueIds),
        ),
      );
  }

  const missingLinks = uniqueFinalVenueIds.filter(id => !linkedVenueIds.includes(id));
  if (missingLinks.length > 0) {
    await db.insert(tournamentVenue).values(
      missingLinks.map(id => ({
        tournamentId,
        venueId: id,
        ...(venueFlagsById.get(id) || {
          hasGolf: false,
          hasAccuracy: false,
          hasDistance: false,
          hasSCF: false,
          hasDiscathon: false,
          hasDDC: false,
          hasFreestyle: false,
        }),
        changedBy,
        changedAt: Date.now(),
      })),
    );
  }

  const updated = await db
    .select({ slug: tournament.slug })
    .from(tournament)
    .where(eq(tournament.id, tournamentId))
    .limit(1);

  return {
    success: true,
    slug: updated[0]?.slug || slug,
  };
});
