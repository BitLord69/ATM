import { and, eq } from "drizzle-orm";

import { startingListLockBodySchema, startingListQuerySchema } from "#shared/schemas/starting-lists";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { startingListLock, tournament, tournamentMembership } from "../../../../../lib/db/schema";

function canManageStartingLists(globalRole: string | undefined, membership: { role: string; status: string } | undefined) {
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

  const bodyResult = startingListLockBodySchema.safeParse(await readBody(event));
  if (!bodyResult.success) {
    throw createError({ statusCode: 400, message: bodyResult.error.issues[0]?.message || "Invalid request body" });
  }

  const body = bodyResult.data;

  const queryResult = startingListQuerySchema.safeParse(getQuery(event));
  if (!queryResult.success) {
    throw createError({ statusCode: 400, message: queryResult.error.issues[0]?.message || "Invalid query" });
  }

  const query = queryResult.data;

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

  if (!canManageStartingLists(session.user.role, membershipRows[0])) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const now = Date.now();

  await db
    .insert(startingListLock)
    .values({
      id: crypto.randomUUID(),
      tournamentId: foundTournament.id,
      discipline: query.discipline,
      roundNumber: query.roundNumber,
      isLocked: body.locked,
      lockedBy: body.locked ? session.user.id : null,
      lockedAt: body.locked ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [startingListLock.tournamentId, startingListLock.discipline, startingListLock.roundNumber],
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
    discipline: query.discipline,
    roundNumber: query.roundNumber,
    locked: body.locked,
    lockedBy: body.locked ? session.user.id : null,
    lockedAt: body.locked ? now : null,
  };
});
