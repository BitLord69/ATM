import type { BatchItem } from "drizzle-orm/batch";

import { and, eq } from "drizzle-orm";

import { tournamentEntryCreateSchema } from "#shared/schemas/divisions";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { eventEntry, player, user } from "../../../../lib/db/schema";
import { hasTournamentRole } from "../../../utils/authorization";
import { deriveMinorDivisions } from "../../../utils/division-derivation";
import { MAJOR_DIVISION_REASON_LABELS, validateMajorDivision } from "../../../utils/division-eligibility";
import { getTournamentRegistrationStatus } from "../../../utils/division-policy";
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
} from "../../../utils/tournament-registration-context";

type ResolvedPlayer = {
  id: string;
  userId: string | null;
  isNew: boolean;
  displayName: string | null;
  country: string | null;
  email: string | null;
  pdgaNumber: string | null;
  homeClub: string | null;
  dateOfBirth: string | null;
  genderCategory: string | null;
};

/**
 * Registers a player into one or more disciplines.
 * - Players register themselves while registration is open.
 * - Scorer/TD/Admin can register existing users (`userId`/`playerId`) or offline guests (`guestPlayer`) at any time.
 * All validation runs before any write; all writes are executed atomically in one batch.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, message: "Tournament slug is required" });
  }

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const bodyResult = tournamentEntryCreateSchema.safeParse(await readBody(event));
  if (!bodyResult.success) {
    throw createError({ statusCode: 400, message: bodyResult.error.issues[0]?.message || "Invalid request body" });
  }
  const body = bodyResult.data;

  const foundTournament = await loadRegistrationTournament(slug);

  const [membership, isLocked, policyContext] = await Promise.all([
    loadTournamentMembership(foundTournament.id, session.user.id),
    loadRegistrationLocked(foundTournament.id),
    loadDivisionPolicyContext(foundTournament),
  ]);

  const isManager = hasTournamentRole(session.user.role, membership, "scorer");
  const registrationState = getTournamentRegistrationStatus(foundTournament, isLocked);

  if (!isManager && !registrationState.isRegistrationOpen) {
    throw createError({
      statusCode: 423,
      message: formatRegistrationClosedMessage(registrationState.registrationStatusReason),
    });
  }

  if ((body.playerId || body.userId || body.guestPlayer) && !isManager) {
    throw createError({ statusCode: 403, message: "Only tournament managers can register other players or guests" });
  }

  // 1. Resolve target player in memory (no writes yet)
  let target: ResolvedPlayer;

  if (body.guestPlayer) {
    const guest = body.guestPlayer;
    target = {
      id: crypto.randomUUID(),
      userId: null,
      isNew: true,
      displayName: guest.displayName.trim(),
      country: guest.country?.trim() || null,
      email: guest.email?.trim() || null,
      pdgaNumber: guest.pdgaNumber?.trim() || null,
      homeClub: guest.homeClub?.trim() || null,
      dateOfBirth: guest.dateOfBirth?.trim() || null,
      genderCategory: guest.genderCategory || "open",
    };
  }
  else {
    const playerSelect = {
      id: player.id,
      userId: player.userId,
      displayName: player.displayName,
      country: player.country,
      email: player.email,
      pdgaNumber: player.pdgaNumber,
      homeClub: player.homeClub,
      dateOfBirth: player.dateOfBirth,
      genderCategory: player.genderCategory,
    };

    const targetUserId = body.playerId ? null : (body.userId || session.user.id);
    const existingRows = body.playerId
      ? await db.select(playerSelect).from(player).where(eq(player.id, body.playerId)).limit(1)
      : await db.select(playerSelect).from(player).where(eq(player.userId, targetUserId!)).limit(1);

    if (existingRows[0]) {
      target = { ...existingRows[0], isNew: false };
    }
    else if (body.playerId) {
      throw createError({ statusCode: 404, message: "Player not found" });
    }
    else {
      const userRows = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          country: user.country,
          pdgaNumber: user.pdgaNumber,
          homeClub: user.homeClub,
          dateOfBirth: user.dateOfBirth,
          genderCategory: user.genderCategory,
          banned: user.banned,
        })
        .from(user)
        .where(eq(user.id, targetUserId!))
        .limit(1);

      const resolvedUser = userRows[0];
      if (!resolvedUser) {
        throw createError({ statusCode: 404, message: "User not found" });
      }
      if (resolvedUser.banned) {
        throw createError({ statusCode: 403, message: "This user account is banned and cannot be registered" });
      }

      target = {
        id: crypto.randomUUID(),
        userId: resolvedUser.id,
        isNew: true,
        displayName: resolvedUser.name,
        country: resolvedUser.country,
        email: resolvedUser.email,
        pdgaNumber: resolvedUser.pdgaNumber,
        homeClub: resolvedUser.homeClub,
        dateOfBirth: resolvedUser.dateOfBirth,
        genderCategory: resolvedUser.genderCategory || "open",
      };
    }
  }

  if (!isManager && target.userId !== session.user.id) {
    throw createError({ statusCode: 403, message: "Cannot register a different player" });
  }

  // 2. Apply profile overrides in memory
  const profile = body.profile;
  const effective = profile
    ? {
        ...target,
        displayName: resolveProfileText(profile.displayName, target.displayName) || target.displayName,
        country: resolveProfileText(profile.country, target.country),
        email: resolveProfileText(profile.email, target.email),
        pdgaNumber: resolveProfileText(profile.pdgaNumber, target.pdgaNumber),
        homeClub: resolveProfileText(profile.homeClub, target.homeClub),
        dateOfBirth: resolveProfileText(profile.dateOfBirth, target.dateOfBirth),
        genderCategory: profile.genderCategory !== undefined ? (profile.genderCategory || "open") : target.genderCategory,
      }
    : target;

  // 3. Validate division eligibility & disciplines
  const majorValidation = validateMajorDivision({
    majorDivision: body.majorDivision,
    offeredDivisionCodes: policyContext.offeredDivisionCodes,
    player: { dateOfBirth: effective.dateOfBirth, genderCategory: effective.genderCategory },
    eventTimestamp: foundTournament.startDate,
    policy: policyContext.config,
  });

  if (!majorValidation.eligible) {
    throw createError({
      statusCode: 400,
      message: `Player is not eligible for division ${body.majorDivision} (${MAJOR_DIVISION_REASON_LABELS[majorValidation.reason]})`,
    });
  }

  const isBatchSync = Array.isArray(body.disciplines) && body.disciplines.length > 0;
  const requestedDisciplines = resolveRequestedDisciplines(
    foundTournament,
    isBatchSync ? body.disciplines! : [body.discipline || "overall"],
  );

  const existingEntries = target.isNew
    ? []
    : await db
        .select({ id: eventEntry.id, discipline: eventEntry.discipline, status: eventEntry.status })
        .from(eventEntry)
        .where(and(eq(eventEntry.playerId, target.id), eq(eventEntry.tournamentId, foundTournament.id)));

  // Legacy single-discipline call: reject duplicates of active entries
  if (!isBatchSync) {
    const singleExisting = existingEntries.find(row => row.discipline === requestedDisciplines[0]);
    if (singleExisting?.status === "registered") {
      throw createError({ statusCode: 409, message: "Player is already registered for this discipline" });
    }
  }

  const derived = deriveMinorDivisions(
    { dateOfBirth: effective.dateOfBirth, genderCategory: effective.genderCategory },
    foundTournament.startDate,
    policyContext.config,
  );

  // 4. Build all writes and execute atomically
  const now = Date.now();
  const statements: BatchItem<"sqlite">[] = [];

  const playerValues = {
    displayName: effective.displayName,
    country: effective.country,
    email: effective.email,
    pdgaNumber: effective.pdgaNumber,
    homeClub: effective.homeClub,
    dateOfBirth: effective.dateOfBirth,
    genderCategory: effective.genderCategory,
    updatedAt: now,
  };

  if (target.isNew) {
    statements.push(db.insert(player).values({ id: target.id, userId: target.userId, createdAt: now, ...playerValues }));
  }
  else if (profile) {
    statements.push(db.update(player).set(playerValues).where(eq(player.id, target.id)));
  }

  // Keep the signed-in user's own account profile in sync when they self-register
  if (profile && target.userId && target.userId === session.user.id) {
    statements.push(
      db.update(user)
        .set({
          country: profile.country !== undefined ? effective.country : undefined,
          pdgaNumber: profile.pdgaNumber !== undefined ? effective.pdgaNumber : undefined,
          homeClub: profile.homeClub !== undefined ? effective.homeClub : undefined,
          dateOfBirth: profile.dateOfBirth !== undefined ? effective.dateOfBirth : undefined,
          genderCategory: profile.genderCategory !== undefined ? effective.genderCategory : undefined,
          updatedAt: now,
        })
        .where(eq(user.id, target.userId)),
    );
  }

  const sync = buildEntrySyncStatements({
    playerId: target.id,
    tournamentId: foundTournament.id,
    disciplines: requestedDisciplines,
    existingEntries,
    majorDivision: body.majorDivision,
    minorDivisionTags: derived.minorDivisionTags,
    primaryMinorDivision: derived.primaryMinorDivision,
    status: "registered",
    changedBy: session.user.id,
    now,
    withdrawUnlisted: isBatchSync,
  });
  statements.push(...sync.statements);

  await runBatch(statements);

  const resultEntries = requestedDisciplines.map(disc => ({
    id: sync.entryIdByDiscipline.get(disc)!,
    tournamentId: foundTournament.id,
    playerId: target.id,
    playerName: effective.displayName,
    discipline: disc,
    majorDivision: body.majorDivision,
    minorDivisionTags: derived.minorDivisionTags,
    primaryMinorDivision: derived.primaryMinorDivision,
    activeCompetitiveDivision: body.majorDivision,
    status: "registered" as const,
  }));

  return {
    success: true,
    entry: resultEntries[0],
    entries: resultEntries,
  };
});
