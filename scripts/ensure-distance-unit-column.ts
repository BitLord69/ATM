import { createClient } from "@libsql/client";
import "dotenv/config";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;

  if (!url) {
    throw new Error("Missing TURSO_DATABASE_URL");
  }

  const db = createClient({ url });

  const before = await db.execute("PRAGMA table_info(user)");
  const hasDistanceUnit = before.rows.some(row => row.name === "distance_unit");

  if (!hasDistanceUnit) {
    await db.execute("ALTER TABLE user ADD COLUMN distance_unit TEXT NOT NULL DEFAULT 'km'");
    console.log("Added user.distance_unit column");
  }
  else {
    console.log("user.distance_unit column already exists");
  }

  const after = await db.execute("PRAGMA table_info(user)");
  console.log(JSON.stringify(after.rows, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
