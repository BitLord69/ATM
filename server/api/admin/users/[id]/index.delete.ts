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

  // Prevent deleting own account (the admin calling this)
  const callerId = session.user.id;
  if (callerId && callerId === id) {
    throw createError({ statusCode: 400, message: "You cannot delete your own account" });
  }

  const [existing] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);

  if (!existing) {
    throw createError({ statusCode: 404, message: "User not found" });
  }

  await db.delete(user).where(eq(user.id, id));

  return { success: true };
});
