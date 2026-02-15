import "dotenv/config";

import db from "~lib/db";
import { invitation } from "~lib/db/schema";

async function main() {
  console.log("🧹 Cleaning up pending invitations...");

  const invitations = await db.select().from(invitation);

  console.log(`Found ${invitations.length} invitation(s):`);
  invitations.forEach((inv) => {
    console.log(`  - ${inv.email} (${inv.status}) - Org: ${inv.organizationId}`);
  });

  if (invitations.length === 0) {
    console.log("✅ No invitations to clean up!");
    return;
  }

  await db.delete(invitation);

  console.log(`✅ Deleted ${invitations.length} invitation(s)`);
}

main().catch((error) => {
  console.error("❌ Failed:", error);
  process.exit(1);
});
