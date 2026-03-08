import { and, asc, eq } from "drizzle-orm";

import { startingListGenerateBodySchema } from "#shared/schemas/starting-lists";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { eventEntry, startingListEntry, startingListLock, tournament, tournamentMembership } from "../../../../../lib/db/schema";
import { buildStartingListEntries } from "../../../../utils/starting-list";

function canManageStartingLists(globalRole: string | undefined, membership: { role: string; status: string } | undefined) {
  if (globalRole === "admin") {
    return true;
  }

  if (!membership || membership.status !== "active") {
    return false;
  }

  return ["owner", "admin", "td", "scorer"].includes(membership.role);
}

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

  const lockRows = await db
    .select({ isLocked: startingListLock.isLocked })
    .from(startingListLock)
    .where(
      and(
        eq(startingListLock.tournamentId, foundTournament.id),
        eq(startingListLock.discipline, body.discipline),
        eq(startingListLock.roundNumber, body.roundNumber),
      ),
    )
    .limit(1);

  if (lockRows[0]?.isLocked) {
    throw createError({
      statusCode: 423,
      message: "Starting list is locked for this round",
    });
  }

  const existingRows = await db
    .select({ id: startingListEntry.id })
    .from(startingListEntry)
    .where(
      and(
        eq(startingListEntry.tournamentId, foundTournament.id),
        eq(startingListEntry.discipline, body.discipline),
        eq(startingListEntry.roundNumber, body.roundNumber),
      ),
    )
    .orderBy(asc(startingListEntry.position));

  if (existingRows.length > 0 && !body.overwrite) {
    throw createError({ statusCode: 409, message: "Starting list already exists for this round. Set overwrite=true to regenerate." });
  }

  if (existingRows.length > 0 && body.overwrite) {
    await db
      .delete(startingListEntry)
      .where(
        and(
          eq(startingListEntry.tournamentId, foundTournament.id),
          eq(startingListEntry.discipline, body.discipline),
          eq(startingListEntry.roundNumber, body.roundNumber),
        ),
      );
  }

  const sourceEntries = await db
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
    .orderBy(asc(eventEntry.createdAt), asc(eventEntry.id));

  const activeSourceEntries = sourceEntries.filter(row => row.status !== "withdrawn");

  if (activeSourceEntries.length === 0) {
    return {
      success: true,
      generated: 0,
      discipline: body.discipline,
      roundNumber: body.roundNumber,
      entries: [],
    };
  }

  const generatedRows = buildStartingListEntries(
    activeSourceEntries.map(row => ({
      eventEntryId: row.id,
      tournamentId: row.tournamentId,
      discipline: row.discipline,
      activeCompetitiveDivision: row.activeCompetitiveDivision,
      sortValue: row.createdAt,
    })),
    body.roundNumber,
  );

  const now = Date.now();

  await db.insert(startingListEntry).values(
    generatedRows.map(row => ({
      id: crypto.randomUUID(),
      eventEntryId: row.eventEntryId,
      tournamentId: row.tournamentId,
      discipline: row.discipline,
      roundNumber: row.roundNumber,
      position: row.position,
      activeCompetitiveDivisionSnapshot: row.activeCompetitiveDivisionSnapshot,
      createdAt: now,
      updatedAt: now,
    })),
  );

  return {
    success: true,
    generated: generatedRows.length,
    discipline: body.discipline,
    roundNumber: body.roundNumber,
    entries: generatedRows,
  };
});
