import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";

import db from "../../../../lib/db";
import { invitation, organization } from "../../../../lib/db/schema";
import env from "../../../../lib/env";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Invitation ID required",
    });
  }

  const [invite] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      organizationId: invitation.organizationId,
      status: invitation.status,
    })
    .from(invitation)
    .where(eq(invitation.id, id))
    .limit(1);

  if (!invite) {
    throw createError({
      statusCode: 404,
      message: "Invitation not found",
    });
  }

  if (invite.status !== "pending") {
    throw createError({
      statusCode: 400,
      message: "Cannot resend accepted or expired invitation",
    });
  }

  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, invite.organizationId))
    .limit(1);

  const inviteLink = `${env.BETTER_AUTH_URL}/accept-invite?id=${invite.id}`;

  const transporter = nodemailer.createTransport({
    host: env.BREVO_SMTP_HOST,
    port: env.BREVO_SMTP_PORT,
    secure: false,
    auth: {
      user: env.BREVO_SMTP_USER,
      pass: env.BREVO_SMTP_KEY,
    },
  });

  try {
    await transporter.sendMail({
      from: `"ATM Tournament" <${env.BREVO_FROM_EMAIL}>`,
      to: invite.email,
      subject: `Join ${org?.name || "ATM"} - Invitation Reminder`,
      html: `<p>You have been invited to join <b>${org?.name || "our organization"}</b>.</p><p><a href="${inviteLink}">Click here to accept and join the tournament.</a></p>`,
    });

    // Update emailSentAt to track the resend
    await db
      .update(invitation)
      .set({ emailSentAt: Date.now(), emailError: null })
      .where(eq(invitation.id, invite.id));

    return { success: true };
  }
  catch (error: any) {
    // Mark email as failed
    await db
      .update(invitation)
      .set({ emailError: error.message })
      .where(eq(invitation.id, invite.id));

    throw createError({
      statusCode: 500,
      message: `Failed to resend invitation: ${error.message}`,
    });
  }
});
