import { z } from "zod";

export const startingListDisciplineSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .default("overall");

export const startingListRoundSchema = z.coerce.number().int().min(1).default(1);

export const startingListQuerySchema = z.object({
  discipline: startingListDisciplineSchema.optional().default("overall"),
  roundNumber: startingListRoundSchema.optional().default(1),
});

export const startingListGenerateBodySchema = z.object({
  discipline: startingListDisciplineSchema.optional().default("overall"),
  roundNumber: startingListRoundSchema.optional().default(1),
  overwrite: z.boolean().optional().default(false),
});

export const startingListReorderBodySchema = z.object({
  discipline: startingListDisciplineSchema.optional().default("overall"),
  roundNumber: startingListRoundSchema.optional().default(1),
  orderedEventEntryIds: z.array(z.string().trim().min(1)).min(1),
});

export const startingListLockBodySchema = z.object({
  locked: z.boolean().optional().default(true),
});

export type StartingListQuery = z.infer<typeof startingListQuerySchema>;
export type StartingListGenerateBody = z.infer<typeof startingListGenerateBodySchema>;
export type StartingListReorderBody = z.infer<typeof startingListReorderBodySchema>;
export type StartingListLockBody = z.infer<typeof startingListLockBodySchema>;
