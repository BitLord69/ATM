import "dotenv/config";
import { eq } from "drizzle-orm";

import db from "~lib/db";
import { tournament, tournamentVenue, user, venue } from "~lib/db/schema";

type TournamentRow = {
  id: number;
  slug: string;
  name: string;
  lat: number;
  long: number;
  hasGolf: boolean | null;
  hasAccuracy: boolean | null;
  hasDistance: boolean | null;
  hasSCF: boolean | null;
  hasDiscathon: boolean | null;
  hasDDC: boolean | null;
  hasFreestyle: boolean | null;
};

type DistanceProfile = {
  label: string;
  km: number;
  bearingDeg: number;
};

const DISCIPLINE_KEYS = [
  "hasGolf",
  "hasAccuracy",
  "hasDistance",
  "hasSCF",
  "hasDiscathon",
  "hasDDC",
  "hasFreestyle",
] as const;

type DisciplineKey = (typeof DISCIPLINE_KEYS)[number];
type DisciplineFlags = Record<DisciplineKey, boolean>;

const DISTANCE_PROFILES: DistanceProfile[] = [
  { label: "very-close", km: 8, bearingDeg: 0 },
  { label: "close", km: 35, bearingDeg: 60 },
  { label: "mid", km: 120, bearingDeg: 120 },
  { label: "near-radius-300", km: 260, bearingDeg: 180 },
  { label: "near-radius-500", km: 420, bearingDeg: 240 },
  { label: "near-radius-1000", km: 850, bearingDeg: 300 },
];

function toRad(value: number) {
  return value * (Math.PI / 180);
}

function toDeg(value: number) {
  return value * (180 / Math.PI);
}

function normalizeLongitude(value: number) {
  return ((value + 540) % 360) - 180;
}

function offsetCoordinates(lat: number, lon: number, km: number, bearingDeg: number): [number, number] {
  const earthRadiusKm = 6371;

  const angularDistance = km / earthRadiusKm;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance)
    + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );

  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
  );

  const finalLat = Number(toDeg(lat2).toFixed(6));
  const finalLon = Number(normalizeLongitude(toDeg(lon2)).toFixed(6));
  return [finalLat, finalLon];
}

function hasValidCoordinates(lat: number, lon: number) {
  return Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
}

function buildVenueName(slug: string, profile: DistanceProfile) {
  return `[seed] ${slug} ${profile.label}`;
}

function selectSeedDisciplines(source: TournamentRow): DisciplineKey[] {
  const enabled = DISCIPLINE_KEYS.filter(key => !!source[key]);

  // Seed venues for all enabled disciplines except one.
  if (enabled.length > 1) {
    return enabled.slice(0, -1);
  }

  return enabled;
}

function chooseSubset(seedDisciplines: DisciplineKey[], profileIndex: number) {
  let subset: DisciplineKey[] = [];

  if (seedDisciplines.length === 1) {
    subset = [seedDisciplines[0]];
  }
  else if (seedDisciplines.length > 1 && profileIndex === 0) {
    const splitAt = Math.ceil(seedDisciplines.length / 2);
    subset = seedDisciplines.slice(0, splitAt);
  }
  else if (seedDisciplines.length > 1 && profileIndex === 1) {
    const splitAt = Math.ceil(seedDisciplines.length / 2);
    subset = seedDisciplines.slice(splitAt);
  }
  else if (seedDisciplines.length > 1) {
    subset = seedDisciplines.filter((_, index) => (index + profileIndex) % 2 === 0);
  }

  if (subset.length === 0 && seedDisciplines.length > 0) {
    subset = [seedDisciplines[profileIndex % seedDisciplines.length]];
  }

  return subset;
}

function buildFlagsFromSubset(subset: DisciplineKey[]): DisciplineFlags {
  return {
    hasGolf: subset.includes("hasGolf"),
    hasAccuracy: subset.includes("hasAccuracy"),
    hasDistance: subset.includes("hasDistance"),
    hasSCF: subset.includes("hasSCF"),
    hasDiscathon: subset.includes("hasDiscathon"),
    hasDDC: subset.includes("hasDDC"),
    hasFreestyle: subset.includes("hasFreestyle"),
  };
}

function buildDisciplineFlags(seedDisciplines: DisciplineKey[], profileIndex: number) {
  const subset = chooseSubset(seedDisciplines, profileIndex);

  return buildFlagsFromSubset(subset);
}

function buildLinkDisciplineFlags(
  seedDisciplines: DisciplineKey[],
  coveredDisciplines: Set<DisciplineKey>,
  profileIndex: number,
): DisciplineFlags {
  const uncovered = seedDisciplines.filter(key => !coveredDisciplines.has(key));

  if (uncovered.length > 0) {
    const subset = chooseSubset(uncovered, profileIndex);
    return buildFlagsFromSubset(subset);
  }

  return {
    ...buildDisciplineFlags(seedDisciplines, profileIndex),
  };
}

async function main() {
  const changedByUser = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .orderBy(user.createdAt)
    .limit(1);

  if (!changedByUser[0]) {
    throw new Error("No user found. Create at least one user before seeding nearby venues.");
  }

  const changedBy = changedByUser[0].id as any;

  const tournaments = await db
    .select({
      id: tournament.id,
      slug: tournament.slug,
      name: tournament.name,
      lat: tournament.lat,
      long: tournament.long,
      hasGolf: tournament.hasGolf,
      hasAccuracy: tournament.hasAccuracy,
      hasDistance: tournament.hasDistance,
      hasSCF: tournament.hasSCF,
      hasDiscathon: tournament.hasDiscathon,
      hasDDC: tournament.hasDDC,
      hasFreestyle: tournament.hasFreestyle,
    })
    .from(tournament);

  if (tournaments.length === 0) {
    console.log("No tournaments found. Nothing to seed.");
    return;
  }

  const existingVenueRows = await db
    .select({ id: venue.id, name: venue.name })
    .from(venue);

  const existingVenueByName = new Map(existingVenueRows.map(row => [row.name, row.id]));

  let createdVenueCount = 0;
  let createdLinkCount = 0;
  let skippedExistingVenueCount = 0;
  let skippedExistingLinkCount = 0;
  let skippedTournamentCount = 0;
  let toppedUpTournamentCount = 0;

  for (const t of tournaments as TournamentRow[]) {
    if (!hasValidCoordinates(t.lat, t.long)) {
      skippedTournamentCount += 1;
      console.log(`Skipped ${t.slug}: missing/invalid coordinates`);
      continue;
    }

    const seedDisciplines = selectSeedDisciplines(t);
    const omittedDisciplines = DISCIPLINE_KEYS.filter(key => !!t[key] && !seedDisciplines.includes(key));

    const existingLinks = await db
      .select({
        venueId: tournamentVenue.venueId,
        hasGolf: tournamentVenue.hasGolf,
        hasAccuracy: tournamentVenue.hasAccuracy,
        hasDistance: tournamentVenue.hasDistance,
        hasSCF: tournamentVenue.hasSCF,
        hasDiscathon: tournamentVenue.hasDiscathon,
        hasDDC: tournamentVenue.hasDDC,
        hasFreestyle: tournamentVenue.hasFreestyle,
      })
      .from(tournamentVenue)
      .where(eq(tournamentVenue.tournamentId, t.id));

    const linkedVenueIds = new Set(existingLinks.map(link => link.venueId));
    const coveredDisciplines = new Set<DisciplineKey>();
    for (const link of existingLinks) {
      for (const key of DISCIPLINE_KEYS) {
        if (link[key]) {
          coveredDisciplines.add(key);
        }
      }
    }

    const initialLinkedCount = linkedVenueIds.size;

    for (const [index, profile] of DISTANCE_PROFILES.entries()) {
      if (linkedVenueIds.size >= 2) {
        break;
      }

      const name = buildVenueName(t.slug, profile);
      let venueId = existingVenueByName.get(name);

      if (venueId == null) {
        const [lat, long] = offsetCoordinates(t.lat, t.long, profile.km, profile.bearingDeg);
        const flags = buildDisciplineFlags(seedDisciplines, index);
        const now = Date.now();

        const [createdVenue] = await db.insert(venue).values({
          name,
          description: `Seeded reusable venue ${profile.km} km from ${t.name}.`,
          facilities: `Seeded proximity test venue (${profile.label}).`,
          lat,
          long,
          ...flags,
          changedBy,
          createdAt: now,
          changedAt: now,
        }).returning({ id: venue.id });

        venueId = createdVenue.id;
        existingVenueByName.set(name, venueId);
        createdVenueCount += 1;
      }
      else {
        skippedExistingVenueCount += 1;
      }

      if (linkedVenueIds.has(venueId)) {
        skippedExistingLinkCount += 1;
        continue;
      }

      const now = Date.now();
      const linkFlags = buildLinkDisciplineFlags(seedDisciplines, coveredDisciplines, index);

      await db.insert(tournamentVenue).values({
        tournamentId: t.id,
        venueId,
        ...linkFlags,
        changedBy,
        createdAt: now,
        changedAt: now,
      });

      for (const key of DISCIPLINE_KEYS) {
        if (linkFlags[key]) {
          coveredDisciplines.add(key);
        }
      }

      linkedVenueIds.add(venueId);
      createdLinkCount += 1;
    }

    if (linkedVenueIds.size > initialLinkedCount) {
      toppedUpTournamentCount += 1;
    }

    if (linkedVenueIds.size < 2) {
      console.log(`Warning: ${t.slug} still has ${linkedVenueIds.size} linked venue(s).`);
    }

    if (omittedDisciplines.length > 0) {
      console.log(`Seeded ${t.slug} without: ${omittedDisciplines.join(", ")}`);
    }
  }

  console.log(`Seeded nearby venues complete.`);
  console.log(`Created venues: ${createdVenueCount}`);
  console.log(`Created tournament links: ${createdLinkCount}`);
  console.log(`Skipped existing venues: ${skippedExistingVenueCount}`);
  console.log(`Skipped existing links: ${skippedExistingLinkCount}`);
  console.log(`Tournaments topped up to >= 2 venues: ${toppedUpTournamentCount}`);
  console.log(`Skipped tournaments without coordinates: ${skippedTournamentCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
