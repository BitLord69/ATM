import { and, eq } from "drizzle-orm";

import { cloneTournamentBodySchema, slugParamSchema } from "#shared/schemas/tournament-edit";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { tournament, tournamentMembership, tournamentVenue } from "../../../../lib/db/schema";
import { buildUniqueTournamentSlug } from "../../../utils/tournament-slug";

function canCloneTournament(globalRole: string | undefined, membership: { role: string; status: string } | undefined) {
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

  const bodyResult = cloneTournamentBodySchema.safeParse(await readBody(event));
  if (!bodyResult.success) {
    throw createError({
      statusCode: 400,
      message: bodyResult.error.issues[0]?.message || "Invalid request body",
    });
  }

  const sourceRows = await db
    .select({
      id: tournament.id,
      organizationId: tournament.organizationId,
      description: tournament.description,
      country: tournament.country,
      city: tournament.city,
      contactName: tournament.contactName,
      contactEmail: tournament.contactEmail,
      contactPhone: tournament.contactPhone,
      directorName: tournament.directorName,
      directorEmail: tournament.directorEmail,
      directorPhone: tournament.directorPhone,
      contactUserId: tournament.contactUserId,
      lat: tournament.lat,
      long: tournament.long,
      hasGolf: tournament.hasGolf,
      hasAccuracy: tournament.hasAccuracy,
      hasDistance: tournament.hasDistance,
      hasSCF: tournament.hasSCF,
      hasDiscathon: tournament.hasDiscathon,
      hasDDC: tournament.hasDDC,
      hasFreestyle: tournament.hasFreestyle,
    })
    .from(tournament)
    .where(eq(tournament.slug, slugResult.data.slug))
    .limit(1);

  const source = sourceRows[0];
  if (!source) {
    throw createError({ statusCode: 404, message: "Tournament not found" });
  }

  const membershipRows = await db
    .select({
      role: tournamentMembership.role,
      status: tournamentMembership.status,
      organizationId: tournamentMembership.organizationId,
    })
    .from(tournamentMembership)
    .where(
      and(
        eq(tournamentMembership.tournamentId, source.id),
        eq(tournamentMembership.userId, session.user.id),
      ),
    )
    .limit(1);

  const membership = membershipRows[0];
  if (!canCloneTournament(session.user.role, membership)) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const body = bodyResult.data;
  const now = Date.now();
  const changedBy = session.user.id as any;
  const cloneSlug = await buildUniqueTournamentSlug(body.name);
  const organizationId = source.organizationId ?? membership?.organizationId ?? null;

  const inserted = await db.transaction(async (tx) => {
    const created = await tx
      .insert(tournament)
      .values({
        organizationId,
        name: body.name.trim(),
        slug: cloneSlug,
        description: source.description ?? null,
        country: source.country ?? null,
        city: source.city ?? null,
        contactName: source.contactName ?? null,
        contactEmail: source.contactEmail ?? null,
        contactPhone: source.contactPhone ?? null,
        directorName: source.directorName ?? null,
        directorEmail: source.directorEmail ?? null,
        directorPhone: source.directorPhone ?? null,
        contactUserId: source.contactUserId ?? null,
        lat: source.lat,
        long: source.long,
        startDate: body.startDate,
        endDate: body.endDate,
        closedAt: null,
        hasGolf: !!source.hasGolf,
        hasAccuracy: !!source.hasAccuracy,
        hasDistance: !!source.hasDistance,
        hasSCF: !!source.hasSCF,
        hasDiscathon: !!source.hasDiscathon,
        hasDDC: !!source.hasDDC,
        hasFreestyle: !!source.hasFreestyle,
        changedBy,
        createdAt: now,
        changedAt: now,
      })
      .returning({ id: tournament.id, slug: tournament.slug });

    const clone = created[0];
    if (!clone) {
      throw createError({ statusCode: 500, message: "Failed to clone tournament" });
    }

    if (organizationId) {
      await tx.insert(tournamentMembership).values({
        id: crypto.randomUUID(),
        tournamentId: clone.id,
        userId: session.user.id,
        organizationId,
        role: membership?.role || "owner",
        status: "active",
      });
    }

    if (body.includeVenues) {
      const sourceVenueLinks = await tx
        .select({
          venueId: tournamentVenue.venueId,
          hasGolf: tournamentVenue.hasGolf,
          hasAccuracy: tournamentVenue.hasAccuracy,
          hasDistance: tournamentVenue.hasDistance,
          hasSCF: tournamentVenue.hasSCF,
          hasDiscathon: tournamentVenue.hasDiscathon,
          hasDDC: tournamentVenue.hasDDC,
          hasFreestyle: tournamentVenue.hasFreestyle,
        })
        .from(tournamentVenue)
        .where(eq(tournamentVenue.tournamentId, source.id));

      if (sourceVenueLinks.length > 0) {
        await tx.insert(tournamentVenue).values(
          sourceVenueLinks.map(link => ({
            tournamentId: clone.id,
            venueId: link.venueId,
            hasGolf: !!link.hasGolf,
            hasAccuracy: !!link.hasAccuracy,
            hasDistance: !!link.hasDistance,
            hasSCF: !!link.hasSCF,
            hasDiscathon: !!link.hasDiscathon,
            hasDDC: !!link.hasDDC,
            hasFreestyle: !!link.hasFreestyle,
            changedBy,
            createdAt: now,
            changedAt: now,
          })),
        );
      }
    }

    return clone;
  });

  return {
    success: true,
    slug: inserted.slug,
    id: inserted.id,
  };
});
