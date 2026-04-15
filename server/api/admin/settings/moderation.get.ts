import { auth } from "../../../../lib/auth";
import { getBanRequestEmailEnabled } from "../../../utils/moderation-settings";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const isAdmin = session.user.role === "admin";

  return {
    banRequestEmailEnabled: await getBanRequestEmailEnabled(),
    canEdit: isAdmin,
  };
});
