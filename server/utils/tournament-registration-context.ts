import type { BatchItem } from "drizzle-orm/batch";

import type { TournamentDisciplineFlagsLike, TournamentDivisionFlagsLike } from "./division-policy";

import { and, eq, inArray } from "drizzle-orm";

import db from "../../lib/db";
import {
  divisionPolicy,
  eventEntry,
  tournament,
  tournamentDivision,
  tournamentMembership,
  tournamentRegistrationLock,
} from "../../lib/db/schema";
import { getEnabledTournamentDisciplines, mapPolicyFromDb } from "./division-policy";

/**
 * Shared loaders for tournament registration endpoints
 * (entries GET/POST/PATCH, my-registration, public tournament detail).
 */

export const registrationTournamentColumns = {
  id: tournament.id,
  startDate: tournament.startDate,
  closedAt: tournament.closedAt,
  registrationOpenDate: tournament.registrationOpenDate,
  registrationCloseDate: tournament.registrationCloseDate,
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
};

export async function loadRegistrationTournament(slug: string) {
  const rows = await db
    .select(registrationTournamentColumns)
    .from(tournament)
    .where(eq(tournament.slug, slug))
    .limit(1);

  const found = rows[0];
  if (!found) {
    throw createError({ statusCode: 404, message: "Tournament not found" });
  }
  return found;
}

export type RegistrationTournament = Awaited<ReturnType<typeof loadRegistrationTournament>>;

export async function loadTournamentMembership(tournamentId: number, userId: string) {
  const rows = await db
    .select({ role: tournamentMembership.role, status: tournamentMembership.status })
    .from(tournamentMembership)
    .where(
      and(
        eq(tournamentMembership.tournamentId, tournamentId),
        eq(tournamentMembership.userId, userId),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function loadRegistrationLocked(tournamentId: number) {
  const rows = await db
    .select({ isLocked: tournamentRegistrationLock.isLocked })
    .from(tournamentRegistrationLock)
    .where(eq(tournamentRegistrationLock.tournamentId, tournamentId))
    .limit(1);
  return !!rows[0]?.isLocked;
}

export async function loadDivisionPolicyContext(tournamentRow: TournamentDivisionFlagsLike & { id: number }) {
  const [policyRows, offeredRows] = await Promise.all([
    db
      .select({ ageReferenceMode: divisionPolicy.ageReferenceMode })
      .from(divisionPolicy)
      .where(eq(divisionPolicy.tournamentId, tournamentRow.id))
      .limit(1),
    db
      .select({
        code: tournamentDivision.code,
        label: tournamentDivision.label,
        isEnabled: tournamentDivision.isEnabled,
      })
      .from(tournamentDivision)
      .where(eq(tournamentDivision.tournamentId, tournamentRow.id)),
  ]);

  return mapPolicyFromDb(policyRows[0], offeredRows, tournamentRow);
}

export function safeParseMinorTags(raw: string | null | undefined) {
  if (!raw) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  }
  catch {
    return [];
  }
}

export function formatRegistrationClosedMessage(reason: string) {
  switch (reason) {
    case "tournament_closed":
      return "Registration is closed because this tournament has been finalized.";
    case "locked_by_staff":
      return "Registration is currently locked by tournament staff.";
    case "tournament_started":
      return "Registration is closed because the tournament has already started.";
    case "not_yet_open":
      return "Registration has not opened yet for this tournament.";
    case "registration_closed_date":
      return "The registration deadline for this tournament has passed.";
    default:
      return "Registration is currently closed.";
  }
}

/** Normalizes optional profile text input: undefined = keep existing, empty = clear. */
export function resolveProfileText(input: string | null | undefined, existing: string | null) {
  if (input === undefined) {
    return existing;
  }
  return input?.trim() || null;
}

export async function runBatch(statements: BatchItem<"sqlite">[]) {
  const [first, ...rest] = statements;
  if (!first) {
    return;
  }
  await db.batch([first, ...rest]);
}

/** Validates and normalizes a list of requested discipline keys against the tournament's enabled disciplines. */
export function resolveRequestedDisciplines(
  tournamentRow: TournamentDisciplineFlagsLike,
  rawDisciplines: string[],
) {
  const enabledKeys = new Set(getEnabledTournamentDisciplines(tournamentRow).map(d => d.key));
  enabledKeys.add("overall");

  const requested = [...new Set(rawDisciplines.map(d => d.trim().toLowerCase()).filter(Boolean))];

  for (const disc of requested) {
    if (!enabledKeys.has(disc)) {
      throw createError({
        statusCode: 400,
        message: `Discipline '${disc}' is not enabled for this tournament`,
      });
    }
  }

  return requested;
}

type ExistingEntryLike = {
  id: string;
  discipline: string;
  status: string;
};

/**
 * Builds insert/update statements that sync a player's entries for the requested disciplines.
 * When `withdrawUnlisted` is true, active entries not in `disciplines` are marked withdrawn.
 */
export function buildEntrySyncStatements(input: {
  playerId: string;
  tournamentId: number;
  disciplines: string[];
  existingEntries: ExistingEntryLike[];
  majorDivision: string;
  minorDivisionTags: string[];
  primaryMinorDivision: string | null;
  status: "registered" | "withdrawn";
  changedBy: string;
  now: number;
  withdrawUnlisted: boolean;
}) {
  const statements: BatchItem<"sqlite">[] = [];
  const createdEntryIds = new Map<string, string>();
  const existingByDiscipline = new Map(input.existingEntries.map(row => [row.discipline, row]));
  const minorTagsJson = JSON.stringify(input.minorDivisionTags);

  for (const disc of input.disciplines) {
    const existing = existingByDiscipline.get(disc);
    if (existing) {
      statements.push(
        db.update(eventEntry)
          .set({
            majorDivision: input.majorDivision,
            minorDivisionTags: minorTagsJson,
            primaryMinorDivision: input.primaryMinorDivision,
            activeCompetitiveDivision: input.majorDivision,
            status: input.status,
            changedBy: input.changedBy,
            updatedAt: input.now,
          })
          .where(eq(eventEntry.id, existing.id)),
      );
      createdEntryIds.set(disc, existing.id);
    }
    else {
      const entryId = crypto.randomUUID();
      statements.push(
        db.insert(eventEntry).values({
          id: entryId,
          playerId: input.playerId,
          tournamentId: input.tournamentId,
          discipline: disc,
          majorDivision: input.majorDivision,
          minorDivisionTags: minorTagsJson,
          primaryMinorDivision: input.primaryMinorDivision,
          activeCompetitiveDivision: input.majorDivision,
          status: input.status,
          changedBy: input.changedBy,
          createdAt: input.now,
          updatedAt: input.now,
        }),
      );
      createdEntryIds.set(disc, entryId);
    }
  }

  if (input.withdrawUnlisted) {
    const requested = new Set(input.disciplines);
    const toWithdraw = input.existingEntries
      .filter(row => !requested.has(row.discipline) && row.status !== "withdrawn")
      .map(row => row.id);

    if (toWithdraw.length > 0) {
      statements.push(
        db.update(eventEntry)
          .set({ status: "withdrawn", changedBy: input.changedBy, updatedAt: input.now })
          .where(inArray(eventEntry.id, toWithdraw)),
      );
    }
  }

  return { statements, entryIdByDiscipline: createdEntryIds };
}
