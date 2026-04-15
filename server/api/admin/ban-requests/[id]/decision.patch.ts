import { and, eq } from "drizzle-orm";

import { auth } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { adminNotification, banRequest, user } from "../../../../../lib/db/schema";
import { sendModerationEmail } from "../../../../utils/moderation-email";
import { getBanRequestEmailEnabled } from "../../../../utils/moderation-settings";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  if (session.user.role !== "admin") {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const requestId = getRouterParam(event, "id");
  if (!requestId) {
    throw createError({ statusCode: 400, message: "Request id required" });
  }

  const body = await readBody<{ decision?: "approved" | "rejected"; note?: string }>(event);
  const decision = body.decision;
  const note = String(body.note || "").trim();

  if (decision !== "approved" && decision !== "rejected") {
    throw createError({ statusCode: 400, message: "decision must be approved or rejected" });
  }

  const [requestRow] = await db
    .select({
      id: banRequest.id,
      targetUserId: banRequest.targetUserId,
      requestedByUserId: banRequest.requestedByUserId,
      reason: banRequest.reason,
      status: banRequest.status,
      notifyByEmail: banRequest.notifyByEmail,
    })
    .from(banRequest)
    .where(eq(banRequest.id, requestId))
    .limit(1);

  if (!requestRow) {
    throw createError({ statusCode: 404, message: "Ban request not found" });
  }

  if (requestRow.status !== "pending") {
    throw createError({ statusCode: 409, message: "Only pending requests can be decided." });
  }

  const now = Date.now();

  await db
    .update(banRequest)
    .set({
      status: decision,
      decisionNote: note || null,
      decidedByUserId: session.user.id,
      decidedAt: now,
      updatedAt: now,
    })
    .where(and(eq(banRequest.id, requestId), eq(banRequest.status, "pending")));

  if (decision === "approved") {
    await db
      .update(user)
      .set({
        banned: true,
        bannedAt: now,
        banReason: note || requestRow.reason,
      })
      .where(eq(user.id, requestRow.targetUserId));
  }

  await db.insert(adminNotification).values({
    id: crypto.randomUUID(),
    recipientUserId: requestRow.requestedByUserId,
    type: "ban_request_decided",
    title: `Ban request ${decision}`,
    body: decision === "approved"
      ? "Your ban request was approved and the user has been banned."
      : "Your ban request was rejected.",
    link: "/admin/ban-requests",
    metadata: JSON.stringify({ requestId }),
    createdAt: now,
  });

  const emailEnabled = await getBanRequestEmailEnabled();
  if (emailEnabled && requestRow.notifyByEmail) {
    const [requester] = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, requestRow.requestedByUserId))
      .limit(1);

    if (requester?.email) {
      try {
        await sendModerationEmail({
          to: requester.email,
          subject: `ATM: Ban request ${decision}`,
          html: `<p>Hello ${requester.name || requester.email},</p><p>Your ban request has been <b>${decision}</b>.</p><p>${note || "No additional note provided."}</p>`,
        });
      }
      catch (error) {
        console.warn("[ban-request] Failed to send decision email", error);
      }
    }
  }

  return { success: true };
});
