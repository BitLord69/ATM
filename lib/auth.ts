import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import nodemailer from "nodemailer";

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
        defaultValue: "guest",
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
    },
  },
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: env.AUTH_GITHUB_CLIENT_ID,
      clientSecret: env.AUTH_GITHUB_CLIENT_SECRET,
    },
    facebook: {
      clientId: env.FACEBOOK_CLIENT_ID,
      clientSecret: env.FACEBOOK_CLIENT_SECRET,
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [
    organization({
      async sendInvitationEmail(data) {
        const { email, organization } = data;
        const inviteLink = `${env.BETTER_AUTH_URL}/accept-invite?id=${data.id}`;

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
