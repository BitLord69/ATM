import nodemailer from "nodemailer";

import env from "../../lib/env";

function createTransporter() {
  return nodemailer.createTransport({
    host: env.BREVO_SMTP_HOST,
    port: env.BREVO_SMTP_PORT,
    secure: false,
    auth: {
      user: env.BREVO_SMTP_USER,
      pass: env.BREVO_SMTP_KEY,
    },
  });
}

export async function sendModerationEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"ATM Tournament" <${env.BREVO_FROM_EMAIL}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}
