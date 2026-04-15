import { and, eq, inArray } from "drizzle-orm";

import { auth } from "../../../../lib/auth";
import db from "../../../../lib/db";
import { adminNotification, banRequest, tournament, user } from "../../../../lib/db/schema";
import { canTournamentAdminAccessUser, getTournamentAdminScopeTournamentIds } from "../../../utils/admin-scope";
import { sendModerationEmail } from "../../../utils/moderation-email";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const body = await readBody<{ targetUserId?: string; reason?: string; notifyByEmail?: boolean }>(event);
  const targetUserId = String(body.targetUserId || "").trim();
  const reason = String(body.reason || "").trim();
  const notifyByEmail = body.notifyByEmail === true;

  if (!targetUserId) {
    throw createError({ statusCode: 400, message: "targetUserId is required" });
  }

  if (reason.length < 10) {
    throw createError({ statusCode: 400, message: "Please provide a reason of at least 10 characters." });
  }

  const isAdmin = session.user.role === "admin";

  const [targetUser] = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    throw createError({ statusCode: 404, message: "Target user not found" });
  }

  let scopedTournamentIds: number[] = [];
  if (!isAdmin) {
    scopedTournamentIds = await getTournamentAdminScopeTournamentIds(session.user.id);
    if (scopedTournamentIds.length === 0) {
      throw createError({ statusCode: 403, message: "Forbidden" });
    }

    const canAccessTargetUser = await canTournamentAdminAccessUser(targetUserId, scopedTournamentIds);
    if (!canAccessTargetUser) {
      throw createError({ statusCode: 403, message: "You can only request bans for users in your tournament scope." });
    }
  }

  const [existingPending] = await db
    .select({ id: banRequest.id })
    .from(banRequest)
    .where(
      and(
        eq(banRequest.targetUserId, targetUserId),
        eq(banRequest.requestedByUserId, session.user.id),
        eq(banRequest.status, "pending"),
      ),
    )
    .limit(1);

  if (existingPending) {
    throw createError({ statusCode: 409, message: "You already have a pending ban request for this user." });
  }

  const now = Date.now();
  const requestId = crypto.randomUUID();

  const emailEnabledByTournament = scopedTournamentIds.length === 0
    ? true
    : (await db
        .select({ id: tournament.id })
        .from(tournament)
        .where(
          and(
            inArray(tournament.id, scopedTournamentIds),
            eq(tournament.banRequestEmailEnabled, true),
          ),
        )
        .limit(1)).length > 0;

  await db.insert(banRequest).values({
    id: requestId,
    targetUserId,
    requestedByUserId: session.user.id,
    reason,
    status: "pending",
    notifyByEmail,
    requestScopeTournamentIds: scopedTournamentIds.length > 0 ? JSON.stringify(scopedTournamentIds) : null,
    createdAt: now,
    updatedAt: now,
  });

  const adminUsers = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(eq(user.role, "admin"));

  if (adminUsers.length > 0) {
    await db.insert(adminNotification).values(
      adminUsers.map(admin => ({
        id: crypto.randomUUID(),
        recipientUserId: admin.id,
        type: "ban_request_created",
        title: "New ban request",
        body: `${session.user.email} requested a ban review for ${targetUser.email}`,
        link: "/admin/ban-requests",
        metadata: JSON.stringify({ requestId }),
        createdAt: now,
      })),
    );
  }

  if (notifyByEmail && emailEnabledByTournament && adminUsers.length > 0) {
    await Promise.all(
      adminUsers.map(async (admin) => {
        try {
          await sendModerationEmail({
            to: admin.email,
            subject: "ATM: New ban request requires review",
            html: `<p>Hello ${admin.name || admin.email},</p><p>A new ban request has been created for <b>${targetUser.email}</b>.</p><p>Reason: ${reason}</p><p>Open User Workspace to review it.</p>`,
          });
        }
        catch (error) {
          console.warn("[ban-request] Failed to send email", error);
        }
      }),
    );
  }

  return { success: true, id: requestId };
});
