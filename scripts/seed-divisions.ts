import "dotenv/config";
import { asc, eq } from "drizzle-orm";

import db from "../lib/db/index";
import {
  divisionPolicy,
  eventEntry,
  player,
  startingListEntry,
  tournament,
  tournamentDivision,
  user,
} from "../lib/db/schema";

type GenderCategory = "open" | "women";

const fallbackBirthDates = [
  "1992-04-12",
  "1980-07-28",
  "1972-10-05",
  "2008-03-16",
  "1999-01-21",
  "1964-11-09",
];

function normalizeGenderCategory(raw: string | null | undefined): GenderCategory {
  if (!raw) {
    return "open";
  }

  const normalized = raw.trim().toLowerCase();
  if (["women", "woman", "female", "f", "fpo"].includes(normalized)) {
    return "women";
  }

  return "open";
}

function getBirthYear(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) {
    return null;
  }

  const year = Number.parseInt(dateOfBirth.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function deriveMinorTags(genderCategory: GenderCategory, dateOfBirth: string | null | undefined, eventTimestamp: number | null): string[] {
  const birthYear = getBirthYear(dateOfBirth);
  const eventDate = eventTimestamp ? new Date(eventTimestamp) : new Date();
  const eventYear = eventDate.getUTCFullYear();

  if (!birthYear) {
    return [];
  }

  const age = eventYear - birthYear;
  const adultPrefix = genderCategory === "women" ? "FP" : "MP";
  const juniorPrefix = genderCategory === "women" ? "FJ" : "MJ";
  const tags: string[] = [];

  if (age >= 40) tags.push(`${adultPrefix}40`);
  if (age >= 50) tags.push(`${adultPrefix}50`);
  if (age >= 60) tags.push(`${adultPrefix}60`);
  if (age <= 18) tags.push(`${juniorPrefix}18`);

  return tags;
}

async function seedPlayers() {
  const users = await db
    .select({
      id: user.id,
      name: user.name,
      pdgaNumber: user.pdgaNumber,
      homeClub: user.homeClub,
      dateOfBirth: user.dateOfBirth,
      genderCategory: user.genderCategory,
    })
    .from(user)
    .orderBy(asc(user.createdAt));

  if (users.length === 0) {
    throw new Error("No users found. Create at least one user before seeding divisions.");
  }

  let created = 0;
  let existing = 0;

  for (const [index, appUser] of users.entries()) {
    const existingPlayer = await db
      .select({ id: player.id })
      .from(player)
      .where(eq(player.userId, appUser.id))
      .limit(1);

    if (existingPlayer[0]) {
      existing += 1;
      continue;
    }

    await db.insert(player).values({
      id: crypto.randomUUID(),
      userId: appUser.id,
      displayName: appUser.name,
      pdgaNumber: appUser.pdgaNumber,
      homeClub: appUser.homeClub,
      dateOfBirth: appUser.dateOfBirth ?? fallbackBirthDates[index % fallbackBirthDates.length],
      genderCategory: normalizeGenderCategory(appUser.genderCategory),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    created += 1;
  }

  return { created, existing };
}

async function seedDivisionPolicies() {
  const tournaments = await db
    .select({ id: tournament.id })
    .from(tournament);

  let createdPolicies = 0;
  let createdDivisions = 0;

  for (const item of tournaments) {
    await db
      .insert(divisionPolicy)
      .values({
        id: crypto.randomUUID(),
        tournamentId: item.id,
        ageReferenceMode: "calendar_year",
        startingListMode: "major_only",
        showMinorOverlays: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .onConflictDoNothing({ target: divisionPolicy.tournamentId });

    const afterPolicy = await db
      .select({ id: divisionPolicy.id })
      .from(divisionPolicy)
      .where(eq(divisionPolicy.tournamentId, item.id))
      .limit(1);

    if (afterPolicy[0]) {
      createdPolicies += 1;
    }

    const offered = [
      { code: "MPO", label: "Mixed Pro Open", sortOrder: 10 },
      { code: "FPO", label: "Women Pro Open", sortOrder: 20 },
    ];

    for (const division of offered) {
      await db
        .insert(tournamentDivision)
        .values({
          id: crypto.randomUUID(),
          tournamentId: item.id,
          code: division.code,
          label: division.label,
          isEnabled: true,
          sortOrder: division.sortOrder,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .onConflictDoNothing({ target: [tournamentDivision.tournamentId, tournamentDivision.code] });

      createdDivisions += 1;
    }
  }

  return { createdPolicies, createdDivisions };
}

async function seedEntriesAndStartingLists() {
  const players = await db
    .select({
      id: player.id,
      userId: player.userId,
      dateOfBirth: player.dateOfBirth,
      genderCategory: player.genderCategory,
    })
    .from(player)
    .orderBy(asc(player.createdAt));

  const tournaments = await db
    .select({
      id: tournament.id,
      startDate: tournament.startDate,
    })
    .from(tournament)
    .orderBy(asc(tournament.startDate));

  if (players.length === 0 || tournaments.length === 0) {
    return { createdEntries: 0, createdStartingListEntries: 0 };
  }

  const selectedPlayers = players.slice(0, Math.min(players.length, 8));

  let createdEntries = 0;
  let createdStartingListEntries = 0;

  for (const item of tournaments) {
    for (const participant of selectedPlayers) {
      const genderCategory = normalizeGenderCategory(participant.genderCategory);
      const majorDivision = genderCategory === "women" ? "FPO" : "MPO";
      const minorTags = deriveMinorTags(genderCategory, participant.dateOfBirth, item.startDate);

      await db
        .insert(eventEntry)
        .values({
          id: crypto.randomUUID(),
          playerId: participant.id,
          tournamentId: item.id,
          discipline: "overall",
          majorDivision,
          minorDivisionTags: JSON.stringify(minorTags),
          primaryMinorDivision: minorTags.at(-1) ?? null,
          activeCompetitiveDivision: majorDivision,
          status: "registered",
          changedBy: participant.userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .onConflictDoNothing({ target: [eventEntry.playerId, eventEntry.tournamentId, eventEntry.discipline] });

      createdEntries += 1;
    }

    const entries = await db
      .select({
        id: eventEntry.id,
        activeCompetitiveDivision: eventEntry.activeCompetitiveDivision,
      })
      .from(eventEntry)
      .where(eq(eventEntry.tournamentId, item.id))
      .orderBy(asc(eventEntry.activeCompetitiveDivision), asc(eventEntry.createdAt), asc(eventEntry.id));

    for (const [positionIndex, entry] of entries.entries()) {
      await db
        .insert(startingListEntry)
        .values({
          id: crypto.randomUUID(),
          eventEntryId: entry.id,
          tournamentId: item.id,
          discipline: "overall",
          roundNumber: 1,
          position: positionIndex + 1,
          activeCompetitiveDivisionSnapshot: entry.activeCompetitiveDivision,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .onConflictDoNothing({ target: [startingListEntry.roundNumber, startingListEntry.eventEntryId] });

      createdStartingListEntries += 1;
    }
  }

  return { createdEntries, createdStartingListEntries };
}

async function main() {
  console.log("🌱 Seeding division-related tables...");

  const playerSummary = await seedPlayers();
  console.log(`✓ Players ensured. created=${playerSummary.created}, existing=${playerSummary.existing}`);

  const policySummary = await seedDivisionPolicies();
  console.log(`✓ Division policies/divisions ensured. policiesTouched=${policySummary.createdPolicies}, divisionInsertsAttempted=${policySummary.createdDivisions}`);

  const entrySummary = await seedEntriesAndStartingLists();
  console.log(`✓ Entries/starting lists ensured. entryInsertsAttempted=${entrySummary.createdEntries}, startingListInsertsAttempted=${entrySummary.createdStartingListEntries}`);

  console.log("✅ Division seed complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
