import { and, gte, sql } from "drizzle-orm";

import db from "../../../lib/db";
import { tournament } from "../../../lib/db/schema";
import { getTournamentStatus } from "../../utils/authorization.ts";

function shouldRetryWithoutDisciplineColumns(error: unknown) {
  const message = String(error ?? "").toLowerCase();

  return message.includes("has_golf")
    || message.includes("has_accuracy")
    || message.includes("has_distance")
    || message.includes("has_scf")
    || message.includes("has_discathon")
    || message.includes("has_ddc")
    || message.includes("has_freestyle")
    || message.includes("no such column")
    || message.includes("server returned http status 400");
}

/**
 * Public API endpoint - returns upcoming and active tournaments
 * Accessible to all users including guests
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const filter = (query.filter as string) || "upcoming"; // 'upcoming', 'active', 'finished', 'all'

  // Base query - only fetch tournaments that are not in the past
  const now = Date.now();

  const selectBase = {
    id: tournament.id,
    name: tournament.name,
    slug: tournament.slug,
    description: tournament.description,
    country: tournament.country,
    city: tournament.city,
    lat: tournament.lat,
    long: tournament.long,
    contactName: tournament.contactName,
    contactEmail: tournament.contactEmail,
    startDate: tournament.startDate,
    endDate: tournament.endDate,
  };

  const selectWithDisciplines = {
    ...selectBase,
    hasGolf: tournament.hasGolf,
    hasAccuracy: tournament.hasAccuracy,
    hasDistance: tournament.hasDistance,
    hasSCF: tournament.hasSCF,
    hasDiscathon: tournament.hasDiscathon,
    hasDDC: tournament.hasDDC,
    hasFreestyle: tournament.hasFreestyle,
  };

  const selectCore = {
    id: tournament.id,
    name: tournament.name,
    slug: tournament.slug,
    startDate: tournament.startDate,
    endDate: tournament.endDate,
  };

  const whereUpcoming = gte(tournament.endDate, now);
  const whereActive = and(
    gte(tournament.endDate, now),
    sql`${tournament.startDate} <= ${now}`,
  );
  const whereFinished = sql`${tournament.endDate} < ${now}`;

  const fetchTournaments = async (selectMode: "full" | "base" | "core") => {
    const select = selectMode === "full"
      ? selectWithDisciplines
      : selectMode === "base"
        ? selectBase
        : selectCore;

    if (filter === "all") {
      return db
        .select(select)
        .from(tournament)
        .orderBy(sql`${tournament.startDate} DESC`);
    }

    if (filter === "active") {
      return db
        .select(select)
        .from(tournament)
        .where(whereActive)
        .orderBy(tournament.startDate);
    }

    if (filter === "finished") {
      return db
        .select(select)
        .from(tournament)
        .where(whereFinished)
        .orderBy(sql`${tournament.startDate} DESC`);
    }

    return db
      .select(select)
      .from(tournament)
      .where(whereUpcoming)
      .orderBy(tournament.startDate);
  };

  let tournaments: Array<any>;

  try {
    tournaments = await fetchTournaments("full");
  }
  catch (error) {
    if (!shouldRetryWithoutDisciplineColumns(error)) {
      throw error;
    }

    console.warn("Public tournaments query retried with reduced schema due to mismatch.");

    try {
      tournaments = await fetchTournaments("base");
    }
    catch (baseError) {
      if (!shouldRetryWithoutDisciplineColumns(baseError)) {
        throw baseError;
      }

      console.warn("Public tournaments query retried with core fields only due to deeper schema mismatch.");
      tournaments = await fetchTournaments("core");
    }

    tournaments = tournaments.map((row) => {
      const normalized = row as Record<string, unknown>;

      return {
        id: normalized.id,
        name: normalized.name,
        slug: normalized.slug,
        description: normalized.description ?? null,
        country: normalized.country ?? null,
        city: normalized.city ?? null,
        lat: normalized.lat ?? 0,
        long: normalized.long ?? 0,
        contactName: normalized.contactName ?? null,
        contactEmail: normalized.contactEmail ?? null,
        startDate: normalized.startDate ?? null,
        endDate: normalized.endDate ?? null,
        hasGolf: false,
        hasAccuracy: false,
        hasDistance: false,
        hasSCF: false,
        hasDiscathon: false,
        hasDDC: false,
        hasFreestyle: false,
      };
    });
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
