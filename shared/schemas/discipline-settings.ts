import { z } from "zod";

export const disciplineSettingsPatchSchema = z.object({
  rounds: z.number().int().min(1).max(50).nullable(),
  cumulativeRounds: z.number().int().min(1).max(50).nullable(),
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
