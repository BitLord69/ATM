import { and, eq, or } from "drizzle-orm";

import { auth } from "../../../lib/auth";
import db from "../../../lib/db";
import { invitation, tournamentMembership } from "../../../lib/db/schema";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Invitation ID required",
    });
  }

  const result = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      emailSentAt: invitation.emailSentAt,
      emailError: invitation.emailError,
      organizationId: invitation.organizationId,
      inviterId: invitation.inviterId,
    })
    .from(invitation)
    .where(eq(invitation.id, id))
    .limit(1);

  const [inv] = result;
  if (!inv) {
    throw createError({
      statusCode: 404,
      message: "Invitation not found",
    });
  }

  if (session.user.role !== "admin" && inv.inviterId !== session.user.id) {
    const allowedMembership = await db
      .select({ id: tournamentMembership.id })
      .from(tournamentMembership)
      .where(
        and(
          eq(tournamentMembership.userId, session.user.id),
          eq(tournamentMembership.organizationId, inv.organizationId),
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

  return {
    id: inv.id,
    email: inv.email,
    status: inv.status,
    emailSentAt: inv.emailSentAt,
    emailError: inv.emailError,
  };
});
