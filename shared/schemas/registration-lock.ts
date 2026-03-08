import { z } from "zod";

export const registrationLockPatchSchema = z.object({
  locked: z.boolean(),
});

export type RegistrationLockPatchBody = z.infer<typeof registrationLockPatchSchema>;
