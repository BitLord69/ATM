import { auth } from "../../../lib/auth";
import env from "../../../lib/env";

type ForgotPasswordBody = {
  email?: string;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<ForgotPasswordBody>(event);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    throw createError({ statusCode: 400, message: "Email is required" });
  }

  await (auth.api as any).requestPasswordReset({
    body: {
      email,
      redirectTo: `${env.BETTER_AUTH_URL}/reset-password`,
    },
  });

  return { success: true };
});
