import type { PoolAssignmentMode } from "#shared/schemas/starting-lists";

export type StartingListBuildInput = {
  eventEntryId: string;
  tournamentId: number;
  discipline: string;
  activeCompetitiveDivision: string;
  sortValue?: number | string | null;
  poolName?: string | null;
};

export type StartingListBuildRow = {
  eventEntryId: string;
  tournamentId: number;
  discipline: string;
  roundNumber: number;
  position: number;
  poolName: string | null;
  activeCompetitiveDivisionSnapshot: string;
};

export function getPoolLabels(poolCount: number): string[] {
  const clamped = Math.max(1, Math.min(8, Math.floor(poolCount || 1)));
  return Array.from({ length: clamped }, (_, idx) => `Pool ${String.fromCharCode(65 + idx)}`);
}

function compareSortValue(
  left: number | string | null | undefined,
  right: number | string | null | undefined,
) {
  if (left == null && right == null) {
    return 0;
  }
  if (left == null) {
    return 1;
  }
  if (right == null) {
    return -1;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right));
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
}

function assignContiguousPools<T>(items: T[], poolLabels: string[]): Array<{ item: T; poolName: string }> {
  const total = items.length;
  const count = poolLabels.length;
  if (count <= 1) {
    const firstPool = poolLabels[0] ?? "Pool A";
    return items.map(item => ({ item, poolName: firstPool }));
  }

  const baseSize = Math.floor(total / count);
  const remainder = total % count;
  const result: Array<{ item: T; poolName: string }> = [];

  let cursor = 0;
  for (let p = 0; p < count; p++) {
    const size = baseSize + (p < remainder ? 1 : 0);
    const poolName = poolLabels[p] ?? "Pool A";
    for (let k = 0; k < size && cursor < total; k++) {
      result.push({ item: items[cursor]!, poolName });
      cursor++;
    }
  }

  return result;
}

export function buildStartingListEntries(
  inputs: StartingListBuildInput[],
  roundNumber = 1,
): StartingListBuildRow[] {
  const sorted = [...inputs].sort((left, right) => {
    const divisionCompare = left.activeCompetitiveDivision.localeCompare(right.activeCompetitiveDivision);
    if (divisionCompare !== 0) {
      return divisionCompare;
    }

    const sortValueCompare = compareSortValue(left.sortValue, right.sortValue);
    if (sortValueCompare !== 0) {
      return sortValueCompare;
    }

    return left.eventEntryId.localeCompare(right.eventEntryId);
  });

  return sorted.map((item, index) => ({
    eventEntryId: item.eventEntryId,
    tournamentId: item.tournamentId,
    discipline: item.discipline,
    roundNumber,
    position: index + 1,
    poolName: item.poolName ?? null,
    activeCompetitiveDivisionSnapshot: item.activeCompetitiveDivision,
  }));
}

export type GolfPoolGenerationOptions = {
  roundNumber: number;
  poolCount: number;
  poolMode: "static" | "dynamic";
  assignmentMode: PoolAssignmentMode;
  cutSize?: number | null;
  previousRoundEntries?: Array<{
    eventEntryId: string;
    poolName: string | null;
    position: number;
  }>;
};

export function buildGolfStartingListEntries(
  inputs: StartingListBuildInput[],
  options: GolfPoolGenerationOptions,
): StartingListBuildRow[] {
  const poolLabels = getPoolLabels(options.poolCount);
  const baseSorted = [...inputs].sort((left, right) => {
    const divisionCompare = left.activeCompetitiveDivision.localeCompare(right.activeCompetitiveDivision);
    if (divisionCompare !== 0) {
      return divisionCompare;
    }

    const sortValueCompare = compareSortValue(left.sortValue, right.sortValue);
    if (sortValueCompare !== 0) {
      return sortValueCompare;
    }

    return left.eventEntryId.localeCompare(right.eventEntryId);
  });

  // Single-pool tournament: everyone is automatically in Pool A.
  if (poolLabels.length === 1) {
    const singlePool = poolLabels[0] ?? "Pool A";
    const ordered = options.roundNumber === 1 && options.assignmentMode === "random"
      ? shuffleArray(baseSorted)
      : baseSorted;
    const sliced = options.roundNumber > 1 && options.cutSize && options.cutSize > 0
      ? ordered.slice(0, options.cutSize)
      : ordered;

    return sliced.map((item, index) => ({
      eventEntryId: item.eventEntryId,
      tournamentId: item.tournamentId,
      discipline: item.discipline,
      roundNumber: options.roundNumber,
      position: index + 1,
      poolName: singlePool,
      activeCompetitiveDivisionSnapshot: item.activeCompetitiveDivision,
    }));
  }

  // Round 1 multi-pool assignment
  if (options.roundNumber === 1) {
    if (options.assignmentMode === "manual") {
      return baseSorted.map((item, index) => ({
        eventEntryId: item.eventEntryId,
        tournamentId: item.tournamentId,
        discipline: item.discipline,
        roundNumber: 1,
        position: index + 1,
        poolName: null,
        activeCompetitiveDivisionSnapshot: item.activeCompetitiveDivision,
      }));
    }

    const orderedForPools = options.assignmentMode === "random"
      ? shuffleArray(baseSorted)
      : baseSorted;

    const assigned = assignContiguousPools(orderedForPools, poolLabels);
    return assigned.map(({ item, poolName }, index) => ({
      eventEntryId: item.eventEntryId,
      tournamentId: item.tournamentId,
      discipline: item.discipline,
      roundNumber: 1,
      position: index + 1,
      poolName,
      activeCompetitiveDivisionSnapshot: item.activeCompetitiveDivision,
    }));
  }

  // Round 2+ multi-pool assignment
  const prevMap = new Map(
    (options.previousRoundEntries ?? []).map(entry => [entry.eventEntryId, entry]),
  );

  // Order by previous round position when available, then division/sortValue
  const orderedByPrev = [...baseSorted].sort((left, right) => {
    const prevLeft = prevMap.get(left.eventEntryId);
    const prevRight = prevMap.get(right.eventEntryId);
    if (prevLeft && prevRight) {
      return prevLeft.position - prevRight.position;
    }
    if (prevLeft) {
      return -1;
    }
    if (prevRight) {
      return 1;
    }
    return 0;
  });

  const activeField = options.cutSize && options.cutSize > 0
    ? orderedByPrev.slice(0, options.cutSize)
    : orderedByPrev;

  if (options.poolMode === "static") {
    const validPools = new Set(poolLabels);
    return activeField.map((item, index) => {
      const prevPool = prevMap.get(item.eventEntryId)?.poolName ?? null;
      return {
        eventEntryId: item.eventEntryId,
        tournamentId: item.tournamentId,
        discipline: item.discipline,
        roundNumber: options.roundNumber,
        position: index + 1,
        poolName: prevPool && validPools.has(prevPool) ? prevPool : null,
        activeCompetitiveDivisionSnapshot: item.activeCompetitiveDivision,
      };
    });
  }

  // Dynamic pool mode: assign contiguous tiers across Pool A (top) -> Pool B -> ...
  // (Once M1.4 round scores exist, activeField will be pre-sorted by cumulative standings.)
  const assigned = assignContiguousPools(activeField, poolLabels);
  return assigned.map(({ item, poolName }, index) => ({
    eventEntryId: item.eventEntryId,
    tournamentId: item.tournamentId,
    discipline: item.discipline,
    roundNumber: options.roundNumber,
    position: index + 1,
    poolName,
    activeCompetitiveDivisionSnapshot: item.activeCompetitiveDivision,
  }));
}

export function resequencePositions(eventEntryIdsInOrder: string[]) {
  return eventEntryIdsInOrder.map((eventEntryId, index) => ({
    eventEntryId,
    position: index + 1,
  }));
}
