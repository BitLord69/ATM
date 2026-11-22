import { and, eq } from "drizzle-orm";

import { disciplineSettingsPatchSchema } from "#shared/schemas/discipline-settings";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { tournament, tournamentMembership } from "../../../../../lib/db/schema";
import { hasTournamentRole } from "../../../../utils/authorization";

const disciplineConfig = {
  golf: {
    roundsKey: "golfRounds",
    cumulativeKey: "golfCumulativeRounds",
  },
  accuracy: {
    roundsKey: "accuracyRounds",
    cumulativeKey: "accuracyCumulativeRounds",
  },
  distance: {
    roundsKey: "distanceRounds",
    cumulativeKey: "distanceCumulativeRounds",
  },
  scf: {
    roundsKey: "scfRounds",
    cumulativeKey: "scfCumulativeRounds",
  },
  discathon: {
    roundsKey: "discathonRounds",
    cumulativeKey: "discathonCumulativeRounds",
  },
  ddc: {
    roundsKey: "ddcRounds",
    cumulativeKey: "ddcCumulativeRounds",
  },
  freestyle: {
    roundsKey: "freestyleRounds",
    cumulativeKey: "freestyleCumulativeRounds",
  },
} as const;

type DisciplineKey = keyof typeof disciplineConfig;

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  const disciplineParam = String(getRouterParam(event, "discipline") || "").toLowerCase() as DisciplineKey;

  if (!slug) {
    throw createError({ statusCode: 400, message: "Tournament slug is required" });
  }

  const config = disciplineConfig[disciplineParam];
  if (!config) {
    throw createError({ statusCode: 400, message: "Unsupported discipline" });
  }

  const parsed = disciplineSettingsPatchSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message || "Invalid settings" });
  }

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const rows = await db
    .select({ id: tournament.id, closedAt: tournament.closedAt })
    .from(tournament)
    .where(eq(tournament.slug, slug))
    .limit(1);

  const found = rows[0];
  if (!found) {
    throw createError({ statusCode: 404, message: "Tournament not found" });
  }

  if (found.closedAt && session.user.role !== "admin") {
    throw createError({ statusCode: 403, message: "Closed tournaments can only be edited by sysadmin" });
  }

  const membershipRows = await db
    .select({ role: tournamentMembership.role, status: tournamentMembership.status })
    .from(tournamentMembership)
    .where(
      and(
        eq(tournamentMembership.tournamentId, found.id),
        eq(tournamentMembership.userId, session.user.id),
      ),
    )
    .limit(1);

  const membership = membershipRows[0];
  if (!hasTournamentRole(session.user.role, membership, "td")) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const changedBy = session.user.id;
  const updatePayload: Record<string, unknown> = {
    [config.roundsKey]: parsed.data.rounds,
    [config.cumulativeKey]: parsed.data.cumulativeRounds,
    changedBy,
    changedAt: Date.now(),
  };

  if (disciplineParam === "golf") {
    if (parsed.data.poolMode !== undefined) {
      updatePayload.golfPoolMode = parsed.data.poolMode;
    }
    if (parsed.data.poolCount !== undefined) {
      updatePayload.golfPoolCount = parsed.data.poolCount;
    }
    if (parsed.data.golfStartEnabled !== undefined) {
      updatePayload.golfStartEnabled = parsed.data.golfStartEnabled;
    }
    if (parsed.data.roundPars !== undefined) {
      const trimmedPars = parsed.data.rounds
        ? parsed.data.roundPars.slice(0, parsed.data.rounds)
        : [];
      updatePayload.golfRoundPars = JSON.stringify(trimmedPars);
    }
    if (parsed.data.roundLayouts !== undefined) {
      const trimmedLayouts = parsed.data.rounds
        ? parsed.data.roundLayouts.slice(0, parsed.data.rounds)
        : [];
      updatePayload.golfRoundLayouts = JSON.stringify(trimmedLayouts);
    }
  }

  await db
    .update(tournament)
    .set(updatePayload as any)
    .where(eq(tournament.id, found.id));

  return { success: true };
});
