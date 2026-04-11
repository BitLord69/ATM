import type { DivisionPolicyConfig } from "./division-policy";

import {

  normalizeDivisionPolicy,
} from "./division-policy";

export type PlayerDivisionProfile = {
  dateOfBirth?: string | null;
  genderCategory?: string | null;
};

export type MinorDivisionDerivation = {
  minorDivisionTags: string[];
  primaryMinorDivision: string | null;
};

function normalizeGenderCategory(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (["women", "woman", "female", "f", "fpo"].includes(normalized)) {
    return "women" as const;
  }
  return "open" as const;
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

function createTag(prefix: "MP" | "FP" | "MJ" | "FJ", threshold: number) {
  return `${prefix}${threshold}`;
}

export function deriveMinorDivisions(
  profile: PlayerDivisionProfile,
  eventTimestamp?: number | null,
  rawPolicy?: Partial<DivisionPolicyConfig> | null,
): MinorDivisionDerivation {
  const policy = normalizeDivisionPolicy(rawPolicy);
  const eventDate = eventTimestamp ? new Date(eventTimestamp) : new Date();
  const dateOfBirth = parseBirthDate(profile.dateOfBirth);

  if (!dateOfBirth) {
    return {
      minorDivisionTags: [],
      primaryMinorDivision: null,
    };
  }

  const age = getAgeOnEventDate(dateOfBirth, eventDate, policy.ageReferenceMode);
  const gender = normalizeGenderCategory(profile.genderCategory);
  const adultPrefix = gender === "women" ? "FP" : "MP";
  const juniorPrefix = gender === "women" ? "FJ" : "MJ";

  const tags: string[] = [];

  if (age <= policy.juniorMaxAge) {
    tags.push(createTag(juniorPrefix, policy.juniorMaxAge));
  }

  for (const threshold of policy.ageThresholds) {
    if (age >= threshold) {
      tags.push(createTag(adultPrefix, threshold));
    }
  }

  return {
    minorDivisionTags: tags,
    primaryMinorDivision: tags.at(-1) ?? null,
  };
}
