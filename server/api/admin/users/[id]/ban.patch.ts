import { eq } from "drizzle-orm";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { user } from "../../../../../lib/db/schema";

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

  const body = await readBody<{ banned: boolean; reason?: string }>(event);
  if (typeof body.banned !== "boolean") {
    throw createError({ statusCode: 400, message: "banned field must be a boolean" });
  }

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);

  if (!existing) {
    throw createError({ statusCode: 404, message: "User not found" });
  }

  await db
    .update(user)
    .set({
      banned: body.banned,
      bannedAt: body.banned ? Date.now() : null,
      banReason: body.banned ? (body.reason ?? null) : null,
    })
    .where(eq(user.id, id));

  return { success: true };
});
