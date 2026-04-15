import { and, eq, exists, inArray, or, sql } from "drizzle-orm";

import db from "../../lib/db";
import {
  eventEntry,
  player,
  tournamentMembership,
  user,
} from "../../lib/db/schema";

export async function getTournamentAdminScopeTournamentIds(currentUserId: string) {
  const rows = await db
    .select({ tournamentId: tournamentMembership.tournamentId })
    .from(tournamentMembership)
    .where(
      and(
        eq(tournamentMembership.userId, currentUserId),
        or(
          eq(tournamentMembership.role, "owner"),
          eq(tournamentMembership.role, "admin"),
          eq(tournamentMembership.role, "td"),
        ),
        eq(tournamentMembership.status, "active"),
      ),
    );

  return [...new Set(rows.map(row => row.tournamentId))];
}

export async function canTournamentAdminAccessUser(targetUserId: string, scopedTournamentIds: number[]) {
  if (scopedTournamentIds.length === 0) {
    return false;
  }

  const scopedUsersByMembershipSubquery = db
    .select({ one: sql`1` })
    .from(tournamentMembership)
    .where(
      and(
        eq(tournamentMembership.userId, targetUserId),
        eq(tournamentMembership.status, "active"),
        inArray(tournamentMembership.tournamentId, scopedTournamentIds),
      ),
    )
    .limit(1);

  const scopedUsersByEntriesSubquery = db
    .select({ one: sql`1` })
    .from(player)
    .innerJoin(eventEntry, eq(eventEntry.playerId, player.id))
    .where(
      and(
        eq(player.userId, targetUserId),
        inArray(eventEntry.tournamentId, scopedTournamentIds),
      ),
    )
    .limit(1);

  const visibleRows = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(user.id, targetUserId),
        sql`${exists(scopedUsersByMembershipSubquery)} OR ${exists(scopedUsersByEntriesSubquery)}`,
      ),
    )
    .limit(1);

  return visibleRows.length > 0;
}
