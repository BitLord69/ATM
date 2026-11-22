import type { BatchItem } from "drizzle-orm/batch";

import { and, asc, eq } from "drizzle-orm";

import { slugParamSchema, venueInputSchema } from "#shared/schemas/tournament-edit";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { tournament, tournamentMembership, tournamentVenue, venue, venueCourseLayout } from "../../../../../lib/db/schema";
import { hasTournamentRole } from "../../../../utils/authorization";

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

  const [tournamentRow] = tournamentRows;

  if (!tournamentRow) {
    throw createError({ statusCode: 404, message: "Tournament not found" });
  }

  const tournamentId = tournamentRow.id;
  if (tournamentRow.closedAt && session.user.role !== "admin") {
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
  if (!hasTournamentRole(session.user.role, membership, "td")) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const changedBy = session.user.id;

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

    // Update the global venue record with new values
    await db
      .update(venue)
      .set({
        name: body.name.trim(),
        description: body.description ?? null,
        facilities: body.facilities ?? null,
        lat: body.lat,
        long: body.long,
        changedBy,
        changedAt: Date.now(),
      })
      .where(eq(venue.id, venueId));
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

  const [linkRow] = linkRows;

  if (linkRow) {
    await db
      .update(tournamentVenue)
      .set(linkValues)
      .where(eq(tournamentVenue.id, linkRow.id));
  }
  else {
    await db.insert(tournamentVenue).values({
      tournamentId,
      venueId,
      ...linkValues,
    });
  }

  if (body.courseLayouts !== undefined) {
    const now = Date.now();
    const layoutStatements: BatchItem<"sqlite">[] = [
      db.delete(venueCourseLayout).where(eq(venueCourseLayout.venueId, venueId)),
    ];

    body.courseLayouts.forEach((layout, index) => {
      layoutStatements.push(
        db.insert(venueCourseLayout).values({
          id: layout.id?.trim() || crypto.randomUUID(),
          venueId: venueId!,
          name: layout.name.trim(),
          par: layout.par,
          holeCount: layout.holeCount ?? null,
          sortOrder: index,
          createdAt: now,
          updatedAt: now,
        }),
      );
    });

    const [firstStmt, ...restStmts] = layoutStatements;
    if (firstStmt) {
      await db.batch([firstStmt, ...restStmts]);
    }
  }

  const [venueRows, savedLayouts] = await Promise.all([
    db
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
      .limit(1),
    db
      .select({
        id: venueCourseLayout.id,
        name: venueCourseLayout.name,
        par: venueCourseLayout.par,
        holeCount: venueCourseLayout.holeCount,
      })
      .from(venueCourseLayout)
      .where(eq(venueCourseLayout.venueId, venueId))
      .orderBy(asc(venueCourseLayout.sortOrder), asc(venueCourseLayout.name)),
  ]);

  const [resolvedVenue] = venueRows;

  if (!resolvedVenue) {
    throw createError({ statusCode: 404, message: "Venue not found" });
  }

  return {
    success: true,
    venue: {
      id: resolvedVenue.id,
      name: resolvedVenue.name,
      description: resolvedVenue.description,
      facilities: resolvedVenue.facilities,
      lat: resolvedVenue.lat,
      long: resolvedVenue.long,
      hasGolf: !!body.hasGolf,
      hasAccuracy: !!body.hasAccuracy,
      hasDistance: !!body.hasDistance,
      hasSCF: !!body.hasSCF,
      hasDiscathon: !!body.hasDiscathon,
      hasDDC: !!body.hasDDC,
      hasFreestyle: !!body.hasFreestyle,
      courseLayouts: savedLayouts,
    },
  };
});
