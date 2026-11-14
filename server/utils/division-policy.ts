export type AgeReferenceMode = "calendar_year" | "exact_date";

export type DivisionPolicyConfig = {
  ageReferenceMode: AgeReferenceMode;
  ageThresholds: number[];
  juniorMaxAge: number;
  mpoAliases: string[];
  womenDivisionCodes: string[];
};

export const DEFAULT_DIVISION_POLICY: DivisionPolicyConfig = {
  ageReferenceMode: "calendar_year",
  ageThresholds: [40, 50, 55, 60, 65, 70, 75, 80],
  juniorMaxAge: 18,
  mpoAliases: ["MPO", "OPEN"],
  womenDivisionCodes: ["FPO", "WOMEN"],
};

export type DivisionPolicyRowLike = {
  ageReferenceMode?: string | null;
};

export type TournamentDivisionRowLike = {
  code: string;
  label?: string | null;
  isEnabled?: boolean | null;
};

export type TournamentDivisionFlagsLike = {
  divisionOpen?: boolean | null;
  divisionWomen?: boolean | null;
  divisionMaster?: boolean | null;
  divisionGrandMaster?: boolean | null;
  divisionSeniorGrandMaster?: boolean | null;
  divisionLegend?: boolean | null;
  divisionJunior?: boolean | null;
  keepJuniorsSeparate?: boolean | null;
};

export type TournamentRegistrationDatesLike = {
  registrationOpenDate?: number | null;
  registrationCloseDate?: number | null;
  startDate?: number | null;
  closedAt?: number | null;
};

export type TournamentDisciplineFlagsLike = {
  hasGolf?: boolean | null;
  hasAccuracy?: boolean | null;
  hasDistance?: boolean | null;
  hasSCF?: boolean | null;
  hasDiscathon?: boolean | null;
  hasDDC?: boolean | null;
  hasFreestyle?: boolean | null;
};

export type RegistrationStatusReason
  = | "open"
    | "not_yet_open"
    | "registration_closed_date"
    | "locked_by_staff"
    | "tournament_started"
    | "tournament_closed";

export function toUpperTrimmed(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeDivisionPolicy(
  policy?: Partial<DivisionPolicyConfig> | null,
): DivisionPolicyConfig {
  return {
    ageReferenceMode: policy?.ageReferenceMode ?? DEFAULT_DIVISION_POLICY.ageReferenceMode,
    ageThresholds: policy?.ageThresholds?.length
      ? [...new Set(policy.ageThresholds)].sort((left, right) => left - right)
      : [...DEFAULT_DIVISION_POLICY.ageThresholds],
    juniorMaxAge: policy?.juniorMaxAge ?? DEFAULT_DIVISION_POLICY.juniorMaxAge,
    mpoAliases: (policy?.mpoAliases?.length ? policy.mpoAliases : DEFAULT_DIVISION_POLICY.mpoAliases)
      .map(toUpperTrimmed),
    womenDivisionCodes: (policy?.womenDivisionCodes?.length ? policy.womenDivisionCodes : DEFAULT_DIVISION_POLICY.womenDivisionCodes)
      .map(toUpperTrimmed),
  };
}

export function getOfferedDivisionCodes(rows: TournamentDivisionRowLike[]) {
  return rows
    .filter(row => row.isEnabled !== false)
    .map(row => toUpperTrimmed(row.code));
}

export function resolveTournamentOfferedDivisions(
  tournamentFlags?: TournamentDivisionFlagsLike | null,
  offeredRows: TournamentDivisionRowLike[] = [],
) {
  const enabledCustomRows = offeredRows.filter(row => row.isEnabled !== false);
  const majorDivisions: Array<{ code: string; label: string }> = [];
  const offeredCodeSet = new Set<string>();

  if (enabledCustomRows.length > 0) {
    for (const row of enabledCustomRows) {
      const code = toUpperTrimmed(row.code);
      offeredCodeSet.add(code);
      majorDivisions.push({
        code,
        label: row.label?.trim() || code,
      });
      if (code === "OPEN" || code === "MPO") {
        offeredCodeSet.add("OPEN");
        offeredCodeSet.add("MPO");
      }
      if (code === "WOMEN" || code === "FPO") {
        offeredCodeSet.add("WOMEN");
        offeredCodeSet.add("FPO");
      }
    }
  }
  else {
    const openEnabled = tournamentFlags?.divisionOpen !== false;
    const womenEnabled = tournamentFlags?.divisionWomen !== false;

    if (openEnabled) {
      majorDivisions.push({ code: "OPEN", label: "Open (MPO)" });
      offeredCodeSet.add("OPEN");
      offeredCodeSet.add("MPO");
    }
    if (womenEnabled) {
      majorDivisions.push({ code: "WOMEN", label: "Women (FPO)" });
      offeredCodeSet.add("WOMEN");
      offeredCodeSet.add("FPO");
    }
    if (tournamentFlags?.divisionJunior && tournamentFlags?.keepJuniorsSeparate) {
      majorDivisions.push({ code: "MJ18", label: "Junior Open (MJ18)" });
      offeredCodeSet.add("MJ18");
      if (womenEnabled) {
        majorDivisions.push({ code: "FJ18", label: "Junior Women (FJ18)" });
        offeredCodeSet.add("FJ18");
      }
    }
  }

  return {
    majorDivisions,
    offeredDivisionCodes: [...offeredCodeSet],
  };
}

export function getTournamentRegistrationStatus(
  dates: TournamentRegistrationDatesLike,
  isManuallyLocked = false,
  now = Date.now(),
) {
  const isRegistrationLocked = Boolean(isManuallyLocked);
  const hasTournamentClosed = Boolean(dates.closedAt);
  const hasTournamentStarted = Boolean(dates.startDate && now >= dates.startDate);
  const isBeforeOpenDate = Boolean(dates.registrationOpenDate && now < dates.registrationOpenDate);
  const isAfterCloseDate = Boolean(dates.registrationCloseDate && now > dates.registrationCloseDate);

  let registrationStatusReason: RegistrationStatusReason = "open";
  if (hasTournamentClosed) {
    registrationStatusReason = "tournament_closed";
  }
  else if (isRegistrationLocked) {
    registrationStatusReason = "locked_by_staff";
  }
  else if (hasTournamentStarted) {
    registrationStatusReason = "tournament_started";
  }
  else if (isBeforeOpenDate) {
    registrationStatusReason = "not_yet_open";
  }
  else if (isAfterCloseDate) {
    registrationStatusReason = "registration_closed_date";
  }

  return {
    isRegistrationLocked,
    isRegistrationOpen: registrationStatusReason === "open",
    registrationStatusReason,
  };
}

export function getEnabledTournamentDisciplines(flags: TournamentDisciplineFlagsLike) {
  const list: Array<{ key: string; label: string }> = [];
  if (flags.hasGolf) {
    list.push({ key: "golf", label: "Disc Golf" });
  }
  if (flags.hasAccuracy) {
    list.push({ key: "accuracy", label: "Accuracy" });
  }
  if (flags.hasDistance) {
    list.push({ key: "distance", label: "Distance" });
  }
  if (flags.hasSCF) {
    list.push({ key: "scf", label: "SCF (MTA + TRC)" });
  }
  if (flags.hasDiscathon) {
    list.push({ key: "discathon", label: "Discathon" });
  }
  if (flags.hasDDC) {
    list.push({ key: "ddc", label: "Double Disc Court" });
  }
  if (flags.hasFreestyle) {
    list.push({ key: "freestyle", label: "Freestyle" });
  }
  if (list.length === 0) {
    list.push({ key: "overall", label: "Overall" });
  }
  return list;
}

export function mapPolicyFromDb(
  policyRow: DivisionPolicyRowLike | null | undefined,
  offeredRows: TournamentDivisionRowLike[],
  tournamentFlags?: TournamentDivisionFlagsLike | null,
) {
  const config = normalizeDivisionPolicy({
    ageReferenceMode: (policyRow?.ageReferenceMode as AgeReferenceMode | undefined) ?? undefined,
  });

  const resolved = resolveTournamentOfferedDivisions(tournamentFlags, offeredRows);

  return {
    config,
    majorDivisions: resolved.majorDivisions,
    offeredDivisionCodes: resolved.offeredDivisionCodes,
  };
}
