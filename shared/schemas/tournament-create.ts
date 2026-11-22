import { z } from "zod";

export const createTournamentSchema = z.object({
  name: z.string().trim().min(3, "Tournament name must be at least 3 characters").max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  lat: z.number().min(-90).max(90).optional(),
  long: z.number().min(-180).max(180).optional(),
  startDate: z.number().int().optional().nullable(),
  endDate: z.number().int().optional().nullable(),
  registrationOpenDate: z.number().int().optional().nullable(),
  registrationCloseDate: z.number().int().optional().nullable(),
  organizationId: z.string().trim().min(1).optional().nullable(),
  organizationName: z.string().trim().min(2).max(120).optional().nullable(),
  divisionOpen: z.boolean().optional().default(true),
  divisionWomen: z.boolean().optional().default(true),
  divisionMaster: z.boolean().optional().default(false),
  divisionGrandMaster: z.boolean().optional().default(false),
  divisionSeniorGrandMaster: z.boolean().optional().default(false),
  divisionLegend: z.boolean().optional().default(false),
  divisionJunior: z.boolean().optional().default(false),
  hasGolf: z.boolean().optional().default(false),
  hasAccuracy: z.boolean().optional().default(false),
  hasDistance: z.boolean().optional().default(false),
  hasSCF: z.boolean().optional().default(false),
  hasDiscathon: z.boolean().optional().default(false),
  hasDDC: z.boolean().optional().default(false),
  hasFreestyle: z.boolean().optional().default(false),
});

export type CreateTournamentBody = z.infer<typeof createTournamentSchema>;
