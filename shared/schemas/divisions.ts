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

export const tournamentEntryCreateSchema = z.object({
  majorDivision: divisionCodeSchema,
  discipline: z.string().trim().min(1).max(64).optional().default("overall"),
  playerId: z.string().trim().min(1).optional(),
});

export type DivisionPolicyPatch = z.infer<typeof divisionPolicyPatchSchema>;
export type TournamentEntryCreateBody = z.infer<typeof tournamentEntryCreateSchema>;
