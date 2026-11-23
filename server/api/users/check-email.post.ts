import { and, eq, gt } from "drizzle-orm";

import { auth } from "../../../lib/auth";
import db from "../../../lib/db";
import { invitation, user } from "../../../lib/db/schema";

export default defineEventHandler(async (event) => {
  const { email, invitationId } = await readBody(event);

  if (!email || typeof email !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing email",
    });
  }

  const session = await auth.api.getSession({ headers: event.headers });

  if (!session?.user) {
    if (!invitationId || typeof invitationId !== "string") {
      throw createError({
        statusCode: 401,
        statusMessage: "Authentication required",
      });
    }

    const validInvite = await db
      .select({ id: invitation.id, email: invitation.email })
      .from(invitation)
      .where(
        and(
          eq(invitation.id, invitationId),
          eq(invitation.status, "pending"),
          gt(invitation.expiresAt, Date.now()),
        ),
      )
      .limit(1);

    if (!validInvite[0] || validInvite[0].email.toLowerCase() !== email.trim().toLowerCase()) {
      throw createError({
        statusCode: 403,
        statusMessage: "Forbidden",
      });
    }
  }

  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  return {
    exists: existingUser.length > 0,
  };
});
