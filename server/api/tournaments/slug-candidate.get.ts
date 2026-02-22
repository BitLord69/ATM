import { auth } from "../../../lib/auth";
import { buildUniqueTournamentSlug } from "../../utils/tournament-slug";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const query = getQuery(event);
  const name = String(query.name || "").trim();

  if (!name) {
    throw createError({
      statusCode: 400,
      message: "name query parameter is required",
    });
  }

  const rawExcludeId = query.excludeTournamentId;
  const excludeTournamentId = rawExcludeId != null
    ? Number(rawExcludeId)
    : undefined;

  const slug = await buildUniqueTournamentSlug(name, Number.isFinite(excludeTournamentId) ? excludeTournamentId : undefined);

  return { slug };
});
