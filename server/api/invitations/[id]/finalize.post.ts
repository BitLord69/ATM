import { and, eq, gte, isNull, or } from "drizzle-orm";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { invitation, tournament, tournamentMembership, user } from "../../../../lib/db/schema";

const TOURNAMENT_ROLE_LEVEL: Record<string, number> = {
  owner: 5,
  admin: 4,
  td: 3,
  scorer: 2,
  viewer: 1,
};

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const invitationId = getRouterParam(event, "id");
  if (!invitationId) {
    throw createError({ statusCode: 400, message: "Invitation ID required" });
  }

  const [inv] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      organizationId: invitation.organizationId,
      tournamentRole: invitation.tournamentRole,
      globalRoleTarget: invitation.globalRoleTarget,
    })
    .from(invitation)
    .where(eq(invitation.id, invitationId))
    .limit(1);

  if (!inv) {
    throw createError({ statusCode: 404, message: "Invitation not found" });
  }

  if (inv.email.toLowerCase() !== session.user.email.toLowerCase()) {
    throw createError({ statusCode: 403, message: "Invitation email does not match signed-in user" });
  }

  const [targetUser] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!targetUser) {
    throw createError({ statusCode: 404, message: "Signed-in user not found" });
  }

  if (inv.globalRoleTarget === "admin" && targetUser.role !== "admin") {
    await db
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.id, targetUser.id));
  }

  if (!inv.tournamentRole) {
    return { success: true, updatedMemberships: 0 };
  }

  const now = Date.now();

  const tournaments = await db
    .select({ id: tournament.id })
    .from(tournament)
    .where(
      and(
        eq(tournament.organizationId, inv.organizationId),
        isNull(tournament.closedAt),
        or(isNull(tournament.endDate), gte(tournament.endDate, now)),
      ),
    );

  if (tournaments.length === 0) {
    return { success: true, updatedMemberships: 0 };
  }

  let updates = 0;

  for (const t of tournaments) {
    const [existing] = await db
      .select({
        id: tournamentMembership.id,
        role: tournamentMembership.role,
        status: tournamentMembership.status,
      })
      .from(tournamentMembership)
      .where(
        and(
          eq(tournamentMembership.tournamentId, t.id),
          eq(tournamentMembership.userId, targetUser.id),
        ),
      )
      .limit(1);

    if (!existing) {
      await db.insert(tournamentMembership).values({
        id: crypto.randomUUID(),
        tournamentId: t.id,
        userId: targetUser.id,
        organizationId: inv.organizationId,
        role: inv.tournamentRole,
        status: "active",
      });
      updates += 1;
      continue;
    }

    const currentLevel = TOURNAMENT_ROLE_LEVEL[existing.role] ?? 0;
    const targetLevel = TOURNAMENT_ROLE_LEVEL[inv.tournamentRole] ?? 0;

    const shouldUpgradeRole = targetLevel > currentLevel;
    const shouldActivate = existing.status !== "active";

    if (shouldUpgradeRole || shouldActivate) {
      await db
        .update(tournamentMembership)
        .set({
          role: shouldUpgradeRole ? inv.tournamentRole : existing.role,
          status: "active",
        })
        .where(eq(tournamentMembership.id, existing.id));
      updates += 1;
    }
  }

  return { success: true, updatedMemberships: updates };
});
