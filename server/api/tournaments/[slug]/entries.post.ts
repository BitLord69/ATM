import { and, eq } from "drizzle-orm";

import { tournamentEntryCreateSchema } from "#shared/schemas/divisions";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import {
  divisionPolicy,
  eventEntry,
  player,
  tournament,
  tournamentDivision,
  tournamentMembership,
  tournamentRegistrationLock,
  user,
} from "../../../../lib/db/schema";
import { hasTournamentRole } from "../../../utils/authorization";
import { deriveMinorDivisions } from "../../../utils/division-derivation";
import { validateMajorDivision } from "../../../utils/division-eligibility";
import {
  getEnabledTournamentDisciplines,
  getTournamentRegistrationStatus,
  mapPolicyFromDb,
} from "../../../utils/division-policy";

function formatRegistrationClosedMessage(reason: string) {
  switch (reason) {
    case "tournament_closed":
      return "Registration is closed because this tournament has been finalized.";
    case "locked_by_staff":
      return "Registration is currently locked by tournament staff.";
    case "tournament_started":
      return "Registration is closed because the tournament has already started.";
    case "not_yet_open":
      return "Registration has not opened yet for this tournament.";
    case "registration_closed_date":
      return "The registration deadline for this tournament has passed.";
    default:
      return "Registration is currently closed.";
  }
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

  const bodyResult = tournamentEntryCreateSchema.safeParse(await readBody(event));
  if (!bodyResult.success) {
    throw createError({ statusCode: 400, message: bodyResult.error.issues[0]?.message || "Invalid request body" });
  }

  const body = bodyResult.data;

  const tournamentRows = await db
    .select({
      id: tournament.id,
      startDate: tournament.startDate,
      closedAt: tournament.closedAt,
      registrationOpenDate: tournament.registrationOpenDate,
      registrationCloseDate: tournament.registrationCloseDate,
      divisionOpen: tournament.divisionOpen,
      divisionWomen: tournament.divisionWomen,
      divisionMaster: tournament.divisionMaster,
      divisionGrandMaster: tournament.divisionGrandMaster,
      divisionSeniorGrandMaster: tournament.divisionSeniorGrandMaster,
      divisionLegend: tournament.divisionLegend,
      divisionJunior: tournament.divisionJunior,
      keepJuniorsSeparate: tournament.keepJuniorsSeparate,
      hasGolf: tournament.hasGolf,
      hasAccuracy: tournament.hasAccuracy,
      hasDistance: tournament.hasDistance,
      hasSCF: tournament.hasSCF,
      hasDiscathon: tournament.hasDiscathon,
      hasDDC: tournament.hasDDC,
      hasFreestyle: tournament.hasFreestyle,
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

  const isManager = hasTournamentRole(session.user.role, membershipRows[0], "scorer");

  const registrationLockRows = await db
    .select({ isLocked: tournamentRegistrationLock.isLocked })
    .from(tournamentRegistrationLock)
    .where(eq(tournamentRegistrationLock.tournamentId, foundTournament.id))
    .limit(1);

  const registrationState = getTournamentRegistrationStatus(
    foundTournament,
    !!registrationLockRows[0]?.isLocked,
  );

  if (!isManager && !registrationState.isRegistrationOpen) {
    throw createError({
      statusCode: 423,
      message: formatRegistrationClosedMessage(registrationState.registrationStatusReason),
    });
  }

  if ((body.playerId || body.userId || body.guestPlayer) && !isManager) {
    throw createError({ statusCode: 403, message: "Only tournament managers can register other players or guests" });
  }

  const now = Date.now();
  let targetPlayerId = body.playerId;

  if (body.guestPlayer) {
    const newGuestId = crypto.randomUUID();
    await db.insert(player).values({
      id: newGuestId,
      userId: null,
      displayName: body.guestPlayer.displayName.trim(),
      country: body.guestPlayer.country?.trim() || null,
      email: body.guestPlayer.email?.trim() || null,
      pdgaNumber: body.guestPlayer.pdgaNumber?.trim() || null,
      homeClub: body.guestPlayer.homeClub?.trim() || null,
      dateOfBirth: body.guestPlayer.dateOfBirth?.trim() || null,
      genderCategory: body.guestPlayer.genderCategory || "open",
      createdAt: now,
      updatedAt: now,
    });
    targetPlayerId = newGuestId;
  }
  else if (!targetPlayerId) {
    const targetUserId = body.userId || session.user.id;
    const playerRows = await db
      .select({ id: player.id })
      .from(player)
      .where(eq(player.userId, targetUserId))
      .limit(1);

    if (playerRows[0]) {
      targetPlayerId = playerRows[0].id;
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
        })
        .from(user)
        .where(eq(user.id, targetUserId))
        .limit(1);

      const resolvedUser = userRows[0];
      if (!resolvedUser) {
        throw createError({ statusCode: 404, message: "User not found" });
      }

      const createdPlayer = await db
        .insert(player)
        .values({
          id: crypto.randomUUID(),
          userId: resolvedUser.id,
          displayName: body.profile?.displayName?.trim() || resolvedUser.name,
          country: body.profile?.country?.trim() || resolvedUser.country,
          email: body.profile?.email?.trim() || resolvedUser.email,
          pdgaNumber: body.profile?.pdgaNumber?.trim() || resolvedUser.pdgaNumber,
          homeClub: body.profile?.homeClub?.trim() || resolvedUser.homeClub,
          dateOfBirth: body.profile?.dateOfBirth?.trim() || resolvedUser.dateOfBirth,
          genderCategory: body.profile?.genderCategory || resolvedUser.genderCategory || "open",
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: player.id });

      targetPlayerId = createdPlayer[0]?.id;
    }
  }

  if (!targetPlayerId) {
    throw createError({ statusCode: 500, message: "Failed to resolve player profile" });
  }

  if (body.profile) {
    const existingRows = await db
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
      .where(eq(player.id, targetPlayerId))
      .limit(1);

    const existingPlayer = existingRows[0];
    if (existingPlayer) {
      await db
        .update(player)
        .set({
          displayName: body.profile.displayName !== undefined ? (body.profile.displayName?.trim() || existingPlayer.displayName) : existingPlayer.displayName,
          country: body.profile.country !== undefined ? (body.profile.country?.trim() || null) : existingPlayer.country,
          email: body.profile.email !== undefined ? (body.profile.email?.trim() || null) : existingPlayer.email,
          pdgaNumber: body.profile.pdgaNumber !== undefined ? (body.profile.pdgaNumber?.trim() || null) : existingPlayer.pdgaNumber,
          homeClub: body.profile.homeClub !== undefined ? (body.profile.homeClub?.trim() || null) : existingPlayer.homeClub,
          dateOfBirth: body.profile.dateOfBirth !== undefined ? (body.profile.dateOfBirth?.trim() || null) : existingPlayer.dateOfBirth,
          genderCategory: body.profile.genderCategory !== undefined ? (body.profile.genderCategory || "open") : existingPlayer.genderCategory,
          updatedAt: now,
        })
        .where(eq(player.id, existingPlayer.id));

      if (existingPlayer.userId && existingPlayer.userId === session.user.id) {
        await db
          .update(user)
          .set({
            country: body.profile.country !== undefined ? (body.profile.country?.trim() || null) : undefined,
            pdgaNumber: body.profile.pdgaNumber !== undefined ? (body.profile.pdgaNumber?.trim() || null) : undefined,
            homeClub: body.profile.homeClub !== undefined ? (body.profile.homeClub?.trim() || null) : undefined,
            dateOfBirth: body.profile.dateOfBirth !== undefined ? (body.profile.dateOfBirth?.trim() || null) : undefined,
            genderCategory: body.profile.genderCategory !== undefined ? (body.profile.genderCategory || "open") : undefined,
            updatedAt: now,
          })
          .where(eq(user.id, existingPlayer.userId));
      }
    }
  }

  const targetPlayerRows = await db
    .select({
      id: player.id,
      userId: player.userId,
      dateOfBirth: player.dateOfBirth,
      genderCategory: player.genderCategory,
      displayName: player.displayName,
    })
    .from(player)
    .where(eq(player.id, targetPlayerId))
    .limit(1);

  const targetPlayer = targetPlayerRows[0];
  if (!targetPlayer) {
    throw createError({ statusCode: 404, message: "Player not found" });
  }

  if (!isManager && targetPlayer.userId !== session.user.id) {
    throw createError({ statusCode: 403, message: "Cannot register a different player" });
  }

  const [policyRows, offeredRows] = await Promise.all([
    db
      .select({ ageReferenceMode: divisionPolicy.ageReferenceMode })
      .from(divisionPolicy)
      .where(eq(divisionPolicy.tournamentId, foundTournament.id))
      .limit(1),
    db
      .select({
        code: tournamentDivision.code,
        label: tournamentDivision.label,
        isEnabled: tournamentDivision.isEnabled,
      })
      .from(tournamentDivision)
      .where(eq(tournamentDivision.tournamentId, foundTournament.id)),
  ]);

  const policyContext = mapPolicyFromDb(policyRows[0], offeredRows, foundTournament);

  const majorValidation = validateMajorDivision({
    majorDivision: body.majorDivision,
    offeredDivisionCodes: policyContext.offeredDivisionCodes,
    player: {
      dateOfBirth: targetPlayer.dateOfBirth,
      genderCategory: targetPlayer.genderCategory,
    },
    eventTimestamp: foundTournament.startDate,
    policy: policyContext.config,
  });

  if (!majorValidation.eligible) {
    const reasonLabels: Record<string, string> = {
      division_not_offered: "this division is not offered in this tournament",
      missing_birth_date: "date of birth is required for age-protected divisions",
      gender_not_eligible: "selected gender category is not eligible for this division",
      age_not_eligible: "player age does not meet the requirements for this division",
    };
    throw createError({
      statusCode: 400,
      message: `Player is not eligible for division ${body.majorDivision} (${reasonLabels[majorValidation.reason] || majorValidation.reason})`,
    });
  }

  const enabledDisciplineKeys = new Set(
    getEnabledTournamentDisciplines(foundTournament).map(d => d.key),
  );
  enabledDisciplineKeys.add("overall");

  const rawRequestedDisciplines = body.disciplines?.length
    ? body.disciplines
    : [body.discipline || "overall"];

  const requestedDisciplines = [...new Set(
    rawRequestedDisciplines.map(d => d.trim().toLowerCase()).filter(Boolean),
  )];

  for (const disc of requestedDisciplines) {
    if (!enabledDisciplineKeys.has(disc)) {
      throw createError({
        statusCode: 400,
        message: `Discipline '${disc}' is not enabled for this tournament`,
      });
    }
  }

  const derived = deriveMinorDivisions(
    {
      dateOfBirth: targetPlayer.dateOfBirth,
      genderCategory: targetPlayer.genderCategory,
    },
    foundTournament.startDate,
    policyContext.config,
  );

  const existingEntries = await db
    .select({
      id: eventEntry.id,
      discipline: eventEntry.discipline,
      status: eventEntry.status,
    })
    .from(eventEntry)
    .where(
      and(
        eq(eventEntry.playerId, targetPlayer.id),
        eq(eventEntry.tournamentId, foundTournament.id),
      ),
    );

  const existingByDiscipline = new Map(existingEntries.map(row => [row.discipline, row]));
  const isBatchSync = Array.isArray(body.disciplines) && body.disciplines.length > 0;

  // Legacy single-discipline call throws 409 if already registered and active
  if (!isBatchSync) {
    const singleExisting = existingByDiscipline.get(requestedDisciplines[0]!);
    if (singleExisting && singleExisting.status === "registered") {
      throw createError({ statusCode: 409, message: "Player is already registered for this discipline" });
    }
  }

  const resultEntries = [];

  for (const disc of requestedDisciplines) {
    const existing = existingByDiscipline.get(disc);
    if (existing) {
      await db
        .update(eventEntry)
        .set({
          majorDivision: body.majorDivision,
          minorDivisionTags: JSON.stringify(derived.minorDivisionTags),
          primaryMinorDivision: derived.primaryMinorDivision,
          activeCompetitiveDivision: body.majorDivision,
          status: "registered",
          changedBy: session.user.id,
          updatedAt: now,
        })
        .where(eq(eventEntry.id, existing.id));

      resultEntries.push({
        id: existing.id,
        tournamentId: foundTournament.id,
        playerId: targetPlayer.id,
        playerName: targetPlayer.displayName,
        discipline: disc,
        majorDivision: body.majorDivision,
        minorDivisionTags: derived.minorDivisionTags,
        primaryMinorDivision: derived.primaryMinorDivision,
        activeCompetitiveDivision: body.majorDivision,
        status: "registered",
      });
    }
    else {
      const entryId = crypto.randomUUID();
      await db.insert(eventEntry).values({
        id: entryId,
        playerId: targetPlayer.id,
        tournamentId: foundTournament.id,
        discipline: disc,
        majorDivision: body.majorDivision,
        minorDivisionTags: JSON.stringify(derived.minorDivisionTags),
        primaryMinorDivision: derived.primaryMinorDivision,
        activeCompetitiveDivision: body.majorDivision,
        status: "registered",
        changedBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      });

      resultEntries.push({
        id: entryId,
        tournamentId: foundTournament.id,
        playerId: targetPlayer.id,
        playerName: targetPlayer.displayName,
        discipline: disc,
        majorDivision: body.majorDivision,
        minorDivisionTags: derived.minorDivisionTags,
        primaryMinorDivision: derived.primaryMinorDivision,
        activeCompetitiveDivision: body.majorDivision,
        status: "registered",
      });
    }
  }

  if (isBatchSync) {
    const requestedSet = new Set(requestedDisciplines);
    for (const existing of existingEntries) {
      if (!requestedSet.has(existing.discipline) && existing.status !== "withdrawn") {
        await db
          .update(eventEntry)
          .set({
            status: "withdrawn",
            changedBy: session.user.id,
            updatedAt: now,
          })
          .where(eq(eventEntry.id, existing.id));
      }
    }
  }

  return {
    success: true,
    entry: resultEntries[0],
    entries: resultEntries,
  };
});
