import { eq } from "drizzle-orm";

import db from "../../../lib/db";
import { user } from "../../../lib/db/schema";

export default defineEventHandler(async (event) => {
  const { email } = await readBody(event);

  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing email",
    });
  }

  const existingUser = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  return {
    exists: existingUser.length > 0,
  };
});
