import { eq } from "drizzle-orm";

import { auth } from "../../../lib/auth";
import db from "../../../lib/db";
import { account } from "../../../lib/db/schema";

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
  revokeOtherSessions?: boolean;
};

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const body = await readBody<ChangePasswordBody>(event);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const revokeOtherSessions = body?.revokeOtherSessions === true;

  if (!newPassword) {
    throw createError({ statusCode: 400, message: "New password is required." });
  }

  if (newPassword.length < 8) {
    throw createError({ statusCode: 400, message: "Password must be at least 8 characters." });
  }

  const linkedAccounts = await db
    .select({
      providerId: account.providerId,
      password: account.password,
    })
    .from(account)
    .where(eq(account.userId, session.user.id));

  const hasCredentialPassword = linkedAccounts.some(
    row => row.providerId === "credential" && typeof row.password === "string" && row.password.length > 0,
  );

  try {
    if (hasCredentialPassword) {
      if (!currentPassword) {
        throw createError({ statusCode: 400, message: "Current password is required." });
      }

      await (auth.api as any).changePassword({
        headers: event.headers,
        body: {
          currentPassword,
          newPassword,
          revokeOtherSessions,
        },
      });

      return {
        success: true,
        message: "Password updated successfully.",
      };
    }

    await (auth.api as any).setPassword({
      headers: event.headers,
      body: {
        newPassword,
      },
    });

    return {
      success: true,
      message: "Password added successfully. You can now sign in with email and password.",
    };
  }
  catch (error: any) {
    const message = error?.body?.message || error?.message || "Unable to update password.";
    const normalizedMessage = typeof message === "string" ? message : "Unable to update password.";
    const lowerMessage = normalizedMessage.toLowerCase();

    if (lowerMessage.includes("invalid password")) {
      throw createError({ statusCode: 400, message: "Current password is incorrect." });
    }

    if (lowerMessage.includes("password is too short")) {
      throw createError({ statusCode: 400, message: "Password must be at least 8 characters." });
    }

    if (lowerMessage.includes("password is too long")) {
      throw createError({ statusCode: 400, message: "Password is too long." });
    }

    if (lowerMessage.includes("password already set")) {
      throw createError({ statusCode: 409, message: "A password is already set for this account. Use change password instead." });
    }

    throw createError({ statusCode: 400, message: normalizedMessage });
  }
});
