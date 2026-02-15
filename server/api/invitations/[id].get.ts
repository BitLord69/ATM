import { eq } from "drizzle-orm";

import db from "../../../lib/db";
import { invitation } from "../../../lib/db/schema";

export default defineEventHandler(async (event) => {
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
    })
    .from(invitation)
    .where(eq(invitation.id, id))
    .limit(1);

  if (result.length === 0) {
    throw createError({
      statusCode: 404,
      message: "Invitation not found",
    });
  }

  return result[0];
});
