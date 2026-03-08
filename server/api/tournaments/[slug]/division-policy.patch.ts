import { and, asc, eq, notInArray } from "drizzle-orm";

import { divisionPolicyPatchSchema } from "#shared/schemas/divisions";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { divisionPolicy, tournament, tournamentDivision, tournamentMembership } from "../../../../lib/db/schema";

function canManageTournament(globalRole: string | undefined, membership: { role: string; status: string } | undefined) {
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
  if (!slug) {
    throw createError({ statusCode: 400, message: "Tournament slug is required" });
  }

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const bodyResult = divisionPolicyPatchSchema.safeParse(await readBody(event));
  if (!bodyResult.success) {
    throw createError({ statusCode: 400, message: bodyResult.error.issues[0]?.message || "Invalid request body" });
  }

  const body = bodyResult.data;

  const tournamentRows = await db
    .select({ id: tournament.id })
    .from(tournament)
    .where(eq(tournament.slug, slug))
    .limit(1);

  const foundTournament = tournamentRows[0];
  if (!foundTournament) {
    throw createError({ statusCode: 404, message: "Tournament not found" });
  }

  const membershipRows = await db
    .select({ role: tournamentMembership.role, status: tournamentMembership.status })
    .from(tournamentMembership)
    .where(
      and(
        eq(tournamentMembership.tournamentId, foundTournament.id),
        eq(tournamentMembership.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!canManageTournament(session.user.role, membershipRows[0])) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const now = Date.now();

  const existingPolicyRows = await db
    .select({ id: divisionPolicy.id })
    .from(divisionPolicy)
    .where(eq(divisionPolicy.tournamentId, foundTournament.id))
    .limit(1);

  const existingPolicy = existingPolicyRows[0];
  if (existingPolicy) {
    await db
      .update(divisionPolicy)
      .set({
        ageReferenceMode: body.ageReferenceMode,
        startingListMode: body.startingListMode,
        showMinorOverlays: body.showMinorOverlays,
        updatedAt: now,
      })
      .where(eq(divisionPolicy.id, existingPolicy.id));
  }
  else {
    await db.insert(divisionPolicy).values({
      id: crypto.randomUUID(),
      tournamentId: foundTournament.id,
      ageReferenceMode: body.ageReferenceMode ?? "calendar_year",
      startingListMode: body.startingListMode ?? "major_only",
      showMinorOverlays: body.showMinorOverlays ?? true,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (body.divisions) {
    const normalized = body.divisions.map((item, index) => ({
      ...item,
      code: item.code.trim().toUpperCase(),
      label: item.label.trim(),
      isEnabled: item.isEnabled ?? true,
      sortOrder: item.sortOrder ?? ((index + 1) * 10),
    }));

    for (const item of normalized) {
      await db
        .insert(tournamentDivision)
        .values({
          id: crypto.randomUUID(),
          tournamentId: foundTournament.id,
          code: item.code,
          label: item.label,
          isEnabled: item.isEnabled,
          sortOrder: item.sortOrder,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [tournamentDivision.tournamentId, tournamentDivision.code],
          set: {
            label: item.label,
            isEnabled: item.isEnabled,
            sortOrder: item.sortOrder,
            updatedAt: now,
          },
        });
    }

    const divisionCodes = normalized.map(item => item.code);

    if (divisionCodes.length === 0) {
      await db.delete(tournamentDivision).where(eq(tournamentDivision.tournamentId, foundTournament.id));
    }
    else {
      await db
        .delete(tournamentDivision)
        .where(
          and(
            eq(tournamentDivision.tournamentId, foundTournament.id),
            notInArray(tournamentDivision.code, divisionCodes),
          ),
        );
    }
  }

  const policyRows = await db
    .select({
      id: divisionPolicy.id,
      ageReferenceMode: divisionPolicy.ageReferenceMode,
      startingListMode: divisionPolicy.startingListMode,
      showMinorOverlays: divisionPolicy.showMinorOverlays,
    })
    .from(divisionPolicy)
    .where(eq(divisionPolicy.tournamentId, foundTournament.id))
    .limit(1);

  const divisions = await db
    .select({
      id: tournamentDivision.id,
      code: tournamentDivision.code,
      label: tournamentDivision.label,
      isEnabled: tournamentDivision.isEnabled,
      sortOrder: tournamentDivision.sortOrder,
    })
    .from(tournamentDivision)
    .where(eq(tournamentDivision.tournamentId, foundTournament.id))
    .orderBy(asc(tournamentDivision.sortOrder), asc(tournamentDivision.code));

  return {
    success: true,
    policy: policyRows[0],
    divisions,
  };
});
