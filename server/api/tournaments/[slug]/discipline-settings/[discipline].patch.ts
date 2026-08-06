import { and, eq } from "drizzle-orm";

import { disciplineSettingsPatchSchema } from "#shared/schemas/discipline-settings";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { tournament, tournamentMembership } from "../../../../../lib/db/schema";

function canEditTournament(globalRole: string | undefined, membership: { role: string; status: string } | undefined) {
  if (globalRole === "admin") {
    return true;
  }
  if (!membership || membership.status !== "active") {
    return false;
  }
  return ["owner", "admin", "td"].includes(membership.role);
}

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
  if (!canEditTournament(session.user.role, membership)) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const changedBy = session.user.id as any;
  await db
    .update(tournament)
    .set({
      [config.roundsKey]: parsed.data.rounds,
      [config.cumulativeKey]: parsed.data.cumulativeRounds,
      changedBy,
      changedAt: Date.now(),
    } as any)
    .where(eq(tournament.id, found.id));

  return { success: true };
});
