export const USER_ROLES = [
  "admin",
  "user",
] as const;

export type PersistedUserRole = typeof USER_ROLES[number];

// Keep guest as runtime-only role for authorization helpers that model anonymous access.
export type UserRole = PersistedUserRole | "guest";

export function normalizePersistedUserRole(role: unknown): PersistedUserRole {
  return role === "admin" ? "admin" : "user";
}

export type CustomUser = {
  role: PersistedUserRole;
  country?: string | null;
  distanceUnit?: "km" | "mi" | null;
  pdgaNumber?: string | null;
  homeClub?: string | null;
  dateOfBirth?: string | null;
  genderCategory?: string | null;
  banned?: boolean | null;
  forcePasswordChange?: boolean | null;
};
