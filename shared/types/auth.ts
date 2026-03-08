export const USER_ROLES = [
  "admin",
  "guest",
  "scorer",
  "validator",
  "td",
  "presenter",
  "player",
  "invitee",
] as const;

export type UserRole = typeof USER_ROLES[number];

export type CustomUser = {
  role: UserRole;
  country?: string | null;
  distanceUnit?: "km" | "mi" | null;
  pdgaNumber?: string | null;
  homeClub?: string | null;
  dateOfBirth?: string | null;
  genderCategory?: string | null;
};
