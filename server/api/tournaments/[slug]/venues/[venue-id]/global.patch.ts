import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "../../../../../../lib/auth";
import db from "../../../../../../lib/db";
import { tournament, tournamentMembership, tournamentVenue, venue } from "../../../../../../lib/db/schema";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Venue name is required"),
  description: z.string().nullable().optional(),
  facilities: z.string().nullable().optional(),
  lat: z.number().gte(-90).lte(90),
  long: z.number().gte(-180).lte(180),
});

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
  const slug = getRouterParam(event, "slug");
  const venueId = Number(getRouterParam(event, "venue-id"));

  if (!slug || !Number.isFinite(venueId) || venueId <= 0) {
    throw createError({ statusCode: 400, message: "Invalid tournament slug or venue id" });
  }

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const bodyResult = bodySchema.safeParse(await readBody(event));
  if (!bodyResult.success) {
    throw createError({
      statusCode: 400,
      message: bodyResult.error.issues[0]?.message || "Invalid request body",
    });
  }

  const tournamentRows = await db
    .select({ id: tournament.id, closedAt: tournament.closedAt })
    .from(tournament)
    .where(eq(tournament.slug, slug))
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
  if (!canEditTournament(session.user.role, membership)) {
    throw createError({ statusCode: 403, message: "Forbidden" });
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
    throw createError({
      statusCode: 409,
      message: "Venue must be linked to this tournament before global edits can be saved here",
    });
  }

  const targetVenue = await db
    .select({ id: venue.id })
    .from(venue)
    .where(eq(venue.id, venueId))
    .limit(1);

  if (targetVenue.length === 0) {
    throw createError({ statusCode: 404, message: "Venue not found" });
  }

  const body = bodyResult.data;

  await db
    .update(venue)
    .set({
      name: body.name.trim(),
      description: body.description ?? null,
      facilities: body.facilities ?? null,
      lat: body.lat,
      long: body.long,
      changedBy: session.user.id as any,
      changedAt: Date.now(),
    })
    .where(eq(venue.id, venueId));

  return { success: true };
});
