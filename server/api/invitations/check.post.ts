import { and, eq, or } from "drizzle-orm";

import { auth } from "../../../lib/auth";
import db from "../../../lib/db";
import { invitation, tournamentMembership } from "../../../lib/db/schema";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const body = await readBody(event);
  const { email, organizationId } = body;

  if (!email || !organizationId) {
    throw createError({
      statusCode: 400,
      message: "Email and organizationId required",
    });
  }

  if (session.user.role !== "admin") {
    const allowedMembership = await db
      .select({ id: tournamentMembership.id })
      .from(tournamentMembership)
      .where(
        and(
          eq(tournamentMembership.userId, session.user.id),
          eq(tournamentMembership.organizationId, organizationId),
          or(
            eq(tournamentMembership.role, "owner"),
            eq(tournamentMembership.role, "admin"),
            eq(tournamentMembership.role, "td"),
          ),
          eq(tournamentMembership.status, "active"),
        ),
      )
      .limit(1);

    if (allowedMembership.length === 0) {
      throw createError({ statusCode: 403, message: "Forbidden" });
    }
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
