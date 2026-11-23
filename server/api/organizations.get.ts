import { and, asc, eq, exists } from "drizzle-orm";

import { auth } from "../../lib/auth";
import db from "../../lib/db";
import { organization, tournamentMembership } from "../../lib/db/schema";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const isAdmin = session.user.role === "admin";

  const orgs = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    })
    .from(organization)
    .where(
      isAdmin
        ? undefined
        : exists(
            db
              .select({ id: tournamentMembership.id })
              .from(tournamentMembership)
              .where(
                and(
                  eq(tournamentMembership.organizationId, organization.id),
                  eq(tournamentMembership.userId, session.user.id),
                  eq(tournamentMembership.status, "active"),
                ),
              ),
          ),
    )
    .orderBy(asc(organization.name));

  return orgs;
});
