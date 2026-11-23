import type { BatchItem } from "drizzle-orm/batch";

import { and, eq } from "drizzle-orm";

import { tournamentPlayerRegistrationPatchSchema } from "#shared/schemas/divisions";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { eventEntry, player } from "../../../../../lib/db/schema";
import { hasTournamentRole } from "../../../../utils/authorization";
import { deriveMinorDivisions } from "../../../../utils/division-derivation";
import { MAJOR_DIVISION_REASON_LABELS, validateMajorDivision } from "../../../../utils/division-eligibility";
import { getTournamentRegistrationStatus } from "../../../../utils/division-policy";
import {
  buildEntrySyncStatements,
  formatRegistrationClosedMessage,
  loadDivisionPolicyContext,
  loadRegistrationLocked,
  loadRegistrationTournament,
  loadTournamentMembership,
  resolveProfileText,
  resolveRequestedDisciplines,
  runBatch,
} from "../../../../utils/tournament-registration-context";

/**
 * Updates a player's registration in a tournament (route param `id` = player id):
 * Major Division, discipline selection, profile details and/or status (registered / withdrawn).
 * Players may edit their own registration while registration is open; Scorer/TD/Admin at any time.
 * All validation runs before any write; all writes are executed atomically in one batch.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  const playerId = getRouterParam(event, "id");

  if (!slug || !playerId) {
    throw createError({ statusCode: 400, message: "Tournament slug and player id are required" });
  }

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const bodyResult = tournamentPlayerRegistrationPatchSchema.safeParse(await readBody(event));
  if (!bodyResult.success) {
    throw createError({ statusCode: 400, message: bodyResult.error.issues[0]?.message || "Invalid request body" });
  }
  const body = bodyResult.data;

  const foundTournament = await loadRegistrationTournament(slug);

  const [membership, isLocked, playerRows, existingEntries] = await Promise.all([
    loadTournamentMembership(foundTournament.id, session.user.id),
    loadRegistrationLocked(foundTournament.id),
    db
      .select({
        id: player.id,
        userId: player.userId,
        displayName: player.displayName,
        country: player.country,
        email: player.email,
        pdgaNumber: player.pdgaNumber,
        homeClub: player.homeClub,
        dateOfBirth: player.dateOfBirth,
        genderCategory: player.genderCategory,
      })
      .from(player)
      .where(eq(player.id, playerId))
      .limit(1),
    db
      .select({
        id: eventEntry.id,
        discipline: eventEntry.discipline,
        majorDivision: eventEntry.majorDivision,
        status: eventEntry.status,
      })
      .from(eventEntry)
      .where(and(eq(eventEntry.playerId, playerId), eq(eventEntry.tournamentId, foundTournament.id))),
  ]);

  const targetPlayer = playerRows[0];
  if (!targetPlayer) {
    throw createError({ statusCode: 404, message: "Player not found" });
  }

  const isManager = hasTournamentRole(session.user.role, membership, "scorer");
  if (!isManager && targetPlayer.userId !== session.user.id) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const registrationState = getTournamentRegistrationStatus(foundTournament, isLocked);
  if (!isManager && !registrationState.isRegistrationOpen) {
    throw createError({
      statusCode: 423,
      message: `${formatRegistrationClosedMessage(registrationState.registrationStatusReason)} Contact a TD/admin for changes.`,
    });
  }

  if (existingEntries.length === 0 && !body.disciplines?.length) {
    throw createError({ statusCode: 404, message: "No registration entries found for this player in this tournament" });
  }

  const now = Date.now();
  const statements: BatchItem<"sqlite">[] = [];

  // Fast path: withdraw everything without touching division/profile
  if (body.status === "withdrawn" && !body.disciplines && !body.profile && !body.majorDivision) {
    statements.push(
      db.update(eventEntry)
        .set({ status: "withdrawn", changedBy: session.user.id, updatedAt: now })
        .where(and(eq(eventEntry.playerId, targetPlayer.id), eq(eventEntry.tournamentId, foundTournament.id))),
    );
    await runBatch(statements);
    return { success: true, playerId: targetPlayer.id, status: "withdrawn" };
  }

  // 1. Resolve effective profile in memory
  const profile = body.profile;
  const effective = profile
    ? {
        displayName: resolveProfileText(profile.displayName, targetPlayer.displayName) || targetPlayer.displayName,
        country: resolveProfileText(profile.country, targetPlayer.country),
        email: resolveProfileText(profile.email, targetPlayer.email),
        pdgaNumber: resolveProfileText(profile.pdgaNumber, targetPlayer.pdgaNumber),
        homeClub: resolveProfileText(profile.homeClub, targetPlayer.homeClub),
        dateOfBirth: resolveProfileText(profile.dateOfBirth, targetPlayer.dateOfBirth),
        genderCategory: profile.genderCategory !== undefined ? (profile.genderCategory || "open") : targetPlayer.genderCategory,
      }
    : targetPlayer;

  // 2. Validate
  const policyContext = await loadDivisionPolicyContext(foundTournament);
  const activeEntry = existingEntries.find(row => row.status === "registered") ?? existingEntries[0];
  const resolvedMajorDivision = body.majorDivision || activeEntry?.majorDivision || policyContext.majorDivisions[0]?.code || "OPEN";

  const majorValidation = validateMajorDivision({
    majorDivision: resolvedMajorDivision,
    offeredDivisionCodes: policyContext.offeredDivisionCodes,
    player: { dateOfBirth: effective.dateOfBirth, genderCategory: effective.genderCategory },
    eventTimestamp: foundTournament.startDate,
    policy: policyContext.config,
  });

  if (!majorValidation.eligible) {
    throw createError({
      statusCode: 400,
      message: `Player is not eligible for division ${resolvedMajorDivision} (${MAJOR_DIVISION_REASON_LABELS[majorValidation.reason]})`,
    });
  }

  const requestedDisciplines = body.disciplines?.length
    ? resolveRequestedDisciplines(foundTournament, body.disciplines)
    : null;

  const derived = deriveMinorDivisions(
    { dateOfBirth: effective.dateOfBirth, genderCategory: effective.genderCategory },
    foundTournament.startDate,
    policyContext.config,
  );

  // 3. Build all writes
  if (profile) {
    statements.push(
      db.update(player)
        .set({
          displayName: effective.displayName,
          country: effective.country,
          email: effective.email,
          pdgaNumber: effective.pdgaNumber,
          homeClub: effective.homeClub,
          dateOfBirth: effective.dateOfBirth,
          genderCategory: effective.genderCategory,
          updatedAt: now,
        })
        .where(eq(player.id, targetPlayer.id)),
    );
  }

  if (requestedDisciplines) {
    const sync = buildEntrySyncStatements({
      playerId: targetPlayer.id,
      tournamentId: foundTournament.id,
      disciplines: requestedDisciplines,
      existingEntries,
      majorDivision: resolvedMajorDivision,
      minorDivisionTags: derived.minorDivisionTags,
      primaryMinorDivision: derived.primaryMinorDivision,
      status: body.status ?? "registered",
      changedBy: session.user.id,
      now,
      withdrawUnlisted: true,
    });
    statements.push(...sync.statements);
  }
  else {
    statements.push(
      db.update(eventEntry)
        .set({
          majorDivision: resolvedMajorDivision,
          minorDivisionTags: JSON.stringify(derived.minorDivisionTags),
          primaryMinorDivision: derived.primaryMinorDivision,
          activeCompetitiveDivision: resolvedMajorDivision,
          status: body.status ?? undefined,
          changedBy: session.user.id,
          updatedAt: now,
        })
        .where(and(eq(eventEntry.playerId, targetPlayer.id), eq(eventEntry.tournamentId, foundTournament.id))),
    );
  }

  await runBatch(statements);

  return {
    success: true,
    playerId: targetPlayer.id,
    majorDivision: resolvedMajorDivision,
    minorDivisionTags: derived.minorDivisionTags,
    primaryMinorDivision: derived.primaryMinorDivision,
  };
});
