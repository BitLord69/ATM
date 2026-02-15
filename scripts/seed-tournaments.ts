import "dotenv/config";
import { and, eq } from "drizzle-orm";

import db from "~lib/db";
import { member, organization, tournament, tournamentMembership, user } from "~lib/db/schema";

type TournamentData = {
  name: string;
  slug: string;
  description: string;
  country: string;
  city: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
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
  // PAST TOURNAMENTS
  {
    name: "Winter Indoor Championships 2026",
    slug: "wic-2026",
    description: "Indoor disc golf and freestyle competition held during winter season.",
    country: "Sweden",
    city: "Stockholm",
    contactName: "Lars Andersson",
    contactEmail: "lars.andersson@wic2026.se",
    contactPhone: "+46 8 123 456 78",
    lat: 59.329323,
    long: 18.068581,
    startDate: new Date("2026-01-10").getTime(),
    endDate: new Date("2026-01-12").getTime(),
    hasGolf: true,
    hasAccuracy: true,
    hasDistance: false,
    hasSCF: false,
    hasDiscathon: false,
    hasDDC: false,
    hasFreestyle: true,
  },
  {
    name: "Australian Open 2026",
    slug: "aus-open-2026",
    description: "Summer disc sports festival featuring all disciplines under the Southern sun.",
    country: "Australia",
    city: "Melbourne",
    contactName: "Sarah Thompson",
    contactEmail: "sarah.thompson@ausopen2026.com.au",
    contactPhone: "+61 3 9123 4567",
    lat: -37.813629,
    long: 144.963058,
    startDate: new Date("2026-01-25").getTime(),
    endDate: new Date("2026-01-31").getTime(),
    hasGolf: true,
    hasAccuracy: true,
    hasDistance: true,
    hasSCF: true,
    hasDiscathon: true,
    hasDDC: true,
    hasFreestyle: true,
  },
  // ACTIVE TOURNAMENTS
  {
    name: "Baltic Winter Cup 2026",
    slug: "bwc-2026",
    description: "Traditional mid-winter tournament bringing together Nordic disc athletes.",
    country: "Latvia",
    city: "Riga",
    contactName: "Janis Kalnins",
    contactEmail: "janis.kalnins@bwc2026.lv",
    contactPhone: "+371 2123 4567",
    lat: 56.949649,
    long: 24.105186,
    startDate: new Date("2026-02-13").getTime(),
    endDate: new Date("2026-02-17").getTime(),
    hasGolf: true,
    hasAccuracy: true,
    hasDistance: true,
    hasSCF: true,
    hasDiscathon: false,
    hasDDC: false,
    hasFreestyle: false,
  },
  {
    name: "Desert Disc Challenge 2026",
    slug: "ddc-2026",
    description: "Unique desert environment tournament testing skills in extreme conditions.",
    country: "UAE",
    city: "Dubai",
    contactName: "Ahmed Al-Mansoori",
    contactEmail: "ahmed.almansoori@ddc2026.ae",
    contactPhone: "+971 4 123 4567",
    lat: 25.276987,
    long: 55.296249,
    startDate: new Date("2026-02-14").getTime(),
    endDate: new Date("2026-02-16").getTime(),
    hasGolf: true,
    hasAccuracy: true,
    hasDistance: true,
    hasSCF: false,
    hasDiscathon: false,
    hasDDC: true,
    hasFreestyle: false,
  },
  // FUTURE TOURNAMENTS
  {
    name: "Spring Classic 2026",
    slug: "spring-classic-2026",
    description: "Traditional spring opener featuring disc golf and field events.",
    country: "Netherlands",
    city: "Amsterdam",
    contactName: "Peter van der Berg",
    contactEmail: "peter.vandenberg@springclassic2026.nl",
    contactPhone: "+31 20 123 4567",
    lat: 52.370216,
    long: 4.895168,
    startDate: new Date("2026-04-05").getTime(),
    endDate: new Date("2026-04-07").getTime(),
    hasGolf: true,
    hasAccuracy: true,
    hasDistance: true,
    hasSCF: true,
    hasDiscathon: false,
    hasDDC: false,
    hasFreestyle: false,
  },
  {
    name: "North American Distance & Accuracy Open",
    slug: "nadao-2026",
    description: "A classic field events tournament focusing on precision and power throwing.",
    country: "USA",
    city: "Los Angeles",
    contactName: "John Martinez",
    contactEmail: "john.martinez@nadao2026.com",
    contactPhone: "+1 213 555-0123",
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
  {
    name: "European Freestyle Championships 2026",
    slug: "efc-2026",
    description: "The annual freestyle showcase featuring creative routines and innovative pair work.",
    country: "France",
    city: "Paris",
    contactName: "Marie Dubois",
    contactEmail: "marie.dubois@efc2026.fr",
    contactPhone: "+33 1 23456789",
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
    name: "Asia Pacific Championships 2026",
    slug: "apc-2026",
    description: "Major championship showcasing the growing disc sports scene in Asia Pacific.",
    country: "Japan",
    city: "Tokyo",
    contactName: "Yuki Tanaka",
    contactEmail: "yuki.tanaka@apc2026.jp",
    contactPhone: "+81 3 1234 5678",
    lat: 35.689487,
    long: 139.691711,
    startDate: new Date("2026-07-10").getTime(),
    endDate: new Date("2026-07-15").getTime(),
    hasGolf: true,
    hasAccuracy: true,
    hasDistance: true,
    hasSCF: true,
    hasDiscathon: false,
    hasDDC: true,
    hasFreestyle: true,
  },
  {
    name: "World Overall Championships 2026",
    slug: "woc-2026",
    description: "The premier event showcasing the world's best disc athletes across all disciplines.",
    country: "Germany",
    city: "Berlin",
    contactName: "Hans Schmidt",
    contactEmail: "hans.schmidt@woc2026.org",
    contactPhone: "+49 30 12345678",
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
    name: "Canadian Open 2026",
    slug: "can-open-2026",
    description: "Premier Canadian tournament featuring all disc disciplines with mountain views.",
    country: "Canada",
    city: "Vancouver",
    contactName: "Emily Chen",
    contactEmail: "emily.chen@canopen2026.ca",
    contactPhone: "+1 604 555-0199",
    lat: 49.282729,
    long: -123.120738,
    startDate: new Date("2026-09-18").getTime(),
    endDate: new Date("2026-09-22").getTime(),
    hasGolf: true,
    hasAccuracy: true,
    hasDistance: true,
    hasSCF: true,
    hasDiscathon: false,
    hasDDC: false,
    hasFreestyle: true,
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

  // 2. Insert tournaments with organizations and memberships
  for (const t of tournaments) {
    // 2a. Create or find organization first
    const existingOrgs = await db.select().from(organization).where(eq(organization.slug, t.slug)).limit(1);
    let org = existingOrgs[0];

    if (!org) {
      const [newOrg] = await db.insert(organization).values({
        id: crypto.randomUUID(),
        name: t.name,
        slug: t.slug,
      }).returning();
      org = newOrg;
      console.log(`✓ Organization created: ${org.name} (ID: ${org.id})`);
    }
    else {
      console.log(`⏭  Organization "${t.name}" already exists (ID: ${org.id})`);
    }

    // 2b. Add seed user as organization member if not already
    const existingMembers = await db.select().from(member).where(eq(member.organizationId, org.id)).where(eq(member.userId, seedUser.id)).limit(1);

    if (!existingMembers[0]) {
      await db.insert(member).values({
        id: crypto.randomUUID(),
        organizationId: org.id,
        userId: seedUser.id,
        role: "owner",
      });
      console.log(`✓ Seed user added as organization member of ${t.name}`);
    }

    // 2c. Create or find tournament linked to organization
    const existingTournaments = await db.select().from(tournament).where(eq(tournament.slug, t.slug)).limit(1);
    let existingTournament = existingTournaments[0];

    if (!existingTournament) {
      const [inserted] = await db.insert(tournament).values({
        ...t,
        organizationId: org.id,
        contactUserId: seedUser.id, // Link contact to seed user
        changedBy: seedUser.id as any,
        createdAt: Date.now(),
        changedAt: Date.now(),
      }).returning();

      existingTournament = inserted;
      console.log(`✓ Tournament created: ${existingTournament.name} (ID: ${existingTournament.id})`);
    }
    else {
      console.log(`⏭  Tournament "${t.name}" already exists (ID: ${existingTournament.id})`);

      // Update organizationId if it's missing
      if (!existingTournament.organizationId) {
        await db.update(tournament).set({ organizationId: org.id }).where(eq(tournament.id, existingTournament.id));
        console.log(`✓ Linked tournament ${t.name} to organization`);
      }
    }

    // 2d. Create tournament membership for seed user as TD
    const existingMemberships = await db.select().from(tournamentMembership).where(eq(tournamentMembership.tournamentId, existingTournament.id)).where(eq(tournamentMembership.userId, seedUser.id)).limit(1);

    if (!existingMemberships[0]) {
      await db.insert(tournamentMembership).values({
        id: crypto.randomUUID(),
        tournamentId: existingTournament.id,
        userId: seedUser.id,
        organizationId: org.id,
        role: "td",
        status: "active",
      });
      console.log(`✓ Seed user added as TD for tournament ${t.name}`);
    }
    else {
      console.log(`⏭  Tournament membership already exists for ${t.name}`);
    }
  }

  // 3. Add janis_k user as member of tournaments with different roles
  console.log("\n🎲 Adding janis_k to tournaments with various roles...");
  const janisUsers = await db.select().from(user).where(eq(user.email, "janis_k@hotmail.com")).limit(1);

  if (janisUsers.length > 0) {
    const janisUser = janisUsers[0];
    console.log(`✓ Found user: ${janisUser.email} (${janisUser.id})`);

    // Define roles for different tournaments (using slug as key)
    const janisRoles: Record<string, "owner" | "admin" | "td" | "scorer" | "viewer"> = {
      "wic-2026": "viewer", // Past - viewer role
      "aus-open-2026": "scorer", // Past - scorer role
      "bwc-2026": "owner", // Active - owner role
      "ddc-2026": "admin", // Active - admin role
      "spring-classic-2026": "td", // Future - TD role
      "nadao-2026": "admin", // Future - admin role
      "efc-2026": "scorer", // Future - scorer role
      "apc-2026": "viewer", // Future - viewer role
      "woc-2026": "td", // Future - TD role
      "can-open-2026": "admin", // Future - admin role
    };

    for (const [slug, role] of Object.entries(janisRoles)) {
      // Find the tournament
      const tournamentResults = await db.select().from(tournament).where(eq(tournament.slug, slug)).limit(1);
      if (tournamentResults.length === 0) {
        console.log(`⚠  Tournament ${slug} not found, skipping...`);
        continue;
      }

      const tournamentRecord = tournamentResults[0];

      // Delete any existing membership for this user and tournament
      await db.delete(tournamentMembership)
        .where(and(
          eq(tournamentMembership.tournamentId, tournamentRecord.id),
          eq(tournamentMembership.userId, janisUser.id),
        ));

      // Create fresh membership with specified role
      await db.insert(tournamentMembership).values({
        id: crypto.randomUUID(),
        tournamentId: tournamentRecord.id,
        userId: janisUser.id,
        organizationId: tournamentRecord.organizationId,
        role,
        status: "active",
      });
      console.log(`✓ Added janis_k as ${role} for ${tournamentRecord.name}`);
    }
  }
  else {
    console.log("⚠  User janis_k not found, skipping tournament memberships");
  }

  console.log("\n✅ Seeding complete!");
}

main().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
