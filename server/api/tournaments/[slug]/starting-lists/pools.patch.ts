import { and, eq } from "drizzle-orm";

import { startingListPoolsPatchBodySchema } from "#shared/schemas/starting-lists";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { startingListEntry, startingListLock, tournament, tournamentMembership } from "../../../../../lib/db/schema";
import { hasTournamentRole } from "../../../../utils/authorization";
import { getPoolLabels } from "../../../../utils/starting-list";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, message: "Tournament slug is required" });
  }

  const bodyResult = startingListPoolsPatchBodySchema.safeParse(await readBody(event));
  if (!bodyResult.success) {
    throw createError({ statusCode: 400, message: bodyResult.error.issues[0]?.message || "Invalid request body" });
  }

  const body = bodyResult.data;

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const tournamentRows = await db
    .select({
      id: tournament.id,
      golfPoolCount: tournament.golfPoolCount,
    })
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

  if (!hasTournamentRole(session.user.role, membershipRows[0], "scorer")) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const [lockRows, existingRows] = await Promise.all([
    db
      .select({ isLocked: startingListLock.isLocked })
      .from(startingListLock)
      .where(
        and(
          eq(startingListLock.tournamentId, foundTournament.id),
          eq(startingListLock.discipline, body.discipline),
          eq(startingListLock.roundNumber, body.roundNumber),
        ),
      )
      .limit(1),
    db
      .select({ id: startingListEntry.id, eventEntryId: startingListEntry.eventEntryId })
      .from(startingListEntry)
      .where(
        and(
          eq(startingListEntry.tournamentId, foundTournament.id),
          eq(startingListEntry.discipline, body.discipline),
          eq(startingListEntry.roundNumber, body.roundNumber),
        ),
      ),
  ]);

  if (lockRows[0]?.isLocked) {
    throw createError({
      statusCode: 423,
      message: "Starting list is locked for this round",
    });
  }

  if (existingRows.length === 0) {
    throw createError({ statusCode: 404, message: "No starting list exists for this round" });
  }

  const allowedPools = new Set(getPoolLabels(foundTournament.golfPoolCount ?? 1));
  const rowByEventEntryId = new Map(existingRows.map(row => [row.eventEntryId, row]));

  for (const item of body.assignments) {
    if (!rowByEventEntryId.has(item.eventEntryId)) {
      throw createError({ statusCode: 400, message: `Unknown starting list entry: ${item.eventEntryId}` });
    }
    if (body.discipline === "golf" && item.poolName != null && !allowedPools.has(item.poolName)) {
      throw createError({ statusCode: 400, message: `Invalid pool name: ${item.poolName}` });
    }
  }

  const now = Date.now();
  const statements = body.assignments.map((item) => {
    const row = rowByEventEntryId.get(item.eventEntryId)!;
    return db
      .update(startingListEntry)
      .set({
        poolName: item.poolName,
        updatedAt: now,
      })
      .where(eq(startingListEntry.id, row.id));
  });

  if (statements.length === 1) {
    await statements[0];
  }
  else {
    await db.batch(statements as [typeof statements[0], ...typeof statements]);
  }

  return {
    success: true,
    updated: statements.length,
  };
});
