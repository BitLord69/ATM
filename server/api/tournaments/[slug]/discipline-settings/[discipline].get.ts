import { and, eq } from "drizzle-orm";

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
    label: "Disc golf",
    enabledKey: "hasGolf",
    roundsKey: "golfRounds",
    cumulativeKey: "golfCumulativeRounds",
  },
  accuracy: {
    label: "Accuracy",
    enabledKey: "hasAccuracy",
    roundsKey: "accuracyRounds",
    cumulativeKey: "accuracyCumulativeRounds",
  },
  distance: {
    label: "Distance",
    enabledKey: "hasDistance",
    roundsKey: "distanceRounds",
    cumulativeKey: "distanceCumulativeRounds",
  },
  scf: {
    label: "SCF",
    enabledKey: "hasSCF",
    roundsKey: "scfRounds",
    cumulativeKey: "scfCumulativeRounds",
  },
  discathon: {
    label: "Discathon",
    enabledKey: "hasDiscathon",
    roundsKey: "discathonRounds",
    cumulativeKey: "discathonCumulativeRounds",
  },
  ddc: {
    label: "DDC",
    enabledKey: "hasDDC",
    roundsKey: "ddcRounds",
    cumulativeKey: "ddcCumulativeRounds",
  },
  freestyle: {
    label: "Freestyle",
    enabledKey: "hasFreestyle",
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

  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const rows = await db
    .select({
      id: tournament.id,
      closedAt: tournament.closedAt,
      hasGolf: tournament.hasGolf,
      hasAccuracy: tournament.hasAccuracy,
      hasDistance: tournament.hasDistance,
      hasSCF: tournament.hasSCF,
      hasDiscathon: tournament.hasDiscathon,
      hasDDC: tournament.hasDDC,
      hasFreestyle: tournament.hasFreestyle,
      golfRounds: tournament.golfRounds,
      golfCumulativeRounds: tournament.golfCumulativeRounds,
      accuracyRounds: tournament.accuracyRounds,
      accuracyCumulativeRounds: tournament.accuracyCumulativeRounds,
      distanceRounds: tournament.distanceRounds,
      distanceCumulativeRounds: tournament.distanceCumulativeRounds,
      scfRounds: tournament.scfRounds,
      scfCumulativeRounds: tournament.scfCumulativeRounds,
      discathonRounds: tournament.discathonRounds,
      discathonCumulativeRounds: tournament.discathonCumulativeRounds,
      ddcRounds: tournament.ddcRounds,
      ddcCumulativeRounds: tournament.ddcCumulativeRounds,
      freestyleRounds: tournament.freestyleRounds,
      freestyleCumulativeRounds: tournament.freestyleCumulativeRounds,
    })
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

  return {
    discipline: disciplineParam,
    label: config.label,
    isEnabled: !!(found as any)[config.enabledKey],
    rounds: (found as any)[config.roundsKey] as number | null,
    cumulativeRounds: (found as any)[config.cumulativeKey] as number | null,
  };
});
