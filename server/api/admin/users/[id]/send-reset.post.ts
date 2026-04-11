import { eq } from "drizzle-orm";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { user } from "../../../../../lib/db/schema";
import env from "../../../../../lib/env";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }
  if (session.user.role !== "admin") {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "User ID required" });
  }

  const [target] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);

  if (!target) {
    throw createError({ statusCode: 404, message: "User not found" });
  }

  // Use Better Auth's built-in forgetPassword flow (runtime API surface).
  const response = await (auth.api as any).forgetPassword({
    body: {
      email: target.email,
      redirectTo: `${env.BETTER_AUTH_URL}/reset-password`,
    },
  }) as { ok?: boolean };

  if (!response.ok) {
    throw createError({ statusCode: 502, message: "Failed to send password reset email" });
  }

  return { success: true };
});
