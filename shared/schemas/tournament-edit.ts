import { z } from "zod";

export const slugParamSchema = z.object({
  slug: z.string().trim().min(1, "Tournament slug is required"),
});

export const venueInputSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, "Venue name is required"),
  description: z.string().nullable().optional(),
  facilities: z.string().nullable().optional(),
  lat: z.number().gte(-90).lte(90),
  long: z.number().gte(-180).lte(180),
  hasGolf: z.boolean().optional(),
  hasAccuracy: z.boolean().optional(),
  hasDistance: z.boolean().optional(),
  hasSCF: z.boolean().optional(),
  hasDiscathon: z.boolean().optional(),
  hasDDC: z.boolean().optional(),
  hasFreestyle: z.boolean().optional(),
});

export const editTournamentBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().email("Invalid contact email").nullable().optional().or(z.literal("")),
  contactPhone: z.string().nullable().optional(),
  directorName: z.string().nullable().optional(),
  directorEmail: z.string().email("Invalid tournament director email").nullable().optional().or(z.literal("")),
  directorPhone: z.string().nullable().optional(),
  lat: z.number().gte(-90).lte(90),
  long: z.number().gte(-180).lte(180),
  startDate: z.number().nullable().optional(),
  endDate: z.number().nullable().optional(),
  hasGolf: z.boolean().optional(),
  hasAccuracy: z.boolean().optional(),
  hasDistance: z.boolean().optional(),
  hasSCF: z.boolean().optional(),
  hasDiscathon: z.boolean().optional(),
  hasDDC: z.boolean().optional(),
  hasFreestyle: z.boolean().optional(),
  closeTournament: z.boolean().optional(),
  venues: z.array(venueInputSchema).optional(),
});

export const cloneTournamentBodySchema = z.object({
  name: z.string().trim().min(1, "New tournament name is required"),
  startDate: z.number(),
  endDate: z.number(),
  includeVenues: z.boolean().optional(),
}).refine(value => value.endDate >= value.startDate, {
  message: "End date must be on or after start date",
  path: ["endDate"],
});

export type EditTournamentBody = z.infer<typeof editTournamentBodySchema>;
export type VenueInput = z.infer<typeof venueInputSchema>;
export type CloneTournamentBody = z.infer<typeof cloneTournamentBodySchema>;
