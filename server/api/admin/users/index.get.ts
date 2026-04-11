import { and, asc, count, desc, eq, exists, inArray, or, sql } from "drizzle-orm";

import { normalizePersistedUserRole, USER_ROLES } from "#shared/types/auth";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { eventEntry, player, tournament, tournamentMembership, user } from "../../../../lib/db/schema";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const roleFilter = typeof query.role === "string" ? query.role.trim() : "all";
  const statusFilter = typeof query.status === "string" ? query.status.trim() : "all";
  const sortBy = typeof query.sortBy === "string" ? query.sortBy.trim() : "createdAt";
  const sortDir = query.sortDir === "asc" ? "asc" : "desc";

  const requestedPage = Number.parseInt(typeof query.page === "string" ? query.page : "1", 10);
  const requestedPageSize = Number.parseInt(typeof query.pageSize === "string" ? query.pageSize : "25", 10);

  const page = Number.isNaN(requestedPage) || requestedPage < 1 ? 1 : requestedPage;
  const pageSize = Number.isNaN(requestedPageSize)
    ? 25
    : Math.min(Math.max(requestedPageSize, 10), 100);

  const session = await auth.api.getSession({ headers: event.headers });

  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const isAdmin = session.user.role === "admin";

  let tdTournamentIds: number[] = [];
  let scopedTournaments: Array<{ id: number; name: string; slug: string }> = [];

  if (!isAdmin) {
    const tdTournamentRows = await db
      .select({ tournamentId: tournamentMembership.tournamentId })
      .from(tournamentMembership)
      .where(
        and(
          eq(tournamentMembership.userId, session.user.id),
          eq(tournamentMembership.role, "td"),
          eq(tournamentMembership.status, "active"),
        ),
      );

    tdTournamentIds = [...new Set(tdTournamentRows.map(row => row.tournamentId))];

    if (tdTournamentIds.length === 0) {
      throw createError({ statusCode: 403, message: "Forbidden" });
    }

    if (tdTournamentIds.length > 0) {
      scopedTournaments = await db
        .select({ id: tournament.id, name: tournament.name, slug: tournament.slug })
        .from(tournament)
        .where(inArray(tournament.id, tdTournamentIds))
        .orderBy(asc(tournament.name));
    }
  }

  const conditions = [];

  if (search) {
    const loweredSearch = search.toLowerCase();
    conditions.push(
      or(
        sql`lower(${user.name}) like ${`%${loweredSearch}%`}`,
        sql`lower(${user.email}) like ${`%${loweredSearch}%`}`,
      ),
    );
  }

  if (roleFilter !== "all") {
    if (!USER_ROLES.includes(roleFilter as any)) {
      throw createError({ statusCode: 400, message: "Invalid role filter" });
    }
    conditions.push(eq(user.role, roleFilter as any));
  }

  if (statusFilter === "active") {
    conditions.push(eq(user.banned, false));
  }
  else if (statusFilter === "banned") {
    conditions.push(eq(user.banned, true));
  }

  if (!isAdmin) {
    const scopedUsersByMembershipSubquery = db
      .select({ one: sql`1` })
      .from(tournamentMembership)
      .where(
        and(
          eq(tournamentMembership.userId, user.id),
          eq(tournamentMembership.status, "active"),
          inArray(tournamentMembership.tournamentId, tdTournamentIds),
        ),
      )
      .limit(1);

    const scopedUsersByEntriesSubquery = db
      .select({ one: sql`1` })
      .from(player)
      .innerJoin(eventEntry, eq(eventEntry.playerId, player.id))
      .where(
        and(
          eq(player.userId, user.id),
          inArray(eventEntry.tournamentId, tdTournamentIds),
        ),
      )
      .limit(1);

    conditions.push(
      or(
        exists(scopedUsersByMembershipSubquery),
        exists(scopedUsersByEntriesSubquery),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orderByClause = (() => {
    if (sortBy === "name") {
      return sortDir === "asc" ? asc(user.name) : desc(user.name);
    }

    if (sortBy === "email") {
      return sortDir === "asc" ? asc(user.email) : desc(user.email);
    }

    if (sortBy === "role") {
      return sortDir === "asc" ? asc(user.role) : desc(user.role);
    }

    return sortDir === "asc" ? asc(user.createdAt) : desc(user.createdAt);
  })();

  const totalRows = await db
    .select({ total: count() })
    .from(user)
    .where(whereClause);
  const total = totalRows[0]?.total ?? 0;

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
  const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1;
  const offset = (safePage - 1) * pageSize;

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      bannedAt: user.bannedAt,
      banReason: user.banReason,
      forcePasswordChange: user.forcePasswordChange,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(whereClause)
    .orderBy(orderByClause)
    .limit(pageSize)
    .offset(offset);

  return {
    items: rows.map(row => ({
      ...row,
      role: normalizePersistedUserRole(row.role),
    })),
    page: safePage,
    pageSize,
    total,
    totalPages,
    permissions: {
      canDeleteUsers: isAdmin,
      canBanUsers: isAdmin,
      canSendPasswordReset: isAdmin,
    },
    scope: isAdmin
      ? {
          type: "admin",
          tournamentCount: null,
          tournaments: null,
        }
      : {
          type: "td",
          tournamentCount: tdTournamentIds.length,
          tournaments: scopedTournaments,
        },
  };
});
