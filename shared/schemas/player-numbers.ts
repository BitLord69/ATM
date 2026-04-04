import { z } from "zod";

export const playerNumberGenerateBodySchema = z.object({
  startAt: z.coerce.number().int().min(1).max(999999).optional().default(1000),
  gap: z.coerce.number().int().min(1).max(1000).optional().default(10),
});

export const playerNumberManualAssignBodySchema = z.object({
  playerId: z.string().trim().min(1),
  playerNumber: z.coerce.number().int().min(1).max(999999),
});

export type PlayerNumberGenerateBody = z.infer<typeof playerNumberGenerateBodySchema>;
export type PlayerNumberManualAssignBody = z.infer<typeof playerNumberManualAssignBodySchema>;
