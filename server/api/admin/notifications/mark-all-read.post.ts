import { and, eq, isNull } from "drizzle-orm";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { adminNotification } from "../../../../lib/db/schema";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  await db
    .update(adminNotification)
    .set({ readAt: Date.now() })
    .where(
      and(
        eq(adminNotification.recipientUserId, session.user.id),
        isNull(adminNotification.readAt),
      ),
    );

  return { success: true };
});
