import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";

import db from "~lib/db";
import { member, organization, user } from "~lib/db/schema";

async function main() {
  console.log("🔧 Adding current user as admin to all organizations...");

  // Find your GitHub user by email or name
  const email = process.argv[2];
  if (!email) {
    console.log("Available users:");
    const allUsers = await db.select({ id: user.id, email: user.email, name: user.name }).from(user);
    allUsers.forEach(u => console.log(`  - ${u.name} (${u.email}) [ID: ${u.id}]`));
    console.error("\n❌ Please provide your email: pnpm exec tsx scripts/add-admin.ts your@email.com");
    process.exit(1);
  }

  const users = await db.select().from(user).where(
    sql`lower(${user.email}) = lower(${email})`,
  ).limit(1);

  const currentUser = users[0];

  if (!currentUser) {
    console.error(`❌ User with email ${email} not found.`);
    console.log("\nAvailable users:");
    const allUsers = await db.select({ email: user.email, name: user.name }).from(user);
    allUsers.forEach(u => console.log(`  - ${u.name} (${u.email})`));
    process.exit(1);
  }

  console.log(`✓ Found user: ${currentUser.name} (${currentUser.email})`);

  // Get all organizations
  const orgs = await db.select().from(organization);

  for (const org of orgs) {
    // Check if already a member
    const existingMembers = await db.select().from(member).where(and(
      eq(member.organizationId, org.id),
      eq(member.userId, currentUser.id),
    )).limit(1);

    if (existingMembers[0]) {
      console.log(`⏭  Already a member of ${org.name}`);
      continue;
    }

    // Add as owner
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      userId: currentUser.id,
      role: "owner",
    });

    console.log(`✓ Added as owner of ${org.name}`);
  }

  console.log("\n✅ Done!");
}

main().catch((error) => {
  console.error("❌ Failed:", error);
  process.exit(1);
});
