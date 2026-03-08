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
import { deriveMinorDivisions } from "../../../utils/division-derivation";
import { validateMajorDivision } from "../../../utils/division-eligibility";
import { mapPolicyFromDb } from "../../../utils/division-policy";

function canManageTournament(globalRole: string | undefined, membership: { role: string; status: string } | undefined) {
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
    .select({ id: tournament.id, startDate: tournament.startDate })
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

  const isManager = canManageTournament(session.user.role, membershipRows[0]);

  const now = Date.now();
  const hasStarted = !!foundTournament.startDate && now >= foundTournament.startDate;

  const registrationLockRows = await db
    .select({ isLocked: tournamentRegistrationLock.isLocked })
    .from(tournamentRegistrationLock)
    .where(eq(tournamentRegistrationLock.tournamentId, foundTournament.id))
    .limit(1);

  const registrationLocked = !!registrationLockRows[0]?.isLocked;

  if (!isManager && (hasStarted || registrationLocked)) {
    throw createError({
      statusCode: 423,
      message: hasStarted
        ? "Registration is closed because the tournament has started. Contact a TD/admin for exceptions."
        : "Registration is currently locked by tournament staff.",
    });
  }

  let targetPlayerId = body.playerId;

  if (targetPlayerId && !isManager) {
    throw createError({ statusCode: 403, message: "Only tournament managers can register other players" });
  }

  if (!targetPlayerId) {
    const playerRows = await db
      .select({ id: player.id })
      .from(player)
      .where(eq(player.userId, session.user.id))
      .limit(1);

    if (playerRows[0]) {
      targetPlayerId = playerRows[0].id;
    }
    else {
      const userRows = await db
        .select({
          id: user.id,
          name: user.name,
          pdgaNumber: user.pdgaNumber,
          homeClub: user.homeClub,
          dateOfBirth: user.dateOfBirth,
          genderCategory: user.genderCategory,
        })
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1);

      const currentUser = userRows[0];
      if (!currentUser) {
        throw createError({ statusCode: 404, message: "User not found" });
      }

      const createdPlayer = await db
        .insert(player)
        .values({
          id: crypto.randomUUID(),
          userId: currentUser.id,
          displayName: currentUser.name,
          pdgaNumber: currentUser.pdgaNumber,
          homeClub: currentUser.homeClub,
          dateOfBirth: currentUser.dateOfBirth,
          genderCategory: currentUser.genderCategory,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .returning({ id: player.id });

      targetPlayerId = createdPlayer[0]?.id;
    }
  }

  if (!targetPlayerId) {
    throw createError({ statusCode: 500, message: "Failed to resolve player profile" });
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

  const policyRows = await db
    .select({
      ageReferenceMode: divisionPolicy.ageReferenceMode,
    })
    .from(divisionPolicy)
    .where(eq(divisionPolicy.tournamentId, foundTournament.id))
    .limit(1);

  const offeredRows = await db
    .select({
      code: tournamentDivision.code,
      isEnabled: tournamentDivision.isEnabled,
    })
    .from(tournamentDivision)
    .where(eq(tournamentDivision.tournamentId, foundTournament.id));

  const policyContext = mapPolicyFromDb(policyRows[0], offeredRows);

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
    throw createError({
      statusCode: 400,
      message: `Player is not eligible for division ${body.majorDivision} (${majorValidation.reason})`,
    });
  }

  const existingRows = await db
    .select({ id: eventEntry.id })
    .from(eventEntry)
    .where(
      and(
        eq(eventEntry.playerId, targetPlayer.id),
        eq(eventEntry.tournamentId, foundTournament.id),
        eq(eventEntry.discipline, body.discipline),
      ),
    )
    .limit(1);

  if (existingRows[0]) {
    throw createError({ statusCode: 409, message: "Player is already registered for this discipline" });
  }

  const derived = deriveMinorDivisions(
    {
      dateOfBirth: targetPlayer.dateOfBirth,
      genderCategory: targetPlayer.genderCategory,
    },
    foundTournament.startDate,
    policyContext.config,
  );

  const entryId = crypto.randomUUID();

  await db.insert(eventEntry).values({
    id: entryId,
    playerId: targetPlayer.id,
    tournamentId: foundTournament.id,
    discipline: body.discipline,
    majorDivision: body.majorDivision,
    minorDivisionTags: JSON.stringify(derived.minorDivisionTags),
    primaryMinorDivision: derived.primaryMinorDivision,
    activeCompetitiveDivision: body.majorDivision,
    status: "registered",
    changedBy: session.user.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return {
    success: true,
    entry: {
      id: entryId,
      tournamentId: foundTournament.id,
      playerId: targetPlayer.id,
      playerName: targetPlayer.displayName,
      discipline: body.discipline,
      majorDivision: body.majorDivision,
      minorDivisionTags: derived.minorDivisionTags,
      primaryMinorDivision: derived.primaryMinorDivision,
      activeCompetitiveDivision: body.majorDivision,
      status: "registered",
    },
  };
});
