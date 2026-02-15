import "dotenv/config";
import nodemailer from "nodemailer";

import env from "~lib/env";

async function testBrevo() {
  console.log("🧪 Testing Brevo SMTP connection...\n");

  console.log("Configuration:");
  console.log(`  BREVO_SMTP_HOST: ${env.BREVO_SMTP_HOST}`);
  console.log(`  BREVO_SMTP_PORT: ${env.BREVO_SMTP_PORT}`);
  console.log(`  BREVO_SMTP_USER: ${env.BREVO_SMTP_USER}`);
  console.log(`  BREVO_SMTP_KEY: ${env.BREVO_SMTP_KEY ? `[REDACTED - ${env.BREVO_SMTP_KEY.length} chars]` : "NOT SET"}`);
  console.log(`  BREVO_FROM_EMAIL: ${env.BREVO_FROM_EMAIL}\n`);

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
    console.log("📡 Testing connection...");
    await transporter.verify();
    console.log("✅ Brevo SMTP connection successful!");

    console.log("\n📧 Sending test email...");
    const result = await transporter.sendMail({
      from: `"ATM Tournament Test" <${env.BREVO_FROM_EMAIL}>`,
      to: env.BREVO_FROM_EMAIL,
      subject: "Test Email from ATM",
      text: "If you see this, Brevo SMTP is working!",
    });

    console.log("✅ Test email sent successfully!");
    console.log(`   Message ID: ${result.messageId}`);
    console.log("\n✨ Brevo is configured correctly!");
  }
  catch (error: any) {
    console.error("\n❌ Brevo test failed:");
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    if (error.responseCode) {
      console.error(`   Response Code: ${error.responseCode}`);
    }
  }
}

testBrevo();
