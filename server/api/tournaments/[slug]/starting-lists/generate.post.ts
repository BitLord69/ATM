import { and, asc, eq, lt } from "drizzle-orm";

import { startingListGenerateBodySchema } from "#shared/schemas/starting-lists";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { eventEntry, eventRoundScore, startingListEntry, startingListLock, tournament, tournamentMembership } from "../../../../../lib/db/schema";
import { hasTournamentRole } from "../../../../utils/authorization";
import { buildGolfStartingListEntries, buildStartingListEntries } from "../../../../utils/starting-list";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, message: "Tournament slug is required" });
  }

  const bodyResult = startingListGenerateBodySchema.safeParse(await readBody(event));
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
      golfPoolMode: tournament.golfPoolMode,
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

  const [lockRows, existingRows, sourceEntries, previousRoundEntries, priorScoreRows] = await Promise.all([
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
      .select({ id: startingListEntry.id })
      .from(startingListEntry)
      .where(
        and(
          eq(startingListEntry.tournamentId, foundTournament.id),
          eq(startingListEntry.discipline, body.discipline),
          eq(startingListEntry.roundNumber, body.roundNumber),
        ),
      )
      .orderBy(asc(startingListEntry.position)),
    db
      .select({
        id: eventEntry.id,
        tournamentId: eventEntry.tournamentId,
        discipline: eventEntry.discipline,
        activeCompetitiveDivision: eventEntry.activeCompetitiveDivision,
        createdAt: eventEntry.createdAt,
        status: eventEntry.status,
      })
      .from(eventEntry)
      .where(
        and(
          eq(eventEntry.tournamentId, foundTournament.id),
          eq(eventEntry.discipline, body.discipline),
        ),
      )
      .orderBy(asc(eventEntry.createdAt), asc(eventEntry.id)),
    body.discipline === "golf" && body.roundNumber > 1
      ? db
          .select({
            eventEntryId: startingListEntry.eventEntryId,
            poolName: startingListEntry.poolName,
            position: startingListEntry.position,
          })
          .from(startingListEntry)
          .where(
            and(
              eq(startingListEntry.tournamentId, foundTournament.id),
              eq(startingListEntry.discipline, body.discipline),
              eq(startingListEntry.roundNumber, body.roundNumber - 1),
            ),
          )
          .orderBy(asc(startingListEntry.position))
      : Promise.resolve([]),
    body.discipline === "golf" && body.roundNumber > 1 && foundTournament.golfPoolMode === "dynamic"
      ? db
          .select({
            eventEntryId: eventRoundScore.eventEntryId,
            rawScore: eventRoundScore.rawScore,
            status: eventRoundScore.status,
          })
          .from(eventRoundScore)
          .where(
            and(
              eq(eventRoundScore.tournamentId, foundTournament.id),
              eq(eventRoundScore.discipline, "golf"),
              lt(eventRoundScore.roundNumber, body.roundNumber),
            ),
          )
      : Promise.resolve([]),
  ]);

  if (lockRows[0]?.isLocked) {
    throw createError({
      statusCode: 423,
      message: "Starting list is locked for this round",
    });
  }

  if (existingRows.length > 0 && !body.overwrite) {
    throw createError({ statusCode: 409, message: "Starting list already exists for this round. Set overwrite=true to regenerate." });
  }

  const activeSourceEntries = sourceEntries.filter(row => row.status !== "withdrawn");

  const mappedInputs = activeSourceEntries.map(row => ({
    eventEntryId: row.id,
    tournamentId: row.tournamentId,
    discipline: row.discipline,
    activeCompetitiveDivision: row.activeCompetitiveDivision,
    sortValue: row.createdAt,
  }));

  // For dynamic R2+ golf pools, if prior round scores exist, rank by cumulative strokes (LOWER_IS_BETTER)
  let effectivePreviousEntries = previousRoundEntries;
  if (body.discipline === "golf" && body.roundNumber > 1 && foundTournament.golfPoolMode === "dynamic" && priorScoreRows.length > 0) {
    const totals = new Map<string, { completed: number; strokes: number }>();
    for (const s of priorScoreRows) {
      if (s.status === "ok" && typeof s.rawScore === "number") {
        const cur = totals.get(s.eventEntryId) ?? { completed: 0, strokes: 0 };
        cur.completed += 1;
        cur.strokes += s.rawScore;
        totals.set(s.eventEntryId, cur);
      }
    }

    const prevPoolByEntry = new Map(previousRoundEntries.map(e => [e.eventEntryId, e.poolName]));
    const rankedByScore = [...activeSourceEntries].sort((left, right) => {
      const a = totals.get(left.id);
      const b = totals.get(right.id);
      if (a && !b)
        return -1;
      if (!a && b)
        return 1;
      if (a && b) {
        if (a.completed !== b.completed)
          return b.completed - a.completed;
        if (a.strokes !== b.strokes)
          return a.strokes - b.strokes;
      }
      return left.createdAt - right.createdAt;
    });

    effectivePreviousEntries = rankedByScore.map((row, idx) => ({
      eventEntryId: row.id,
      poolName: prevPoolByEntry.get(row.id) ?? null,
      position: idx + 1,
    }));
  }

  const generatedRows = body.discipline === "golf"
    ? buildGolfStartingListEntries(mappedInputs, {
        roundNumber: body.roundNumber,
        poolCount: typeof foundTournament.golfPoolCount === "number" && foundTournament.golfPoolCount >= 1
          ? foundTournament.golfPoolCount
          : 1,
        poolMode: foundTournament.golfPoolMode === "dynamic" ? "dynamic" : "static",
        assignmentMode: body.assignmentMode,
        cutSize: body.cutSize ?? null,
        previousRoundEntries: effectivePreviousEntries,
      })
    : buildStartingListEntries(mappedInputs, body.roundNumber);

  const now = Date.now();
  const deleteStatement = db
    .delete(startingListEntry)
    .where(
      and(
        eq(startingListEntry.tournamentId, foundTournament.id),
        eq(startingListEntry.discipline, body.discipline),
        eq(startingListEntry.roundNumber, body.roundNumber),
      ),
    );

  if (generatedRows.length === 0) {
    if (existingRows.length > 0 && body.overwrite) {
      await deleteStatement;
    }

    return {
      success: true,
      generated: 0,
      discipline: body.discipline,
      roundNumber: body.roundNumber,
      entries: [],
    };
  }

  const insertStatement = db.insert(startingListEntry).values(
    generatedRows.map(row => ({
      id: crypto.randomUUID(),
      eventEntryId: row.eventEntryId,
      tournamentId: row.tournamentId,
      discipline: row.discipline,
      roundNumber: row.roundNumber,
      position: row.position,
      poolName: row.poolName,
      activeCompetitiveDivisionSnapshot: row.activeCompetitiveDivisionSnapshot,
      createdAt: now,
      updatedAt: now,
    })),
  );

  if (existingRows.length > 0 && body.overwrite) {
    await db.batch([deleteStatement, insertStatement]);
  }
  else {
    await insertStatement;
  }

  return {
    success: true,
    generated: generatedRows.length,
    discipline: body.discipline,
    roundNumber: body.roundNumber,
    entries: generatedRows,
  };
});
