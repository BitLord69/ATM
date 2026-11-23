import { and, eq } from "drizzle-orm";

import { golfScoresPutBodySchema } from "#shared/schemas/golf-scores";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { eventEntry, eventRoundScore, startingListEntry, startingListLock, tournament, tournamentMembership } from "../../../../../lib/db/schema";
import { hasTournamentRole } from "../../../../utils/authorization";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, message: "Tournament slug is required" });
  }

  const bodyResult = golfScoresPutBodySchema.safeParse(await readBody(event));
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

  if (!hasTournamentRole(session.user.role, membershipRows[0], "scorer")) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  // Enforce strict rule across all disciplines: round starting list must be generated and locked before entering round scores
  if (body.scores.length > 0) {
    const [startingListRows, lockRows] = await Promise.all([
      db
        .select({ id: startingListEntry.id })
        .from(startingListEntry)
        .where(
          and(
            eq(startingListEntry.tournamentId, foundTournament.id),
            eq(startingListEntry.discipline, "golf"),
            eq(startingListEntry.roundNumber, body.roundNumber),
          ),
        )
        .limit(1),
      db
        .select({ isLocked: startingListLock.isLocked })
        .from(startingListLock)
        .where(
          and(
            eq(startingListLock.tournamentId, foundTournament.id),
            eq(startingListLock.discipline, "golf"),
            eq(startingListLock.roundNumber, body.roundNumber),
          ),
        )
        .limit(1),
    ]);

    if (startingListRows.length === 0 || !lockRows[0]?.isLocked) {
      throw createError({
        statusCode: 423,
        message: `Round ${body.roundNumber} starting list must be generated and locked before entering scores.`,
      });
    }
  }

  const validEntries = await db
    .select({ id: eventEntry.id })
    .from(eventEntry)
    .where(
      and(
        eq(eventEntry.tournamentId, foundTournament.id),
        eq(eventEntry.discipline, "golf"),
      ),
    );
  const validEntryIds = new Set(validEntries.map(row => row.id));

  for (const item of body.scores) {
    if (!validEntryIds.has(item.eventEntryId)) {
      throw createError({ statusCode: 400, message: `Unknown golf entry: ${item.eventEntryId}` });
    }
  }
  for (const item of body.playoffs) {
    if (!validEntryIds.has(item.eventEntryId)) {
      throw createError({ statusCode: 400, message: `Unknown golf entry for playoff: ${item.eventEntryId}` });
    }
  }

  const now = Date.now();
  const statements: any[] = [];

  for (const item of body.scores) {
    const normalizedScore = item.status === "ok" ? item.strokes : null;

    if (item.status === "ok" && normalizedScore == null) {
      statements.push(
        db
          .delete(eventRoundScore)
          .where(
            and(
              eq(eventRoundScore.eventEntryId, item.eventEntryId),
              eq(eventRoundScore.roundNumber, body.roundNumber),
            ),
          ),
      );
      continue;
    }

    statements.push(
      db
        .insert(eventRoundScore)
        .values({
          id: crypto.randomUUID(),
          eventEntryId: item.eventEntryId,
          tournamentId: foundTournament.id,
          discipline: "golf",
          roundNumber: body.roundNumber,
          rawScore: normalizedScore,
          status: item.status,
          enteredBy: session.user.id,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [eventRoundScore.eventEntryId, eventRoundScore.roundNumber],
          set: {
            rawScore: normalizedScore,
            status: item.status,
            enteredBy: session.user.id,
            updatedAt: now,
          },
        }),
    );
  }

  for (const item of body.playoffs) {
    statements.push(
      db
        .update(eventEntry)
        .set({
          playoffRank: item.playoffRank,
          updatedAt: now,
          changedBy: session.user.id,
        })
        .where(eq(eventEntry.id, item.eventEntryId)),
    );
  }

  if (statements.length === 1) {
    await statements[0];
  }
  else if (statements.length > 1) {
    await db.batch(statements as [typeof statements[0], ...typeof statements]);
  }

  return {
    success: true,
    savedScores: body.scores.length,
    savedPlayoffs: body.playoffs.length,
  };
});
