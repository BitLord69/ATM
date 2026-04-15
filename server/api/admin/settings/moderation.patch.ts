import { auth } from "../../../../lib/auth";
import { setBanRequestEmailEnabled } from "../../../utils/moderation-settings";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  if (session.user.role !== "admin") {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const body = await readBody<{ banRequestEmailEnabled?: boolean }>(event);
  if (typeof body.banRequestEmailEnabled !== "boolean") {
    throw createError({ statusCode: 400, message: "banRequestEmailEnabled must be boolean" });
  }

  await setBanRequestEmailEnabled(body.banRequestEmailEnabled);

  return { success: true };
});
