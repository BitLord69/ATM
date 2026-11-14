import { and, eq } from "drizzle-orm";

import { tournamentPlayerRegistrationPatchSchema } from "#shared/schemas/divisions";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import {
  divisionPolicy,
  eventEntry,
  player,
  tournament,
  tournamentDivision,
  tournamentMembership,
  tournamentRegistrationLock,
} from "../../../../../lib/db/schema";
import { hasTournamentRole } from "../../../../utils/authorization";
import { deriveMinorDivisions } from "../../../../utils/division-derivation";
import { validateMajorDivision } from "../../../../utils/division-eligibility";
import {
  getEnabledTournamentDisciplines,
  getTournamentRegistrationStatus,
  mapPolicyFromDb,
} from "../../../../utils/division-policy";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  const playerId = getRouterParam(event, "id");

  if (!slug || !playerId) {
    throw createError({ statusCode: 400, message: "Tournament slug and playerId are required" });
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

  const playerRows = await db
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
    .limit(1);

  const targetPlayer = playerRows[0];
  if (!targetPlayer) {
    throw createError({ statusCode: 404, message: "Player not found" });
  }

  if (!isManager && targetPlayer.userId !== session.user.id) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const lockRows = await db
    .select({ isLocked: tournamentRegistrationLock.isLocked })
    .from(tournamentRegistrationLock)
    .where(eq(tournamentRegistrationLock.tournamentId, foundTournament.id))
    .limit(1);

  const registrationState = getTournamentRegistrationStatus(foundTournament, !!lockRows[0]?.isLocked);
  if (!isManager && !registrationState.isRegistrationOpen) {
    throw createError({
      statusCode: 423,
      message: "Registration is currently closed or locked. Contact a TD/admin for changes.",
    });
  }

  const now = Date.now();
  let updatedDateOfBirth = targetPlayer.dateOfBirth;
  let updatedGenderCategory = targetPlayer.genderCategory;

  if (body.profile) {
    updatedDateOfBirth = body.profile.dateOfBirth !== undefined
      ? (body.profile.dateOfBirth?.trim() || null)
      : targetPlayer.dateOfBirth;
    updatedGenderCategory = body.profile.genderCategory !== undefined
      ? (body.profile.genderCategory || "open")
      : targetPlayer.genderCategory;

    await db
      .update(player)
      .set({
        displayName: body.profile.displayName !== undefined ? (body.profile.displayName?.trim() || targetPlayer.displayName) : targetPlayer.displayName,
        country: body.profile.country !== undefined ? (body.profile.country?.trim() || null) : targetPlayer.country,
        email: body.profile.email !== undefined ? (body.profile.email?.trim() || null) : targetPlayer.email,
        pdgaNumber: body.profile.pdgaNumber !== undefined ? (body.profile.pdgaNumber?.trim() || null) : targetPlayer.pdgaNumber,
        homeClub: body.profile.homeClub !== undefined ? (body.profile.homeClub?.trim() || null) : targetPlayer.homeClub,
        dateOfBirth: updatedDateOfBirth,
        genderCategory: updatedGenderCategory,
        updatedAt: now,
      })
      .where(eq(player.id, targetPlayer.id));
  }

  const existingEntries = await db
    .select({
      id: eventEntry.id,
      discipline: eventEntry.discipline,
      majorDivision: eventEntry.majorDivision,
      status: eventEntry.status,
    })
    .from(eventEntry)
    .where(
      and(
        eq(eventEntry.playerId, targetPlayer.id),
        eq(eventEntry.tournamentId, foundTournament.id),
      ),
    );

  if (existingEntries.length === 0 && !body.disciplines?.length) {
    throw createError({ statusCode: 404, message: "No registration entries found for this player in this tournament" });
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
  const resolvedMajorDivision = body.majorDivision || existingEntries[0]?.majorDivision || "OPEN";

  if (body.majorDivision || body.profile) {
    const majorValidation = validateMajorDivision({
      majorDivision: resolvedMajorDivision,
      offeredDivisionCodes: policyContext.offeredDivisionCodes,
      player: {
        dateOfBirth: updatedDateOfBirth,
        genderCategory: updatedGenderCategory,
      },
      eventTimestamp: foundTournament.startDate,
      policy: policyContext.config,
    });

    if (!majorValidation.eligible) {
      throw createError({
        statusCode: 400,
        message: `Player is not eligible for division ${resolvedMajorDivision} (${majorValidation.reason})`,
      });
    }
  }

  const derived = deriveMinorDivisions(
    {
      dateOfBirth: updatedDateOfBirth,
      genderCategory: updatedGenderCategory,
    },
    foundTournament.startDate,
    policyContext.config,
  );

  // If status is explicitly set to withdrawn without discipline list changes, mark all entries withdrawn
  if (body.status === "withdrawn" && !body.disciplines) {
    await db
      .update(eventEntry)
      .set({
        status: "withdrawn",
        changedBy: session.user.id,
        updatedAt: now,
      })
      .where(
        and(
          eq(eventEntry.playerId, targetPlayer.id),
          eq(eventEntry.tournamentId, foundTournament.id),
        ),
      );

    return {
      success: true,
      playerId: targetPlayer.id,
      status: "withdrawn",
    };
  }

  if (body.disciplines?.length) {
    const enabledDisciplineKeys = new Set(
      getEnabledTournamentDisciplines(foundTournament).map(d => d.key),
    );
    enabledDisciplineKeys.add("overall");

    const requestedDisciplines = [...new Set(
      body.disciplines.map(d => d.trim().toLowerCase()).filter(Boolean),
    )];

    for (const disc of requestedDisciplines) {
      if (!enabledDisciplineKeys.has(disc)) {
        throw createError({
          statusCode: 400,
          message: `Discipline '${disc}' is not enabled for this tournament`,
        });
      }
    }

    const existingByDiscipline = new Map(existingEntries.map(row => [row.discipline, row]));
    const requestedSet = new Set(requestedDisciplines);

    for (const disc of requestedDisciplines) {
      const existing = existingByDiscipline.get(disc);
      if (existing) {
        await db
          .update(eventEntry)
          .set({
            majorDivision: resolvedMajorDivision,
            minorDivisionTags: JSON.stringify(derived.minorDivisionTags),
            primaryMinorDivision: derived.primaryMinorDivision,
            activeCompetitiveDivision: resolvedMajorDivision,
            status: body.status ?? "registered",
            changedBy: session.user.id,
            updatedAt: now,
          })
          .where(eq(eventEntry.id, existing.id));
      }
      else {
        await db.insert(eventEntry).values({
          id: crypto.randomUUID(),
          playerId: targetPlayer.id,
          tournamentId: foundTournament.id,
          discipline: disc,
          majorDivision: resolvedMajorDivision,
          minorDivisionTags: JSON.stringify(derived.minorDivisionTags),
          primaryMinorDivision: derived.primaryMinorDivision,
          activeCompetitiveDivision: resolvedMajorDivision,
          status: body.status ?? "registered",
          changedBy: session.user.id,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

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
  else {
    await db
      .update(eventEntry)
      .set({
        majorDivision: resolvedMajorDivision,
        minorDivisionTags: JSON.stringify(derived.minorDivisionTags),
        primaryMinorDivision: derived.primaryMinorDivision,
        activeCompetitiveDivision: resolvedMajorDivision,
        status: body.status ?? undefined,
        changedBy: session.user.id,
        updatedAt: now,
      })
      .where(
        and(
          eq(eventEntry.playerId, targetPlayer.id),
          eq(eventEntry.tournamentId, foundTournament.id),
        ),
      );
  }

  return {
    success: true,
    playerId: targetPlayer.id,
    majorDivision: resolvedMajorDivision,
    minorDivisionTags: derived.minorDivisionTags,
    primaryMinorDivision: derived.primaryMinorDivision,
  };
});
