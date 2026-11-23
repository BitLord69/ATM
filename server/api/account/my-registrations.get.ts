import { and, eq } from "drizzle-orm";

import { auth } from "../../../lib/auth";
import db from "../../../lib/db";
import { eventEntry, player, tournament, tournamentPlayerNumber } from "../../../lib/db/schema";
import { getTournamentStatus } from "../../utils/authorization";

export type MyRegistrationTournamentItem = {
  tournamentId: number;
  tournamentName: string;
  tournamentSlug: string;
  city: string | null;
  country: string | null;
  startDate: number | null;
  endDate: number | null;
  tournamentStatus: "active" | "future" | "past";
  isActive: boolean;
  majorDivision: string;
  minorDivisionTags: string[];
  disciplines: string[];
  playerNumber: number | null;
};

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  }
  catch {
    return [];
  }
}

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const playerRows = await db
    .select({ id: player.id })
    .from(player)
    .where(eq(player.userId, session.user.id))
    .limit(1);

  const playerRow = playerRows[0];
  if (!playerRow) {
    return { registrations: [] as MyRegistrationTournamentItem[] };
  }

  const [entryRows, numberRows] = await Promise.all([
    db
      .select({
        tournamentId: eventEntry.tournamentId,
        discipline: eventEntry.discipline,
        majorDivision: eventEntry.majorDivision,
        minorDivisionTags: eventEntry.minorDivisionTags,
        tournamentName: tournament.name,
        tournamentSlug: tournament.slug,
        city: tournament.city,
        country: tournament.country,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
      })
      .from(eventEntry)
      .innerJoin(tournament, eq(eventEntry.tournamentId, tournament.id))
      .where(and(eq(eventEntry.playerId, playerRow.id), eq(eventEntry.status, "registered"))),
    db
      .select({
        tournamentId: tournamentPlayerNumber.tournamentId,
        playerNumber: tournamentPlayerNumber.playerNumber,
      })
      .from(tournamentPlayerNumber)
      .where(eq(tournamentPlayerNumber.playerId, playerRow.id)),
  ]);

  const numberByTournamentId = new Map<number, number>(
    numberRows.map(r => [r.tournamentId, r.playerNumber]),
  );

  const grouped = new Map<number, MyRegistrationTournamentItem>();

  for (const row of entryRows) {
    const existing = grouped.get(row.tournamentId);
    if (existing) {
      if (!existing.disciplines.includes(row.discipline)) {
        existing.disciplines.push(row.discipline);
      }
      continue;
    }

    const tournamentStatus = getTournamentStatus(row.startDate, row.endDate);
    grouped.set(row.tournamentId, {
      tournamentId: row.tournamentId,
      tournamentName: row.tournamentName,
      tournamentSlug: row.tournamentSlug,
      city: row.city,
      country: row.country,
      startDate: row.startDate,
      endDate: row.endDate,
      tournamentStatus,
      isActive: tournamentStatus === "active",
      majorDivision: row.majorDivision,
      minorDivisionTags: parseTags(row.minorDivisionTags),
      disciplines: [row.discipline],
      playerNumber: numberByTournamentId.get(row.tournamentId) ?? null,
    });
  }

  const statusOrder: Record<"active" | "future" | "past", number> = {
    active: 0,
    future: 1,
    past: 2,
  };

  const registrations = Array.from(grouped.values()).sort((a, b) => {
    const statusDiff = statusOrder[a.tournamentStatus] - statusOrder[b.tournamentStatus];
    if (statusDiff !== 0) {
      return statusDiff;
    }
    const aStart = a.startDate ?? 0;
    const bStart = b.startDate ?? 0;
    return a.tournamentStatus === "past" ? bStart - aStart : aStart - bStart;
  });

  return { registrations };
});
