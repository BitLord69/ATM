import type { DivisionPolicyConfig } from "./division-policy";

import {
  getAgeOnEventDate,
  normalizeGenderCategory,
  parseBirthDate,
} from "#shared/utils/division-age";

import {
  normalizeDivisionPolicy,
  toUpperTrimmed,
} from "./division-policy";

export type PlayerEligibilityProfile = {
  dateOfBirth?: string | null;
  genderCategory?: string | null;
};

export type ValidateMajorDivisionInput = {
  majorDivision: string;
  offeredDivisionCodes: string[];
  player: PlayerEligibilityProfile;
  eventTimestamp?: number | null;
  policy?: Partial<DivisionPolicyConfig> | null;
};

export type MajorDivisionValidationResult = {
  eligible: boolean;
  reason:
    | "ok"
    | "division_not_offered"
    | "missing_birth_date"
    | "gender_not_eligible"
    | "age_not_eligible";
};

export const MAJOR_DIVISION_REASON_LABELS: Record<MajorDivisionValidationResult["reason"], string> = {
  ok: "eligible",
  division_not_offered: "this division is not offered in this tournament",
  missing_birth_date: "date of birth is required for age-protected divisions",
  gender_not_eligible: "selected gender category is not eligible for this division",
  age_not_eligible: "player age does not meet the requirements for this division",
};

function parseAgeProtectedThreshold(code: string) {
  const match = code.match(/^(MP|FP|MA|FA|MJ|FJ)(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, prefix, ageText] = match;
  if (!prefix || !ageText) {
    return null;
  }

  return {
    prefix,
    isJunior: prefix === "MJ" || prefix === "FJ",
    ageLimit: Number.parseInt(ageText, 10),
  };
}

export function validateMajorDivision(input: ValidateMajorDivisionInput): MajorDivisionValidationResult {
  const policy = normalizeDivisionPolicy(input.policy);
  const majorDivisionCode = toUpperTrimmed(input.majorDivision);
  const offeredCodes = input.offeredDivisionCodes.map(toUpperTrimmed);

  if (!offeredCodes.includes(majorDivisionCode)) {
    return { eligible: false, reason: "division_not_offered" };
  }

  if (policy.mpoAliases.includes(majorDivisionCode)) {
    return { eligible: true, reason: "ok" };
  }

  const gender = normalizeGenderCategory(input.player.genderCategory);
  const eventDate = input.eventTimestamp ? new Date(input.eventTimestamp) : new Date();
  const threshold = parseAgeProtectedThreshold(majorDivisionCode);

  if (policy.womenDivisionCodes.includes(majorDivisionCode) || (threshold?.prefix?.startsWith("F") ?? false)) {
    if (gender !== "women") {
      return { eligible: false, reason: "gender_not_eligible" };
    }
  }

  if (threshold) {
    const dateOfBirth = parseBirthDate(input.player.dateOfBirth);
    if (!dateOfBirth) {
      return { eligible: false, reason: "missing_birth_date" };
    }

    const age = getAgeOnEventDate(dateOfBirth, eventDate, policy.ageReferenceMode);
    if (threshold.isJunior ? age > threshold.ageLimit : age < threshold.ageLimit) {
      return { eligible: false, reason: "age_not_eligible" };
    }
  }

  return { eligible: true, reason: "ok" };
}
