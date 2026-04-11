import { and, desc, eq, gt, inArray, lt, or } from "drizzle-orm";

import db from "../../../../lib/db";
import { invitation, organization, user } from "../../../../lib/db/schema";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const statusFilter = typeof query.status === "string" ? query.status : "all";

  const conditions = [];

  if (statusFilter === "pending") {
    conditions.push(
      and(
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, Date.now()),
      ),
    );
  }
  else if (statusFilter === "expired") {
    conditions.push(
      or(
        eq(invitation.status, "accepted"),
        and(eq(invitation.status, "pending"), lt(invitation.expiresAt, Date.now())),
      ),
    );
  }

  const rows = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      emailSentAt: invitation.emailSentAt,
      emailError: invitation.emailError,
      createdAt: invitation.createdAt,
      organizationId: invitation.organizationId,
      organizationName: organization.name,
      inviterId: invitation.inviterId,
    })
    .from(invitation)
    .leftJoin(organization, eq(invitation.organizationId, organization.id))
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .orderBy(desc(invitation.createdAt));

  // Fetch inviter names separately to avoid complex join issues
  const inviterIds = [...new Set(rows.map(r => r.inviterId).filter((id): id is string => !!id))];
  const inviters
    = inviterIds.length > 0
      ? await db
          .select({ id: user.id, name: user.name, email: user.email })
          .from(user)
          .where(inArray(user.id, inviterIds))
      : [];

  const inviterMap = Object.fromEntries(inviters.map(u => [u.id, u]));

  return rows.map(row => ({
    ...row,
    isExpired: row.status === "pending" && row.expiresAt < Date.now(),
    inviter: row.inviterId ? inviterMap[row.inviterId] ?? null : null,
  }));
});
