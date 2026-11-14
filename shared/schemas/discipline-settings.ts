import { z } from "zod";

export const GOLF_POOL_MODES = ["static", "dynamic"] as const;
export type GolfPoolMode = typeof GOLF_POOL_MODES[number];

export const disciplineSettingsPatchSchema = z.object({
  rounds: z.number().int().min(1).max(50).nullable(),
  cumulativeRounds: z.number().int().min(1).max(50).nullable(),
  poolMode: z.enum(GOLF_POOL_MODES).optional(),
  poolCount: z.number().int().min(1).max(8).optional(),
  golfStartEnabled: z.boolean().optional(),
  roundPars: z.array(z.number().int().min(18).max(150).nullable()).max(50).optional(),
}).refine((value) => {
  if (value.cumulativeRounds == null) {
    return true;
  }

  if (value.rounds == null) {
    return false;
  }

  return value.cumulativeRounds <= value.rounds;
}, {
  message: "Cumulative rounds must be less than or equal to rounds",
  path: ["cumulativeRounds"],
});

export type DisciplineSettingsPatch = z.infer<typeof disciplineSettingsPatchSchema>;
