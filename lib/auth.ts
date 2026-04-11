import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { and, eq, gt } from "drizzle-orm";
import fs from "node:fs";
import nodemailer from "nodemailer";

import { normalizePersistedUserRole } from "#shared/types/auth";

import db from "./db/index";
import * as schema from "./db/schema";
import env from "./env";

function normalizeOrigin(value?: string): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  }
  catch {
    return null;
  }
}

const trustedOrigins = Array.from(new Set([
  normalizeOrigin(env.BETTER_AUTH_URL),
  "https://atm-eosin.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter((value): value is string => Boolean(value))));

const authBaseURL = normalizeOrigin(env.BETTER_AUTH_URL) ?? env.BETTER_AUTH_URL;

let didLogAuthProviderConfig = false;
function maskClientId(clientId: string): string {
  if (!clientId) {
    return "(missing)";
  }
  if (clientId.length <= 6) {
    return "***";
  }
  return `${clientId.slice(0, 3)}...${clientId.slice(-3)}`;
}

if (!didLogAuthProviderConfig) {
  didLogAuthProviderConfig = true;
  console.warn(
    `[auth] baseURL=${authBaseURL} githubClientId=${maskClientId(env.AUTH_GITHUB_CLIENT_ID)}`,
  );
}

async function hasValidPendingInvitation(email: string) {
  const pendingInvitation = await db
    .select({ id: schema.invitation.id })
    .from(schema.invitation)
    .where(and(
      eq(schema.invitation.email, email),
      eq(schema.invitation.status, "pending"),
      gt(schema.invitation.expiresAt, Date.now()),
    ))
    .limit(1);

  return pendingInvitation.length > 0;
}

async function canCreateSessionForUser(userId: string): Promise<true | "banned" | false> {
  const rows = await db
    .select({
      email: schema.user.email,
      role: schema.user.role,
      banned: schema.user.banned,
    })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user?.email) {
    return false;
  }

  if (user.banned) {
    return "banned";
  }

  // Global admins bypass invitation checks.
  if (normalizePersistedUserRole(user.role) === "admin") {
    return true;
  }

  const membership = await db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(eq(schema.member.userId, userId))
    .limit(1);

  if (membership.length > 0) {
    return true;
  }

  return hasValidPendingInvitation(user.email);
}

// your drizzle instance
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      ...schema,
    },
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        input: true,
        defaultValue: "user",
      },
      country: {
        type: "string",
        required: false,
        input: true,
      },
      distanceUnit: {
        type: "string",
        required: false,
        input: true,
        defaultValue: "km",
      },
      pdgaNumber: {
        type: "string",
        required: false,
        input: true,
      },
      homeClub: {
        type: "string",
        required: false,
        input: true,
      },
      dateOfBirth: {
        type: "string",
        required: false,
        input: true,
      },
      genderCategory: {
        type: "string",
        required: false,
        input: true,
      },
      banned: {
        type: "boolean",
        required: false,
        input: false,
        defaultValue: false,
      },
      forcePasswordChange: {
        type: "boolean",
        required: false,
        input: false,
        defaultValue: false,
      },
    },
  },
  baseURL: authBaseURL,
  trustedOrigins,
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          if (normalizePersistedUserRole(user.role) === "admin") {
            return;
          }

          const email = typeof user.email === "string" ? user.email : "";
          if (!email) {
            return false;
          }

          // Reject if a banned user with the same email exists.
          const bannedUser = await db
            .select({ id: schema.user.id })
            .from(schema.user)
            .where(and(eq(schema.user.email, email), eq(schema.user.banned, true)))
            .limit(1);
          if (bannedUser.length > 0) {
            return false;
          }

          const allowed = await hasValidPendingInvitation(email);
          if (!allowed) {
            return false;
          }
        },
      },
    },
    session: {
      create: {
        async before(session) {
          const userId = typeof session.userId === "string" ? session.userId : "";
          if (!userId) {
            return false;
          }

          const result = await canCreateSessionForUser(userId);
          if (result === "banned") {
            return false;
          }
          if (!result) {
            return false;
          }
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const logMsg = `[${new Date().toISOString()}] 🔑 Sending password reset email to: ${user.email}`;
      console.warn(logMsg);
      fs.appendFileSync("./email-log.txt", `${logMsg}\n`);

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
          to: user.email,
          subject: "Reset your ATM password",
          html: `<p>Hi ${user.name || user.email},</p><p>A password reset was requested for your account.</p><p><a href="${url}">Click here to reset your password.</a></p><p>This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>`,
        });

        const successMsg = `✅ Password reset email sent to: ${user.email}`;
        console.warn(successMsg);
        fs.appendFileSync("./email-log.txt", `${successMsg}\n`);
      }
      catch (error: any) {
        const errorMsg = `❌ Failed to send password reset email to ${user.email}: ${error.message}`;
        console.error(errorMsg);
        fs.appendFileSync("./email-log.txt", `${errorMsg}\n`);
        throw error;
      }
    },
  },
  socialProviders: {
    github: {
      clientId: env.AUTH_GITHUB_CLIENT_ID,
      clientSecret: env.AUTH_GITHUB_CLIENT_SECRET,
      disableImplicitSignUp: true,
    },
    facebook: {
      clientId: env.FACEBOOK_CLIENT_ID,
      clientSecret: env.FACEBOOK_CLIENT_SECRET,
      disableImplicitSignUp: true,
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      disableImplicitSignUp: true,
    },
  },
  plugins: [
    organization({
      async sendInvitationEmail(data) {
        const { email, organization } = data;
        const inviteLink = `${authBaseURL}/accept-invite?id=${data.id}`;

        const logMsg = `[${new Date().toISOString()}] 📧 Attempting to send invitation email to: ${email}`;
        console.warn(logMsg);
        fs.appendFileSync("./email-log.txt", `${logMsg}\n`);

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
          const result = await transporter.sendMail({
            from: `"ATM Tournament" <${env.BREVO_FROM_EMAIL}>`,
            to: email,
            subject: `Join ${organization.name} on ATM!`,
            html: `<p>You have been invited to join <b>${organization.name}</b>.</p><p><a href="${inviteLink}">Click here to accept and join the tournament.</a></p>`,
          });

          // Mark email as sent
          await db
            .update(schema.invitation)
            .set({ emailSentAt: Date.now() })
            .where(eq(schema.invitation.id, data.id));

          const successMsg = `✅ Invitation email sent successfully to: ${email} (ID: ${result.messageId})`;
          console.warn(successMsg);
          fs.appendFileSync("./email-log.txt", `${successMsg}\n`);
        }
        catch (error: any) {
          const errorMsg = `❌ Failed to send invitation email to ${email}: ${error.message}`;
          console.error(errorMsg);
          fs.appendFileSync("./email-log.txt", `${errorMsg}\n`);

          // Mark email as failed
          await db
            .update(schema.invitation)
            .set({ emailError: error.message })
            .where(eq(schema.invitation.id, data.id));

          throw error;
        }
      },
    }),
  ],
});
