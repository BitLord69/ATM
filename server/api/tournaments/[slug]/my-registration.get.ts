import { and, asc, eq } from "drizzle-orm";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import {
  divisionPolicy,
  eventEntry,
  player,
  tournament,
  tournamentPlayerNumber,
  user,
} from "../../../../lib/db/schema";
import { deriveMinorDivisions } from "../../../utils/division-derivation";
import { normalizeDivisionPolicy } from "../../../utils/division-policy";
import { safeParseMinorTags } from "../../../utils/tournament-registration-context";

const UNAUTHENTICATED_RESPONSE = {
  authenticated: false,
  profile: null,
  playerNumber: null,
  entries: [],
  derivedMinorDivisions: [] as string[],
  primaryMinorDivision: null as string | null,
};

/**
 * Returns the signed-in user's player profile and entries for a tournament.
 * Guests get a cheap unauthenticated response without any database lookups.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, message: "Tournament slug is required" });
  }

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    return UNAUTHENTICATED_RESPONSE;
  }

  const tournamentRows = await db
    .select({ id: tournament.id, startDate: tournament.startDate })
    .from(tournament)
    .where(eq(tournament.slug, slug))
    .limit(1);

  const foundTournament = tournamentRows[0];
  if (!foundTournament) {
    throw createError({ statusCode: 404, message: "Tournament not found" });
  }

  const [userRows, playerRows, policyRows] = await Promise.all([
    db
      .select({
        name: user.name,
        email: user.email,
        country: user.country,
        pdgaNumber: user.pdgaNumber,
        homeClub: user.homeClub,
        dateOfBirth: user.dateOfBirth,
        genderCategory: user.genderCategory,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1),
    db
      .select({
        id: player.id,
        displayName: player.displayName,
        country: player.country,
        email: player.email,
        pdgaNumber: player.pdgaNumber,
        homeClub: player.homeClub,
        dateOfBirth: player.dateOfBirth,
        genderCategory: player.genderCategory,
      })
      .from(player)
      .where(eq(player.userId, session.user.id))
      .limit(1),
    db
      .select({ ageReferenceMode: divisionPolicy.ageReferenceMode })
      .from(divisionPolicy)
      .where(eq(divisionPolicy.tournamentId, foundTournament.id))
      .limit(1),
  ]);

  const currentUser = userRows[0];
  const existingPlayer = playerRows[0];

  const profile = {
    playerId: existingPlayer?.id ?? null,
    displayName: existingPlayer?.displayName || currentUser?.name || session.user.name || "",
    country: existingPlayer?.country || currentUser?.country || "",
    email: existingPlayer?.email || currentUser?.email || session.user.email || "",
    pdgaNumber: existingPlayer?.pdgaNumber || currentUser?.pdgaNumber || "",
    homeClub: existingPlayer?.homeClub || currentUser?.homeClub || "",
    dateOfBirth: existingPlayer?.dateOfBirth || currentUser?.dateOfBirth || "",
    genderCategory: ((existingPlayer?.genderCategory || currentUser?.genderCategory) === "women" ? "women" : "open") as "open" | "women",
  };

  const policy = normalizeDivisionPolicy({
    ageReferenceMode: (policyRows[0]?.ageReferenceMode as "calendar_year" | "exact_date" | undefined) ?? undefined,
  });

  const derived = deriveMinorDivisions(
    { dateOfBirth: profile.dateOfBirth, genderCategory: profile.genderCategory },
    foundTournament.startDate,
    policy,
  );

  if (!existingPlayer) {
    return {
      authenticated: true,
      profile,
      playerNumber: null,
      entries: [],
      derivedMinorDivisions: derived.minorDivisionTags,
      primaryMinorDivision: derived.primaryMinorDivision,
    };
  }

  const [entries, numberRows] = await Promise.all([
    db
      .select({
        id: eventEntry.id,
        discipline: eventEntry.discipline,
        majorDivision: eventEntry.majorDivision,
        minorDivisionTags: eventEntry.minorDivisionTags,
        primaryMinorDivision: eventEntry.primaryMinorDivision,
        activeCompetitiveDivision: eventEntry.activeCompetitiveDivision,
        status: eventEntry.status,
        createdAt: eventEntry.createdAt,
        updatedAt: eventEntry.updatedAt,
      })
      .from(eventEntry)
      .where(and(eq(eventEntry.tournamentId, foundTournament.id), eq(eventEntry.playerId, existingPlayer.id)))
      .orderBy(asc(eventEntry.discipline)),
    db
      .select({ playerNumber: tournamentPlayerNumber.playerNumber })
      .from(tournamentPlayerNumber)
      .where(and(eq(tournamentPlayerNumber.tournamentId, foundTournament.id), eq(tournamentPlayerNumber.playerId, existingPlayer.id)))
      .limit(1),
  ]);

  return {
    authenticated: true,
    profile,
    playerNumber: numberRows[0]?.playerNumber ?? null,
    entries: entries.map(row => ({
      ...row,
      minorDivisionTags: safeParseMinorTags(row.minorDivisionTags),
    })),
    derivedMinorDivisions: derived.minorDivisionTags,
    primaryMinorDivision: derived.primaryMinorDivision,
  };
});
