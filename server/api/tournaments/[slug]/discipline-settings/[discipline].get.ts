import { and, asc, eq, inArray } from "drizzle-orm";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { tournament, tournamentMembership, tournamentVenue, venue, venueCourseLayout } from "../../../../../lib/db/schema";
import { hasTournamentRole } from "../../../../utils/authorization";

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

function parseRoundPars(raw: string | null | undefined, rounds: number | null): Array<number | null> {
  let parsed: unknown = [];
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    }
    catch {
      parsed = [];
    }
  }

  const arr = Array.isArray(parsed)
    ? parsed.map(item => (typeof item === "number" && Number.isInteger(item) ? item : null))
    : [];

  if (!rounds || rounds <= 0) {
    return arr;
  }

  return Array.from({ length: rounds }, (_, idx) => arr[idx] ?? null);
}

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
      golfPoolMode: tournament.golfPoolMode,
      golfPoolCount: tournament.golfPoolCount,
      golfStartEnabled: tournament.golfStartEnabled,
      golfRoundPars: tournament.golfRoundPars,
      golfRoundLayouts: tournament.golfRoundLayouts,
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
  if (!hasTournamentRole(session.user.role, membership, "td")) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const rounds = (found as any)[config.roundsKey] as number | null;
  const cumulativeRounds = (found as any)[config.cumulativeKey] as number | null;

  if (disciplineParam === "golf") {
    let parsedRoundLayouts: Array<{ venueId?: number | null; venueName?: string | null; layoutId?: string | null; layoutName?: string | null } | null> = [];
    if (found.golfRoundLayouts) {
      try {
        const raw = JSON.parse(found.golfRoundLayouts);
        if (Array.isArray(raw)) {
          parsedRoundLayouts = raw;
        }
      }
      catch {
        parsedRoundLayouts = [];
      }
    }

    const golfVenueRows = await db
      .select({
        id: venue.id,
        name: venue.name,
      })
      .from(tournamentVenue)
      .innerJoin(venue, eq(venue.id, tournamentVenue.venueId))
      .where(and(eq(tournamentVenue.tournamentId, found.id), eq(tournamentVenue.hasGolf, true)))
      .orderBy(asc(venue.name));

    const golfVenueIds = golfVenueRows.map(v => v.id);
    const layoutRows = golfVenueIds.length > 0
      ? await db
          .select({
            id: venueCourseLayout.id,
            venueId: venueCourseLayout.venueId,
            name: venueCourseLayout.name,
            par: venueCourseLayout.par,
            holeCount: venueCourseLayout.holeCount,
          })
          .from(venueCourseLayout)
          .where(inArray(venueCourseLayout.venueId, golfVenueIds))
          .orderBy(asc(venueCourseLayout.sortOrder), asc(venueCourseLayout.name))
      : [];

    const layoutsByVenueId = new Map<number, Array<{ id: string; name: string; par: number; holeCount: number | null }>>();
    for (const l of layoutRows) {
      const list = layoutsByVenueId.get(l.venueId) ?? [];
      list.push({ id: l.id, name: l.name, par: l.par, holeCount: l.holeCount });
      layoutsByVenueId.set(l.venueId, list);
    }

    return {
      discipline: disciplineParam,
      label: config.label,
      isEnabled: !!found.hasGolf,
      rounds,
      cumulativeRounds,
      poolMode: found.golfPoolMode === "dynamic" ? "dynamic" : "static",
      poolCount: typeof found.golfPoolCount === "number" && found.golfPoolCount >= 1 ? found.golfPoolCount : 1,
      golfStartEnabled: !!found.golfStartEnabled,
      roundPars: parseRoundPars(found.golfRoundPars, rounds),
      roundLayouts: rounds && rounds > 0
        ? Array.from({ length: rounds }, (_, idx) => parsedRoundLayouts[idx] ?? null)
        : parsedRoundLayouts,
      golfVenues: golfVenueRows.map(v => ({
        id: v.id,
        name: v.name,
        courseLayouts: layoutsByVenueId.get(v.id) ?? [],
      })),
    };
  }

  return {
    discipline: disciplineParam,
    label: config.label,
    isEnabled: !!(found as any)[config.enabledKey],
    rounds,
    cumulativeRounds,
  };
});
