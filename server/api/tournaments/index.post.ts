import { and, eq } from "drizzle-orm";

import { createTournamentSchema } from "#shared/schemas/tournament-create";

import { auth } from "../../../lib/auth";
import db from "../../../lib/db";
import { member, organization, tournament, tournamentMembership, user } from "../../../lib/db/schema";
import { geocodeCityCountry } from "../../utils/geo";
import { buildUniqueTournamentSlug } from "../../utils/tournament-slug";

function slugifyOrganization(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "org";
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

/**
 * Self-service tournament creation endpoint.
 * Any signed-in, non-banned user can create a tournament and immediately becomes its `owner`.
 * If the user does not belong to an organization yet, a personal/club organization is created automatically.
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Authentication required" });
  }

  const bodyResult = createTournamentSchema.safeParse(await readBody(event));
  if (!bodyResult.success) {
    throw createError({
      statusCode: 400,
      message: bodyResult.error.issues[0]?.message || "Invalid tournament details",
    });
  }
  const body = bodyResult.data;

  if (body.startDate && body.endDate && body.endDate < body.startDate) {
    throw createError({ statusCode: 400, message: "End date cannot be before start date" });
  }
  if (body.registrationOpenDate && body.registrationCloseDate && body.registrationCloseDate < body.registrationOpenDate) {
    throw createError({ statusCode: 400, message: "Registration close date cannot be before open date" });
  }

  const [userRows, existingByName] = await Promise.all([
    db
      .select({ id: user.id, name: user.name, email: user.email, role: user.role, banned: user.banned })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1),
    db
      .select({ id: tournament.id })
      .from(tournament)
      .where(eq(tournament.name, body.name))
      .limit(1),
  ]);

  const currentUser = userRows[0];
  if (!currentUser) {
    throw createError({ statusCode: 404, message: "User not found" });
  }
  if (currentUser.banned) {
    throw createError({ statusCode: 403, message: "Banned accounts cannot create tournaments" });
  }
  if (existingByName[0]) {
    throw createError({ statusCode: 409, message: "A tournament with this name already exists" });
  }

  const now = Date.now();
  let resolvedOrgId = body.organizationId?.trim() || null;

  if (resolvedOrgId) {
    const isGlobalAdmin = currentUser.role === "admin";
    if (!isGlobalAdmin) {
      const membership = await db
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.organizationId, resolvedOrgId), eq(member.userId, currentUser.id)))
        .limit(1);
      if (!membership[0]) {
        throw createError({ statusCode: 403, message: "You are not a member of the selected organization" });
      }
    }
  }
  else {
    const existingMember = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, currentUser.id))
      .limit(1);

    if (existingMember[0] && !body.organizationName) {
      resolvedOrgId = existingMember[0].organizationId;
    }
    else {
      const orgId = crypto.randomUUID();
      const orgName = body.organizationName?.trim() || `${currentUser.name || "Tournament"}'s Organization`;
      await db.batch([
        db.insert(organization).values({
          id: orgId,
          name: orgName,
          slug: slugifyOrganization(orgName),
          createdAt: now,
          updatedAt: now,
        }),
        db.insert(member).values({
          id: crypto.randomUUID(),
          organizationId: orgId,
          userId: currentUser.id,
          role: "owner",
          createdAt: now,
          updatedAt: now,
        }),
      ]);
      resolvedOrgId = orgId;
    }
  }

  const hasExplicitCoords = typeof body.lat === "number" && typeof body.long === "number" && (body.lat !== 0 || body.long !== 0);
  const [slug, geocoded] = await Promise.all([
    buildUniqueTournamentSlug(body.name),
    !hasExplicitCoords && (body.city?.trim() || body.country?.trim())
      ? geocodeCityCountry(body.city, body.country)
      : Promise.resolve(null),
  ]);

  const resolvedLat = hasExplicitCoords ? body.lat! : (geocoded?.lat ?? 0);
  const resolvedLong = hasExplicitCoords ? body.long! : (geocoded?.long ?? 0);

  const inserted = await db
    .insert(tournament)
    .values({
      organizationId: resolvedOrgId,
      name: body.name,
      slug,
      description: body.description?.trim() || null,
      country: body.country?.trim() || null,
      city: body.city?.trim() || null,
      lat: resolvedLat,
      long: resolvedLong,
      directorName: currentUser.name || null,
      directorEmail: currentUser.email || null,
      contactUserId: currentUser.id,
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
      registrationOpenDate: body.registrationOpenDate ?? null,
      registrationCloseDate: body.registrationCloseDate ?? null,
      divisionOpen: body.divisionOpen,
      divisionWomen: body.divisionWomen,
      divisionMaster: body.divisionMaster,
      divisionGrandMaster: body.divisionGrandMaster,
      divisionSeniorGrandMaster: body.divisionSeniorGrandMaster,
      divisionLegend: body.divisionLegend,
      divisionJunior: body.divisionJunior,
      hasGolf: body.hasGolf,
      hasAccuracy: body.hasAccuracy,
      hasDistance: body.hasDistance,
      hasSCF: body.hasSCF,
      hasDiscathon: body.hasDiscathon,
      hasDDC: body.hasDDC,
      hasFreestyle: body.hasFreestyle,
      changedBy: currentUser.id,
      createdAt: now,
      changedAt: now,
    })
    .returning({ id: tournament.id, slug: tournament.slug, name: tournament.name });

  const created = inserted[0];
  if (!created) {
    throw createError({ statusCode: 500, message: "Failed to create tournament" });
  }

  await db.insert(tournamentMembership).values({
    id: crypto.randomUUID(),
    userId: currentUser.id,
    tournamentId: created.id,
    organizationId: resolvedOrgId,
    role: "owner",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  return {
    success: true,
    tournament: created,
  };
});
