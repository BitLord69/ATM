import "dotenv/config";
import { eq } from "drizzle-orm";

import db from "~lib/db";
import { member, organization, tournament, user } from "~lib/db/schema";

type TournamentData = {
  name: string;
  slug: string;
  description: string;
  lat: number;
  long: number;
  startDate: number;
  endDate: number;
  hasGolf: boolean;
  hasAccuracy: boolean;
  hasDistance: boolean;
  hasSCF: boolean;
  hasDiscathon: boolean;
  hasDDC: boolean;
  hasFreestyle: boolean;
};

const tournaments: TournamentData[] = [
  {
    name: "World Overall Championships 2026",
    slug: "woc-2026",
    description: "The premier event showcasing the world's best disc athletes across all disciplines.",
    lat: 52.520008,
    long: 13.404954,
    startDate: new Date("2026-08-10").getTime(),
    endDate: new Date("2026-08-16").getTime(),
    hasGolf: true,
    hasAccuracy: true,
    hasDistance: true,
    hasSCF: true,
    hasDiscathon: false,
    hasDDC: true,
    hasFreestyle: true,
  },
  {
    name: "European Freestyle Championships 2026",
    slug: "efc-2026",
    description: "The annual freestyle showcase featuring creative routines and innovative pair work.",
    lat: 48.856613,
    long: 2.352222,
    startDate: new Date("2026-06-21").getTime(),
    endDate: new Date("2026-06-23").getTime(),
    hasGolf: false,
    hasAccuracy: false,
    hasDistance: false,
    hasSCF: false,
    hasDiscathon: false,
    hasDDC: false,
    hasFreestyle: true,
  },
  {
    name: "North American Distance & Accuracy Open",
    slug: "nadao-2026",
    description: "A classic field events tournament focusing on precision and power throwing.",
    lat: 34.052235,
    long: -118.243683,
    startDate: new Date("2026-05-15").getTime(),
    endDate: new Date("2026-05-17").getTime(),
    hasGolf: false,
    hasAccuracy: true,
    hasDistance: true,
    hasSCF: true,
    hasDiscathon: true,
    hasDDC: false,
    hasFreestyle: false,
  },
];

async function main() {
  console.log("🌱 Seeding tournaments and organizations...");

  // 1. Find or create a seed user (needed for changedBy)
  const existingUsers = await db.select().from(user).where(eq(user.email, "seed@example.com")).limit(1);
  let seedUser = existingUsers[0];

  if (!seedUser) {
    console.log("Creating seed user...");
    const [newUser] = await db.insert(user).values({
      id: crypto.randomUUID(),
      name: "Seed User",
      email: "seed@example.com",
      emailVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      role: "admin",
    }).returning();
    seedUser = newUser;
  }

  console.log(`✓ Seed user: ${seedUser.email} (${seedUser.id})`);

  // 2. Insert tournaments
  for (const t of tournaments) {
    const existingTournaments = await db.select().from(tournament).where(eq(tournament.slug, t.slug)).limit(1);
    let existing = existingTournaments[0];

    if (!existing) {
      const [inserted] = await db.insert(tournament).values({
        ...t,
        changedBy: seedUser.id as any, // Type workaround for text vs int mismatch
        createdAt: Date.now(),
        changedAt: Date.now(),
      }).returning();

      existing = inserted;
      console.log(`✓ Tournament created: ${existing.name} (ID: ${existing.id})`);
    }
    else {
      console.log(`⏭  Tournament "${t.name}" already exists (ID: ${existing.id})`);
    }

    // 3. Register as a better-auth organization
    try {
      const existingOrgs = await db.select().from(organization).where(eq(organization.slug, t.slug)).limit(1);

      if (existingOrgs[0]) {
        console.log(`⏭  Organization "${t.name}" already exists (ID: ${existingOrgs[0].id})`);

        // Check if seed user is already a member
        const existingMembers = await db.select().from(member).where(eq(member.organizationId, existingOrgs[0].id)).where(eq(member.userId, seedUser.id)).limit(1);

        if (!existingMembers[0]) {
          await db.insert(member).values({
            id: crypto.randomUUID(),
            organizationId: existingOrgs[0].id,
            userId: seedUser.id,
            role: "owner",
          });
          console.log(`✓ Seed user added as owner of ${t.name}`);
        }
        continue;
      }

      const [org] = await db.insert(organization).values({
        id: crypto.randomUUID(),
        name: t.name,
        slug: t.slug,
        metadata: JSON.stringify({ tournamentId: existing.id }),
      }).returning();

      console.log(`✓ Organization created: ${org.name} (ID: ${org.id})`);

      // Add seed user as owner of this organization
      await db.insert(member).values({
        id: crypto.randomUUID(),
        organizationId: org.id,
        userId: seedUser.id,
        role: "owner",
      });

      console.log(`✓ Seed user added as owner of ${org.name}`);
    }
    catch (error: any) {
      console.error(`✗ Failed to create organization for ${t.name}:`);
      console.error(error);
    }
  }

  console.log("\n✅ Seeding complete!");
}

main().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
