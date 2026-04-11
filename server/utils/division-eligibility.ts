import type { DivisionPolicyConfig } from "./division-policy";

import {

  normalizeDivisionPolicy,
  toUpperTrimmed,
} from "./division-policy";

export type GenderCategory = "women" | "open";

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

function normalizeGenderCategory(value: string | null | undefined): GenderCategory {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (["women", "woman", "female", "f", "fpo"].includes(normalized)) {
    return "women";
  }
  return "open";
}

function parseBirthDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function getAgeOnEventDate(
  dateOfBirth: Date,
  eventDate: Date,
  mode: DivisionPolicyConfig["ageReferenceMode"],
) {
  if (mode === "calendar_year") {
    return eventDate.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  }

  let age = eventDate.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const eventMonth = eventDate.getUTCMonth();
  const birthMonth = dateOfBirth.getUTCMonth();

  if (eventMonth < birthMonth || (eventMonth === birthMonth && eventDate.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }

  return age;
}

function parseAgeProtectedThreshold(code: string) {
  const match = code.match(/^(MP|FP|MA|FA)(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, prefix, minAgeText] = match;
  if (!prefix || !minAgeText) {
    return null;
  }

  return {
    prefix,
    minAge: Number.parseInt(minAgeText, 10),
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
    if (age < threshold.minAge) {
      return { eligible: false, reason: "age_not_eligible" };
    }
  }

  return { eligible: true, reason: "ok" };
}
