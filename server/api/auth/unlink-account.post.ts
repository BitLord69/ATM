import { and, eq } from "drizzle-orm";

import { auth } from "../../../lib/auth";
import db from "../../../lib/db";
import { account } from "../../../lib/db/schema";

const SUPPORTED_SOCIAL_PROVIDERS = new Set(["github", "google", "facebook"]);

function isCredentialLoginMethod(row: { providerId: string; password: string | null }) {
  return row.providerId === "credential" && typeof row.password === "string" && row.password.length > 0;
}

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const body = await readBody<{ providerId?: string; accountId?: string }>(event);
  const providerId = typeof body?.providerId === "string" ? body.providerId : "";
  const requestedAccountId = typeof body?.accountId === "string" ? body.accountId : "";

  if (!providerId) {
    throw createError({ statusCode: 400, message: "Missing providerId for unlink request." });
  }

  if (providerId !== "credential" && !SUPPORTED_SOCIAL_PROVIDERS.has(providerId)) {
    throw createError({ statusCode: 400, message: "Unsupported provider for unlink request." });
  }

  const result = await db.transaction(async (tx) => {
    const linkedAccounts = await tx
      .select({
        id: account.id,
        accountId: account.accountId,
        providerId: account.providerId,
        password: account.password,
      })
      .from(account)
      .where(eq(account.userId, session.user.id));

    const target = linkedAccounts.find((row) => {
      if (row.providerId !== providerId) {
        return false;
      }
      if (!requestedAccountId) {
        return true;
      }
      return row.accountId === requestedAccountId;
    });

    if (!target) {
      throw createError({
        statusCode: 404,
        message: "No linked account was found for the selected provider.",
      });
    }

    const socialCount = linkedAccounts.filter(row => SUPPORTED_SOCIAL_PROVIDERS.has(row.providerId)).length;
    const hasPassword = linkedAccounts.some(isCredentialLoginMethod);

    if (SUPPORTED_SOCIAL_PROVIDERS.has(providerId)) {
      const remainingSocialCount = Math.max(0, socialCount - 1);
      const hasLoginMethodAfterUnlink = hasPassword || remainingSocialCount > 0;

      if (!hasLoginMethodAfterUnlink) {
        throw createError({
          statusCode: 409,
          message: "You cannot disconnect your last sign-in method. Set an account password first, then try disconnecting this social provider again.",
        });
      }
    }

    if (providerId === "credential") {
      const hasLoginMethodAfterUnlink = socialCount > 0;

      if (!hasLoginMethodAfterUnlink) {
        throw createError({
          statusCode: 409,
          message: "You cannot remove password sign-in because no social provider is connected. Connect at least one social provider first to keep account access.",
        });
      }
    }

    await tx
      .delete(account)
      .where(and(
        eq(account.id, target.id),
        eq(account.userId, session.user.id),
      ));

    return { success: true };
  });

  return { status: result.success };
});
