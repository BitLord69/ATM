import { and, gte, sql } from "drizzle-orm";

import db from "../../../lib/db";
import { tournament } from "../../../lib/db/schema";
import { getTournamentStatus } from "../../utils/authorization.ts";

/**
 * Public API endpoint - returns upcoming and active tournaments
 * Accessible to all users including guests
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const filter = (query.filter as string) || "upcoming"; // 'upcoming', 'active', 'finished', 'all'

  // Base query - only fetch tournaments that are not in the past
  const now = Date.now();

  let tournaments;

  if (filter === "all") {
    // Return all tournaments (sorted by start date descending)
    tournaments = await db
      .select({
        id: tournament.id,
        name: tournament.name,
        slug: tournament.slug,
        description: tournament.description,
        country: tournament.country,
        city: tournament.city,
        contactName: tournament.contactName,
        contactEmail: tournament.contactEmail,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        hasGolf: tournament.hasGolf,
        hasAccuracy: tournament.hasAccuracy,
        hasDistance: tournament.hasDistance,
        hasSCF: tournament.hasSCF,
        hasDiscathon: tournament.hasDiscathon,
        hasDDC: tournament.hasDDC,
        hasFreestyle: tournament.hasFreestyle,
      })
      .from(tournament)
      .orderBy(sql`${tournament.startDate} DESC`);
  }
  else if (filter === "active") {
    // Only tournaments currently in progress
    tournaments = await db
      .select({
        id: tournament.id,
        name: tournament.name,
        slug: tournament.slug,
        description: tournament.description,
        country: tournament.country,
        city: tournament.city,
        contactName: tournament.contactName,
        contactEmail: tournament.contactEmail,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        hasGolf: tournament.hasGolf,
        hasAccuracy: tournament.hasAccuracy,
        hasDistance: tournament.hasDistance,
        hasSCF: tournament.hasSCF,
        hasDiscathon: tournament.hasDiscathon,
        hasDDC: tournament.hasDDC,
        hasFreestyle: tournament.hasFreestyle,
      })
      .from(tournament)
      .where(
        and(
          gte(tournament.endDate, now),
          sql`${tournament.startDate} <= ${now}`,
        ),
      )
      .orderBy(tournament.startDate);
  }
  else if (filter === "finished") {
    // Only finished tournaments (end date in the past)
    tournaments = await db
      .select({
        id: tournament.id,
        name: tournament.name,
        slug: tournament.slug,
        description: tournament.description,
        country: tournament.country,
        city: tournament.city,
        contactName: tournament.contactName,
        contactEmail: tournament.contactEmail,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        hasGolf: tournament.hasGolf,
        hasAccuracy: tournament.hasAccuracy,
        hasDistance: tournament.hasDistance,
        hasSCF: tournament.hasSCF,
        hasDiscathon: tournament.hasDiscathon,
        hasDDC: tournament.hasDDC,
        hasFreestyle: tournament.hasFreestyle,
      })
      .from(tournament)
      .where(sql`${tournament.endDate} < ${now}`)
      .orderBy(sql`${tournament.startDate} DESC`);
  }
  else {
    // Default: upcoming tournaments (active or future)
    tournaments = await db
      .select({
        id: tournament.id,
        name: tournament.name,
        slug: tournament.slug,
        description: tournament.description,
        country: tournament.country,
        city: tournament.city,
        contactName: tournament.contactName,
        contactEmail: tournament.contactEmail,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        hasGolf: tournament.hasGolf,
        hasAccuracy: tournament.hasAccuracy,
        hasDistance: tournament.hasDistance,
        hasSCF: tournament.hasSCF,
        hasDiscathon: tournament.hasDiscathon,
        hasDDC: tournament.hasDDC,
        hasFreestyle: tournament.hasFreestyle,
      })
      .from(tournament)
      .where(gte(tournament.endDate, now))
      .orderBy(tournament.startDate);
  }

  // Enrich with computed status
  const enrichedTournaments = tournaments.map((t) => {
    const tournamentStatus = getTournamentStatus(t.startDate, t.endDate);
    return {
      ...t,
      status: tournamentStatus,
      isActive: tournamentStatus === "active",
    };
  });

  return enrichedTournaments;
});
