export type StartingListBuildInput = {
  eventEntryId: string;
  tournamentId: number;
  discipline: string;
  activeCompetitiveDivision: string;
  sortValue?: number | string | null;
};

export type StartingListBuildRow = {
  eventEntryId: string;
  tournamentId: number;
  discipline: string;
  roundNumber: number;
  position: number;
  activeCompetitiveDivisionSnapshot: string;
};

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
    activeCompetitiveDivisionSnapshot: item.activeCompetitiveDivision,
  }));
}

export function resequencePositions(eventEntryIdsInOrder: string[]) {
  return eventEntryIdsInOrder.map((eventEntryId, index) => ({
    eventEntryId,
    position: index + 1,
  }));
}
