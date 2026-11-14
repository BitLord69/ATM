import { and, asc, eq } from "drizzle-orm";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import {
  divisionPolicy,
  eventEntry,
  player,
  tournament,
  tournamentDivision,
  tournamentMembership,
  tournamentPlayerNumber,
  user,
} from "../../../../lib/db/schema";
import { hasTournamentRole } from "../../../utils/authorization";
import {
  getEnabledTournamentDisciplines,
  mapPolicyFromDb,
} from "../../../utils/division-policy";

function safeParseMinorTags(raw: string | null | undefined) {
  if (!raw) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
  }
  catch {
    return [];
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

  const tournamentRows = await db
    .select({
      id: tournament.id,
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

  if (!hasTournamentRole(session.user.role, membershipRows[0], "viewer")) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const canManage = hasTournamentRole(session.user.role, membershipRows[0], "scorer");

  const [rows, numberRows, policyRows, offeredRows, allUsers] = await Promise.all([
    db
      .select({
        id: eventEntry.id,
        playerId: eventEntry.playerId,
        discipline: eventEntry.discipline,
        majorDivision: eventEntry.majorDivision,
        minorDivisionTags: eventEntry.minorDivisionTags,
        primaryMinorDivision: eventEntry.primaryMinorDivision,
        activeCompetitiveDivision: eventEntry.activeCompetitiveDivision,
        status: eventEntry.status,
        createdAt: eventEntry.createdAt,
        playerUserId: player.userId,
        playerDisplayName: player.displayName,
        playerCountry: player.country,
        playerEmail: player.email,
        playerPdgaNumber: player.pdgaNumber,
        playerHomeClub: player.homeClub,
        playerDateOfBirth: player.dateOfBirth,
        playerGenderCategory: player.genderCategory,
        userName: user.name,
        userEmail: user.email,
        userCountry: user.country,
      })
      .from(eventEntry)
      .innerJoin(player, eq(player.id, eventEntry.playerId))
      .leftJoin(user, eq(user.id, player.userId))
      .where(eq(eventEntry.tournamentId, foundTournament.id))
      .orderBy(asc(eventEntry.discipline), asc(eventEntry.majorDivision), asc(eventEntry.createdAt)),
    db
      .select({
        playerId: tournamentPlayerNumber.playerId,
        playerNumber: tournamentPlayerNumber.playerNumber,
      })
      .from(tournamentPlayerNumber)
      .where(eq(tournamentPlayerNumber.tournamentId, foundTournament.id)),
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
    canManage
      ? db
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
          .orderBy(asc(user.name))
      : Promise.resolve([]),
  ]);

  const numberByPlayerId = new Map(numberRows.map(row => [row.playerId, row.playerNumber]));
  const policyContext = mapPolicyFromDb(policyRows[0], offeredRows, foundTournament);
  const enabledDisciplines = getEnabledTournamentDisciplines(foundTournament);

  const normalizedEntries = rows.map(row => ({
    ...row,
    isGuest: !row.playerUserId,
    resolvedName: row.playerDisplayName || row.userName || "Unknown Player",
    resolvedCountry: row.playerCountry || row.userCountry || null,
    resolvedEmail: row.playerEmail || row.userEmail || null,
    playerNumber: numberByPlayerId.get(row.playerId) ?? null,
    minorDivisionTags: safeParseMinorTags(row.minorDivisionTags),
  }));

  // Group entries by player for convenient player-centric management
  const playersMap = new Map<string, {
    playerId: string;
    userId: string | null;
    isGuest: boolean;
    displayName: string;
    country: string | null;
    email: string | null;
    pdgaNumber: string | null;
    homeClub: string | null;
    dateOfBirth: string | null;
    genderCategory: string | null;
    playerNumber: number | null;
    majorDivision: string;
    minorDivisionTags: string[];
    primaryMinorDivision: string | null;
    activeDisciplines: string[];
    withdrawnDisciplines: string[];
    overallStatus: "registered" | "withdrawn";
  }>();

  for (const entry of normalizedEntries) {
    let group = playersMap.get(entry.playerId);
    if (!group) {
      group = {
        playerId: entry.playerId,
        userId: entry.playerUserId,
        isGuest: entry.isGuest,
        displayName: entry.resolvedName,
        country: entry.resolvedCountry,
        email: entry.resolvedEmail,
        pdgaNumber: entry.playerPdgaNumber,
        homeClub: entry.playerHomeClub,
        dateOfBirth: entry.playerDateOfBirth,
        genderCategory: entry.playerGenderCategory,
        playerNumber: entry.playerNumber,
        majorDivision: entry.majorDivision,
        minorDivisionTags: entry.minorDivisionTags,
        primaryMinorDivision: entry.primaryMinorDivision,
        activeDisciplines: [],
        withdrawnDisciplines: [],
        overallStatus: "withdrawn",
      };
      playersMap.set(entry.playerId, group);
    }

    if (entry.status === "registered") {
      group.activeDisciplines.push(entry.discipline);
      group.overallStatus = "registered";
      group.majorDivision = entry.majorDivision;
      group.minorDivisionTags = entry.minorDivisionTags;
      group.primaryMinorDivision = entry.primaryMinorDivision;
    }
    else {
      group.withdrawnDisciplines.push(entry.discipline);
    }
  }

  return {
    tournamentId: foundTournament.id,
    majorDivisions: policyContext.majorDivisions,
    enabledDisciplines,
    entries: normalizedEntries,
    players: [...playersMap.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    availableUsers: allUsers,
  };
});
