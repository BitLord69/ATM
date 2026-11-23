import { z } from "zod";

export const ROUND_SCORE_STATUSES = ["ok", "DNS", "DNF", "SCR"] as const;
export type RoundScoreStatus = (typeof ROUND_SCORE_STATUSES)[number];

export const golfScoreEntryItemSchema = z.object({
  eventEntryId: z.string().trim().min(1),
  strokes: z.number().int().min(10).max(300).nullable(),
  status: z.enum(ROUND_SCORE_STATUSES).default("ok"),
});

export const golfPlayoffItemSchema = z.object({
  eventEntryId: z.string().trim().min(1),
  playoffRank: z.number().int().min(1).max(10).nullable(),
});

export const golfScoresPutBodySchema = z.object({
  roundNumber: z.number().int().min(1).max(50),
  scores: z.array(golfScoreEntryItemSchema).optional().default([]),
  playoffs: z.array(golfPlayoffItemSchema).optional().default([]),
});

export const golfScoresQuerySchema = z.object({
  roundNumber: z.coerce.number().int().min(1).max(50).optional().default(1),
});

export type GolfScoresPutBody = z.infer<typeof golfScoresPutBodySchema>;
export type GolfScoresQuery = z.infer<typeof golfScoresQuerySchema>;
