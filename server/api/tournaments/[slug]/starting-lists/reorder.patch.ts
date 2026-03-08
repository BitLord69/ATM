import { and, eq, sql } from "drizzle-orm";

import { startingListReorderBodySchema } from "#shared/schemas/starting-lists";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { startingListEntry, startingListLock, tournament, tournamentMembership } from "../../../../../lib/db/schema";
import { resequencePositions } from "../../../../utils/starting-list";

function canManageStartingLists(globalRole: string | undefined, membership: { role: string; status: string } | undefined) {
  if (globalRole === "admin") {
    return true;
  }

  if (!membership || membership.status !== "active") {
    return false;
  }

  return ["owner", "admin", "td", "scorer"].includes(membership.role);
}

function hasUniqueValues(values: string[]) {
  return new Set(values).size === values.length;
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, message: "Tournament slug is required" });
  }

  const bodyResult = startingListReorderBodySchema.safeParse(await readBody(event));
  if (!bodyResult.success) {
    throw createError({ statusCode: 400, message: bodyResult.error.issues[0]?.message || "Invalid request body" });
  }

  const body = bodyResult.data;
  if (!hasUniqueValues(body.orderedEventEntryIds)) {
    throw createError({ statusCode: 400, message: "orderedEventEntryIds must not contain duplicates" });
  }

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
    .select({ id: startingListEntry.id, eventEntryId: startingListEntry.eventEntryId })
    .from(startingListEntry)
    .where(
      and(
        eq(startingListEntry.tournamentId, foundTournament.id),
        eq(startingListEntry.discipline, body.discipline),
        eq(startingListEntry.roundNumber, body.roundNumber),
      ),
    );

  if (existingRows.length === 0) {
    throw createError({ statusCode: 404, message: "No starting list exists for this round" });
  }

  if (existingRows.length !== body.orderedEventEntryIds.length) {
    throw createError({ statusCode: 400, message: "orderedEventEntryIds must include all current starting list entries" });
  }

  const existingSet = new Set(existingRows.map(row => row.eventEntryId));
  const incomingSet = new Set(body.orderedEventEntryIds);

  if (existingSet.size !== incomingSet.size) {
    throw createError({ statusCode: 400, message: "orderedEventEntryIds contains duplicates or invalid values" });
  }

  for (const eventEntryId of body.orderedEventEntryIds) {
    if (!existingSet.has(eventEntryId)) {
      throw createError({ statusCode: 400, message: `Unknown eventEntryId in ordering: ${eventEntryId}` });
    }
  }

  const eventEntryIdToRow = new Map(existingRows.map(row => [row.eventEntryId, row]));
  const resequenced = resequencePositions(body.orderedEventEntryIds);

  const bumpOffset = 10000;
  await db
    .update(startingListEntry)
    .set({
      position: sql`${startingListEntry.position} + ${bumpOffset}`,
      updatedAt: Date.now(),
    })
    .where(
      and(
        eq(startingListEntry.tournamentId, foundTournament.id),
        eq(startingListEntry.discipline, body.discipline),
        eq(startingListEntry.roundNumber, body.roundNumber),
      ),
    );

  const now = Date.now();
  for (const item of resequenced) {
    const row = eventEntryIdToRow.get(item.eventEntryId);
    if (!row) {
      continue;
    }

    await db
      .update(startingListEntry)
      .set({ position: item.position, updatedAt: now })
      .where(eq(startingListEntry.id, row.id));
  }

  return {
    success: true,
    discipline: body.discipline,
    roundNumber: body.roundNumber,
    entries: resequenced,
  };
});
