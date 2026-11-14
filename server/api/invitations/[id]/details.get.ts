import { eq } from "drizzle-orm";

import db from "../../../../lib/db";
import { invitation, organization, user } from "../../../../lib/db/schema";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing invitation id",
    });
  }

  const invitationRecord = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      organizationId: invitation.organizationId,
      organizationName: organization.name,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .innerJoin(
      organization,
      eq(invitation.organizationId, organization.id),
    )
    .where(eq(invitation.id, id))
    .limit(1);

  const [inv] = invitationRecord;

  if (!inv) {
    throw createError({
      statusCode: 404,
      statusMessage: "Invitation not found",
    });
  }

  if (inv.status !== "pending") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invitation is no longer valid",
    });
  }

  if (inv.expiresAt < Date.now()) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invitation has expired",
    });
  }

  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, inv.email))
    .limit(1);

  return {
    data: {
      id: inv.id,
      email: inv.email,
      organizationName: inv.organizationName,
      accountExists: existingUser.length > 0,
    },
  };
});
