/**
 * Shared age & minor-division derivation used by both server (eligibility/derivation)
 * and client (live preview on the public registration form).
 * Keep this file free of server-only or browser-only imports.
 */

export type AgeReferenceMode = "calendar_year" | "exact_date";
export type GenderCategory = "women" | "open";

export type DivisionAgePolicy = {
  ageReferenceMode: AgeReferenceMode;
  ageThresholds: number[];
  juniorMaxAge: number;
};

export const DEFAULT_DIVISION_AGE_POLICY: DivisionAgePolicy = {
  ageReferenceMode: "calendar_year",
  ageThresholds: [40, 50, 55, 60, 65, 70, 75, 80],
  juniorMaxAge: 18,
};

export type PlayerAgeProfile = {
  dateOfBirth?: string | null;
  genderCategory?: string | null;
};

export function normalizeGenderCategory(value: string | null | undefined): GenderCategory {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (["women", "woman", "female", "f", "fpo"].includes(normalized)) {
    return "women";
  }
  return "open";
}

export function parseBirthDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function getAgeOnEventDate(
  dateOfBirth: Date,
  eventDate: Date,
  mode: AgeReferenceMode,
) {
  let age = eventDate.getUTCFullYear() - dateOfBirth.getUTCFullYear();

  if (mode === "calendar_year") {
    return age;
  }

  const eventMonth = eventDate.getUTCMonth();
  const birthMonth = dateOfBirth.getUTCMonth();

  if (eventMonth < birthMonth || (eventMonth === birthMonth && eventDate.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }

  return age;
}

export function deriveMinorDivisionTags(
  profile: PlayerAgeProfile,
  eventTimestamp: number | null | undefined,
  policy: DivisionAgePolicy = DEFAULT_DIVISION_AGE_POLICY,
) {
  const dateOfBirth = parseBirthDate(profile.dateOfBirth);
  if (!dateOfBirth) {
    return { minorDivisionTags: [] as string[], primaryMinorDivision: null as string | null };
  }

  const eventDate = eventTimestamp ? new Date(eventTimestamp) : new Date();
  const age = getAgeOnEventDate(dateOfBirth, eventDate, policy.ageReferenceMode);
  const gender = normalizeGenderCategory(profile.genderCategory);
  const adultPrefix = gender === "women" ? "FP" : "MP";
  const juniorPrefix = gender === "women" ? "FJ" : "MJ";

  const tags: string[] = [];

  if (age <= policy.juniorMaxAge) {
    tags.push(`${juniorPrefix}${policy.juniorMaxAge}`);
  }

  for (const threshold of policy.ageThresholds) {
    if (age >= threshold) {
      tags.push(`${adultPrefix}${threshold}`);
    }
  }

  return {
    minorDivisionTags: tags,
    primaryMinorDivision: tags.at(-1) ?? null,
  };
}
