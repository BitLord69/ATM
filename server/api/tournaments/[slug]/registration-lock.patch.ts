import { and, eq } from "drizzle-orm";

import { registrationLockPatchSchema } from "#shared/schemas/registration-lock";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { tournament, tournamentMembership, tournamentRegistrationLock } from "../../../../lib/db/schema";

function canManageRegistrationLock(globalRole: string | undefined, membership: { role: string; status: string } | undefined) {
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

  const bodyResult = registrationLockPatchSchema.safeParse(await readBody(event));
  if (!bodyResult.success) {
    throw createError({ statusCode: 400, message: bodyResult.error.issues[0]?.message || "Invalid request body" });
  }

  const body = bodyResult.data;

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

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

  if (!canManageRegistrationLock(session.user.role, membershipRows[0])) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const now = Date.now();

  await db
    .insert(tournamentRegistrationLock)
    .values({
      id: crypto.randomUUID(),
      tournamentId: foundTournament.id,
      isLocked: body.locked,
      lockedBy: body.locked ? session.user.id : null,
      lockedAt: body.locked ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [tournamentRegistrationLock.tournamentId],
      set: {
        isLocked: body.locked,
        lockedBy: body.locked ? session.user.id : null,
        lockedAt: body.locked ? now : null,
        updatedAt: now,
      },
    });

  return {
    success: true,
    tournamentId: foundTournament.id,
    lock: {
      isLocked: body.locked,
      lockedBy: body.locked ? session.user.id : null,
      lockedAt: body.locked ? now : null,
    },
  };
});
