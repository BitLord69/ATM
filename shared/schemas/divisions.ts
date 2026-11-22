import { z } from "zod";

export const divisionCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(16)
  .transform(value => value.toUpperCase());

export const divisionPolicyPatchSchema = z.object({
  ageReferenceMode: z.enum(["calendar_year", "exact_date"]).optional(),
  startingListMode: z.enum(["major_only", "promoted_minor"]).optional(),
  showMinorOverlays: z.boolean().optional(),
  divisions: z.array(
    z.object({
      code: divisionCodeSchema,
      label: z.string().trim().min(1),
      isEnabled: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    }),
  ).optional(),
});

export const playerProfileInputSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  email: z.email().max(160).optional().nullable().or(z.literal("")),
  dateOfBirth: z.iso.date("Date of birth must be a valid date (YYYY-MM-DD)").optional().nullable().or(z.literal("")),
  genderCategory: z.enum(["open", "women"]).optional().nullable(),
  pdgaNumber: z.string().trim().max(32).optional().nullable(),
  homeClub: z.string().trim().max(120).optional().nullable(),
});

export const guestPlayerInputSchema = playerProfileInputSchema.extend({
  displayName: z.string().trim().min(1, "Player name is required").max(120),
});

export const tournamentEntryCreateSchema = z.object({
  majorDivision: divisionCodeSchema,
  discipline: z.string().trim().min(1).max(64).optional(),
  disciplines: z.array(z.string().trim().min(1).max(64)).min(1).optional(),
  playerId: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
  guestPlayer: guestPlayerInputSchema.optional(),
  profile: playerProfileInputSchema.optional(),
});

export const tournamentPlayerRegistrationPatchSchema = z.object({
  majorDivision: divisionCodeSchema.optional(),
  disciplines: z.array(z.string().trim().min(1).max(64)).min(1).optional(),
  status: z.enum(["registered", "withdrawn"]).optional(),
  profile: playerProfileInputSchema.optional(),
});

export const tournamentUserSearchQuerySchema = z.object({
  q: z.string().trim().min(2, "Enter at least 2 characters to search").max(80),
});

export type DivisionPolicyPatch = z.infer<typeof divisionPolicyPatchSchema>;
export type TournamentEntryCreateBody = z.infer<typeof tournamentEntryCreateSchema>;
export type TournamentPlayerRegistrationPatchBody = z.infer<typeof tournamentPlayerRegistrationPatchSchema>;
