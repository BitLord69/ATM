import { and, eq } from "drizzle-orm";

import db from "../../../lib/db";
import { invitation } from "../../../lib/db/schema";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { email, organizationId } = body;

  if (!email || !organizationId) {
    throw createError({
      statusCode: 400,
      message: "Email and organizationId required",
    });
  }

  const existing = await db
    .select({
      id: invitation.id,
      status: invitation.status,
      emailSentAt: invitation.emailSentAt,
      emailError: invitation.emailError,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(
      and(
        eq(invitation.email, email),
        eq(invitation.organizationId, organizationId),
        eq(invitation.status, "pending"),
      ),
    )
    .limit(1);

  return {
    exists: existing.length > 0,
    invitation: existing[0] || null,
  };
});
