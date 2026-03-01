import "dotenv/config";
import { eq } from "drizzle-orm";

import db from "~lib/db";
import { member, organization, user } from "~lib/db/schema";

async function main() {
  console.log("🔍 Checking organization memberships...\n");

  // Get all users
  const users = await db.select({ id: user.id, email: user.email, name: user.name }).from(user);

  console.log(`Users in database:`);
  users.forEach(u => console.log(`  - ${u.name} (${u.email}) [${u.id}]`));

  console.log("\n---\n");

  // Get all organizations
  const orgs = await db.select().from(organization);

  console.log(`Organizations:`);
  for (const org of orgs) {
    console.log(`\n📁 ${org.name} (${org.id})`);

    // Get members of this org
    const members = await db.select({
      userId: member.userId,
      role: member.role,
      userName: user.name,
      userEmail: user.email,
    })
      .from(member)
      .leftJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, org.id));

    if (members.length === 0) {
      console.log("   ⚠️  No members!");
    }
    else {
      members.forEach((m) => {
        console.log(`   ✓ ${m.userName} (${m.userEmail}) - ${m.role}`);
      });
    }
  }
}

main().catch((error) => {
  console.error("❌ Failed:", error);
  process.exit(1);
});
