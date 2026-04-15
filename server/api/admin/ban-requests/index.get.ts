import { and, desc, eq, inArray } from "drizzle-orm";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { banRequest, user } from "../../../../lib/db/schema";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const statusFilter = typeof getQuery(event).status === "string" ? String(getQuery(event).status) : "all";
  const isAdmin = session.user.role === "admin";

  const whereConditions = [];

  if (!isAdmin) {
    whereConditions.push(eq(banRequest.requestedByUserId, session.user.id));
  }

  if (statusFilter !== "all") {
    whereConditions.push(eq(banRequest.status, statusFilter));
  }

  const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const rows = await db
    .select({
      id: banRequest.id,
      targetUserId: banRequest.targetUserId,
      requestedByUserId: banRequest.requestedByUserId,
      reason: banRequest.reason,
      status: banRequest.status,
      decisionNote: banRequest.decisionNote,
      notifyByEmail: banRequest.notifyByEmail,
      requestScopeTournamentIds: banRequest.requestScopeTournamentIds,
      decidedByUserId: banRequest.decidedByUserId,
      decidedAt: banRequest.decidedAt,
      createdAt: banRequest.createdAt,
      updatedAt: banRequest.updatedAt,
    })
    .from(banRequest)
    .where(whereClause)
    .orderBy(desc(banRequest.createdAt));

  const userIds = new Set<string>();
  for (const row of rows) {
    userIds.add(row.targetUserId);
    userIds.add(row.requestedByUserId);
    if (row.decidedByUserId) {
      userIds.add(row.decidedByUserId);
    }
  }

  const users = userIds.size === 0
    ? []
    : await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(inArray(user.id, [...userIds]));

  const userMap = new Map(users.map(u => [u.id, u]));

  return {
    items: rows.map(row => ({
      ...row,
      scopeTournamentIds: (() => {
        if (!row.requestScopeTournamentIds) {
          return [] as number[];
        }

        try {
          const parsed = JSON.parse(row.requestScopeTournamentIds) as unknown;
          if (!Array.isArray(parsed)) {
            return [] as number[];
          }
          return parsed.map(value => Number(value)).filter(value => Number.isFinite(value));
        }
        catch {
          return [] as number[];
        }
      })(),
      targetUser: userMap.get(row.targetUserId) || null,
      requestedByUser: userMap.get(row.requestedByUserId) || null,
      decidedByUser: row.decidedByUserId ? (userMap.get(row.decidedByUserId) || null) : null,
    })),
    permissions: {
      canDecide: isAdmin,
      canCreate: true,
    },
  };
});
