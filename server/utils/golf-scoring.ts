import type { RoundScoreStatus } from "#shared/schemas/golf-scores";

export type GolfScoringPlayerInput = {
  eventEntryId: string;
  playerId: string;
  playerName: string;
  country: string | null;
  playerNumber: number | null;
  majorDivision: string;
  minorDivisionTags: string[];
  playoffRank: number | null;
};

export type GolfRoundScoreInput = {
  eventEntryId: string;
  roundNumber: number;
  rawScore: number | null;
  status: string;
};

export type GolfStandingRoundCell = {
  roundNumber: number;
  strokes: number | null;
  status: RoundScoreStatus;
  par: number | null;
  relativeToPar: number | null;
};

export type GolfStandingRow = {
  eventEntryId: string;
  playerId: string;
  playerName: string;
  country: string | null;
  playerNumber: number | null;
  majorDivision: string;
  minorDivisionTags: string[];
  playoffRank: number | null;
  rounds: GolfStandingRoundCell[];
  completedRounds: number;
  totalStrokes: number | null;
  relativeToPar: number | null;
  overallStatus: RoundScoreStatus | "pending";
  rank: number | null;
  isTied: boolean;
  resolvedByPlayoff: boolean;
};

export type GolfPodiumTieGroup = {
  division: string;
  baseRank: number;
  totalStrokes: number;
  players: Array<{
    eventEntryId: string;
    playerName: string;
    playoffRank: number | null;
  }>;
};

function normalizeStatus(raw: string | null | undefined): RoundScoreStatus {
  if (raw === "DNS" || raw === "DNF" || raw === "SCR") {
    return raw;
  }
  return "ok";
}

function compareStandingRows(left: GolfStandingRow, right: GolfStandingRow): number {
  const leftScored = left.overallStatus === "ok" && left.completedRounds > 0 && left.totalStrokes != null;
  const rightScored = right.overallStatus === "ok" && right.completedRounds > 0 && right.totalStrokes != null;

  if (leftScored && !rightScored) {
    return -1;
  }
  if (!leftScored && rightScored) {
    return 1;
  }

  if (leftScored && rightScored) {
    // Players with more completed rounds (e.g., cut finalists) rank ahead of eliminated players
    if (left.completedRounds !== right.completedRounds) {
      return right.completedRounds - left.completedRounds;
    }

    // Lower total strokes is better (LOWER_IS_BETTER)
    if (left.totalStrokes! !== right.totalStrokes!) {
      return left.totalStrokes! - right.totalStrokes!;
    }

    // Playoff tie-breaker for podium ties
    if (left.playoffRank != null && right.playoffRank != null && left.playoffRank !== right.playoffRank) {
      return left.playoffRank - right.playoffRank;
    }
    if (left.playoffRank != null && right.playoffRank == null) {
      return -1;
    }
    if (left.playoffRank == null && right.playoffRank != null) {
      return 1;
    }
  }

  // Non-scored status ordering: DNF -> SCR -> DNS -> pending
  const statusWeight: Record<string, number> = {
    ok: 0,
    DNF: 1,
    SCR: 2,
    DNS: 3,
    pending: 4,
  };
  const weightDiff = (statusWeight[left.overallStatus] ?? 4) - (statusWeight[right.overallStatus] ?? 4);
  if (weightDiff !== 0) {
    return weightDiff;
  }

  return left.playerName.localeCompare(right.playerName);
}

export function computeGolfStandings(
  players: GolfScoringPlayerInput[],
  scores: GolfRoundScoreInput[],
  roundPars: Array<number | null>,
  totalRounds: number,
): { standings: GolfStandingRow[]; podiumTies: GolfPodiumTieGroup[] } {
  const roundsCount = Math.max(1, totalRounds, roundPars.length);
  const scoresByEntry = new Map<string, Map<number, GolfRoundScoreInput>>();

  for (const s of scores) {
    let map = scoresByEntry.get(s.eventEntryId);
    if (!map) {
      map = new Map();
      scoresByEntry.set(s.eventEntryId, map);
    }
    map.set(s.roundNumber, s);
  }

  const rows: GolfStandingRow[] = players.map((p) => {
    const entryScores = scoresByEntry.get(p.eventEntryId);
    const roundCells: GolfStandingRoundCell[] = [];
    let completedRounds = 0;
    let totalStrokesSum = 0;
    let totalParSum = 0;
    let allCompletedHavePar = true;
    let hasScr = false;
    let hasDnf = false;
    let hasDns = false;

    for (let r = 1; r <= roundsCount; r++) {
      const cell = entryScores?.get(r);
      const par = typeof roundPars[r - 1] === "number" ? roundPars[r - 1]! : null;
      const status = cell ? normalizeStatus(cell.status) : "ok";
      const strokes = cell && status === "ok" && typeof cell.rawScore === "number"
        ? Math.round(cell.rawScore)
        : null;

      if (status === "SCR") {
        hasScr = true;
      }
      else if (status === "DNF") {
        hasDnf = true;
      }
      else if (status === "DNS") {
        hasDns = true;
      }

      if (strokes != null) {
        completedRounds += 1;
        totalStrokesSum += strokes;
        if (par != null) {
          totalParSum += par;
        }
        else {
          allCompletedHavePar = false;
        }
      }

      roundCells.push({
        roundNumber: r,
        strokes,
        status,
        par,
        relativeToPar: strokes != null && par != null ? strokes - par : null,
      });
    }

    let overallStatus: RoundScoreStatus | "pending" = "pending";
    if (hasScr) {
      overallStatus = "SCR";
    }
    else if (hasDnf) {
      overallStatus = "DNF";
    }
    else if (completedRounds > 0) {
      overallStatus = "ok";
    }
    else if (hasDns) {
      overallStatus = "DNS";
    }

    return {
      eventEntryId: p.eventEntryId,
      playerId: p.playerId,
      playerName: p.playerName,
      country: p.country,
      playerNumber: p.playerNumber,
      majorDivision: p.majorDivision,
      minorDivisionTags: p.minorDivisionTags,
      playoffRank: p.playoffRank,
      rounds: roundCells,
      completedRounds,
      totalStrokes: completedRounds > 0 ? totalStrokesSum : null,
      relativeToPar: completedRounds > 0 && allCompletedHavePar ? totalStrokesSum - totalParSum : null,
      overallStatus,
      rank: null,
      isTied: false,
      resolvedByPlayoff: false,
    };
  });

  // Rank within each major division
  const byDivision = new Map<string, GolfStandingRow[]>();
  for (const row of rows) {
    const list = byDivision.get(row.majorDivision) ?? [];
    list.push(row);
    byDivision.set(row.majorDivision, list);
  }

  const podiumTies: GolfPodiumTieGroup[] = [];
  const rankedRows: GolfStandingRow[] = [];

  for (const [division, divRows] of [...byDivision.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    divRows.sort(compareStandingRows);

    // Track groups with identical (completedRounds, totalStrokes)
    const tieGroups = new Map<string, GolfStandingRow[]>();
    for (const row of divRows) {
      if (row.overallStatus === "ok" && row.completedRounds > 0 && row.totalStrokes != null) {
        const key = `${row.completedRounds}:${row.totalStrokes}`;
        const list = tieGroups.get(key) ?? [];
        list.push(row);
        tieGroups.set(key, list);
      }
    }

    let currentRank = 0;
    for (let i = 0; i < divRows.length; i++) {
      const row = divRows[i]!;
      const isScored = row.overallStatus === "ok" && row.completedRounds > 0 && row.totalStrokes != null;
      if (!isScored) {
        row.rank = null;
        row.isTied = false;
        continue;
      }

      const prev = i > 0 ? divRows[i - 1] : null;
      const sameScoreAsPrev = prev != null
        && prev.overallStatus === "ok"
        && prev.completedRounds === row.completedRounds
        && prev.totalStrokes === row.totalStrokes;

      const brokenByPlayoff = sameScoreAsPrev
        && (prev.playoffRank != null || row.playoffRank != null)
        && prev.playoffRank !== row.playoffRank;

      if (sameScoreAsPrev && !brokenByPlayoff) {
        row.rank = prev.rank;
        row.isTied = true;
        prev.isTied = true;
      }
      else {
        currentRank = i + 1;
        row.rank = currentRank;
        if (brokenByPlayoff) {
          row.resolvedByPlayoff = true;
          prev.resolvedByPlayoff = true;
        }
      }
    }

    // Collect podium tie groups (2+ players sharing same score at base rank <= 3)
    for (const group of tieGroups.values()) {
      if (group.length < 2) {
        continue;
      }
      const baseRank = Math.min(...group.map(item => item.rank ?? 999));
      if (baseRank <= 3) {
        podiumTies.push({
          division,
          baseRank,
          totalStrokes: group[0]!.totalStrokes!,
          players: group.map(item => ({
            eventEntryId: item.eventEntryId,
            playerName: item.playerName,
            playoffRank: item.playoffRank,
          })),
        });
      }
    }

    rankedRows.push(...divRows);
  }

  return { standings: rankedRows, podiumTies };
}
