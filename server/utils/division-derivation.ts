import type { PlayerAgeProfile } from "#shared/utils/division-age";

import type { DivisionPolicyConfig } from "./division-policy";

import { deriveMinorDivisionTags } from "#shared/utils/division-age";

import { normalizeDivisionPolicy } from "./division-policy";

export type PlayerDivisionProfile = PlayerAgeProfile;

export type MinorDivisionDerivation = {
  minorDivisionTags: string[];
  primaryMinorDivision: string | null;
};

export function deriveMinorDivisions(
  profile: PlayerDivisionProfile,
  eventTimestamp?: number | null,
  rawPolicy?: Partial<DivisionPolicyConfig> | null,
): MinorDivisionDerivation {
  const policy = normalizeDivisionPolicy(rawPolicy);
  return deriveMinorDivisionTags(profile, eventTimestamp, policy);
}
