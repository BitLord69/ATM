import { and, eq } from "drizzle-orm";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { invitation, TOURNAMENT_ROLES } from "../../../../lib/db/schema";

type Body = {
  tournamentRole: (typeof TOURNAMENT_ROLES)[number];
  globalRoleTarget: "user" | "admin";
};

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const invitationId = getRouterParam(event, "id");
  if (!invitationId) {
    throw createError({ statusCode: 400, message: "Invitation ID required" });
  }

  const body = await readBody<Body>(event);
  if (!body || !TOURNAMENT_ROLES.includes(body.tournamentRole)) {
    throw createError({ statusCode: 400, message: "Invalid tournament role" });
  }

  if (body.globalRoleTarget !== "user" && body.globalRoleTarget !== "admin") {
    throw createError({ statusCode: 400, message: "Invalid global role target" });
  }

  if (body.globalRoleTarget === "admin" && session.user.role !== "admin") {
    throw createError({ statusCode: 403, message: "Only system admins can assign global admin role" });
  }

  const [existing] = await db
    .select({ id: invitation.id, inviterId: invitation.inviterId })
    .from(invitation)
    .where(eq(invitation.id, invitationId))
    .limit(1);

  if (!existing) {
    throw createError({ statusCode: 404, message: "Invitation not found" });
  }

  if (existing.inviterId !== session.user.id && session.user.role !== "admin") {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  await db
    .update(invitation)
    .set({
      tournamentRole: body.tournamentRole,
      globalRoleTarget: body.globalRoleTarget,
    })
    .where(and(eq(invitation.id, invitationId)));

  return { success: true };
});
