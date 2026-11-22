import { asc, eq } from "drizzle-orm";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { eventEntry, player, tournamentPlayerNumber, user } from "../../../../lib/db/schema";
import { hasTournamentRole } from "../../../utils/authorization";
import { getEnabledTournamentDisciplines } from "../../../utils/division-policy";
import {
  loadDivisionPolicyContext,
  loadRegistrationTournament,
  loadTournamentMembership,
  safeParseMinorTags,
} from "../../../utils/tournament-registration-context";

type PlayerGroup = {
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
};

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, message: "Tournament slug is required" });
  }

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const foundTournament = await loadRegistrationTournament(slug);
  const membership = await loadTournamentMembership(foundTournament.id, session.user.id);

  if (!hasTournamentRole(session.user.role, membership, "viewer")) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const [rows, numberRows, policyContext] = await Promise.all([
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
    loadDivisionPolicyContext(foundTournament),
  ]);

  const numberByPlayerId = new Map(numberRows.map(row => [row.playerId, row.playerNumber]));

  const normalizedEntries = rows.map(row => ({
    ...row,
    isGuest: !row.playerUserId,
    resolvedName: row.playerDisplayName || row.userName || "Unknown Player",
    resolvedCountry: row.playerCountry || row.userCountry || null,
    resolvedEmail: row.playerEmail || row.userEmail || null,
    playerNumber: numberByPlayerId.get(row.playerId) ?? null,
    minorDivisionTags: safeParseMinorTags(row.minorDivisionTags),
  }));

  // Group entries by player for player-centric management
  const playersMap = new Map<string, PlayerGroup>();

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
    canManage: hasTournamentRole(session.user.role, membership, "scorer"),
    majorDivisions: policyContext.majorDivisions,
    enabledDisciplines: getEnabledTournamentDisciplines(foundTournament),
    entries: normalizedEntries,
    players: [...playersMap.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)),
  };
});
