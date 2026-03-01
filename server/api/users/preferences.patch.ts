import { eq } from "drizzle-orm";

import { auth } from "../../../lib/auth";
import db from "../../../lib/db";
import { user } from "../../../lib/db/schema";

const ALLOWED_UNITS = new Set(["km", "mi"] as const);

type DistanceUnit = "km" | "mi";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });

  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const body = await readBody<{ distanceUnit?: string }>(event);
  const distanceUnit = body?.distanceUnit;

  if (!distanceUnit || !ALLOWED_UNITS.has(distanceUnit as DistanceUnit)) {
    throw createError({
      statusCode: 400,
      message: "Invalid distanceUnit. Allowed values: km, mi",
    });
  }

  await db
    .update(user)
    .set({ distanceUnit })
    .where(eq(user.id, session.user.id));

  return {
    success: true,
    distanceUnit,
  };
});
