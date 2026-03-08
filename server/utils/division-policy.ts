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
  isEnabled?: boolean | null;
};

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

export function mapPolicyFromDb(
  policyRow: DivisionPolicyRowLike | null | undefined,
  offeredRows: TournamentDivisionRowLike[],
) {
  const config = normalizeDivisionPolicy({
    ageReferenceMode: (policyRow?.ageReferenceMode as AgeReferenceMode | undefined) ?? undefined,
  });

  return {
    config,
    offeredDivisionCodes: getOfferedDivisionCodes(offeredRows),
  };
}
