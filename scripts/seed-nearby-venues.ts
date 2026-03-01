import "dotenv/config";

import db from "~lib/db";
import { tournament, user, venue } from "~lib/db/schema";

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

function buildDisciplineFlags(source: TournamentRow, profileIndex: number) {
  const activeKeys = [
    "hasGolf",
    "hasAccuracy",
    "hasDistance",
    "hasSCF",
    "hasDiscathon",
    "hasDDC",
    "hasFreestyle",
  ] as const;

  const enabled = activeKeys.filter(key => !!source[key]);
  const subset = profileIndex % 2 === 0 ? enabled : enabled.slice(0, Math.max(1, Math.min(2, enabled.length)));

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
    .select({ name: venue.name })
    .from(venue);

  const existingNames = new Set(existingVenueRows.map(row => row.name));

  let insertedCount = 0;
  let skippedCount = 0;
  let skippedTournamentCount = 0;

  for (const t of tournaments as TournamentRow[]) {
    if (!hasValidCoordinates(t.lat, t.long)) {
      skippedTournamentCount += 1;
      console.log(`Skipped ${t.slug}: missing/invalid coordinates`);
      continue;
    }

    for (const [index, profile] of DISTANCE_PROFILES.entries()) {
      const name = buildVenueName(t.slug, profile);

      if (existingNames.has(name)) {
        skippedCount += 1;
        continue;
      }

      const [lat, long] = offsetCoordinates(t.lat, t.long, profile.km, profile.bearingDeg);
      const flags = buildDisciplineFlags(t, index);
      const now = Date.now();

      await db.insert(venue).values({
        name,
        description: `Seeded reusable venue ${profile.km} km from ${t.name}.`,
        facilities: `Seeded proximity test venue (${profile.label}).`,
        lat,
        long,
        ...flags,
        changedBy,
        createdAt: now,
        changedAt: now,
      });

      existingNames.add(name);
      insertedCount += 1;
    }
  }

  console.log(`Seeded nearby venues complete.`);
  console.log(`Inserted: ${insertedCount}`);
  console.log(`Skipped existing: ${skippedCount}`);
  console.log(`Skipped tournaments without coordinates: ${skippedTournamentCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
