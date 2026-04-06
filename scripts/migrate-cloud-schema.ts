import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@libsql/client";
import { parse } from "dotenv";

type Journal = {
  entries: Array<{
    idx: number;
    tag: string;
  }>;
};

function parseEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return {};
  }

  return parse(readFileSync(filePath, "utf8"));
}

function required(values: Record<string, string>, key: string) {
  const value = values[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required value for ${key}.`);
  }
  return value;
}

function normalizeTursoToken(token: string) {
  const prefix = "TURSO_AUTH_TOKEN=";
  if (token.startsWith(prefix)) {
    console.warn("Detected duplicated TURSO_AUTH_TOKEN= prefix in token value; auto-correcting.");
    return token.slice(prefix.length);
  }
  return token;
}

function validateCloud(values: Record<string, string>) {
  const url = required(values, "TURSO_DATABASE_URL");
  const token = normalizeTursoToken(required(values, "TURSO_AUTH_TOKEN"));

  if (/localhost|127\.0\.0\.1/i.test(url)) {
    throw new Error("TURSO_DATABASE_URL points to localhost. Put remote URL in .env.cloud.");
  }

  if (token.trim().length < 8) {
    throw new Error("TURSO_AUTH_TOKEN appears invalid/too short.");
  }
}

function formatError(error: unknown) {
  if (!error) {
    return "Unknown error";
  }

  if (error instanceof Error) {
    const cause = (error as any).cause;
    if (cause && cause.message) {
      return `${error.message} | cause: ${cause.message}`;
    }
    return error.message;
  }

  return String(error);
}

function isIgnorableMigrationError(error: unknown) {
  const message = formatError(error).toLowerCase();

  return message.includes("duplicate column name")
    || message.includes("already exists")
    || message.includes("duplicate table name");
}

function splitStatements(sqlText: string) {
  const fromBreakpoints = sqlText
    .split("--> statement-breakpoint")
    .map(statement => statement.trim())
    .filter(Boolean);

  const result: string[] = [];

  for (const chunk of fromBreakpoints) {
    const semicolonParts = chunk
      .split(";")
      .map(statement => statement.trim())
      .filter(Boolean)
      .map(statement => `${statement};`);

    if (semicolonParts.length > 0) {
      result.push(...semicolonParts);
    }
  }

  return result;
}

async function main() {
  const merged = {
    ...parseEnvFile(".env"),
    ...parseEnvFile(".env.cloud"),
  } as Record<string, string>;

  merged.TURSO_AUTH_TOKEN = normalizeTursoToken(merged.TURSO_AUTH_TOKEN || "");

  validateCloud(merged);

  console.log("Running cloud schema migration...");
  console.log(`TURSO_DATABASE_URL: ${merged.TURSO_DATABASE_URL}`);

  const migrationsDir = resolve("lib/db/migrations");
  const journalPath = resolve(migrationsDir, "meta", "_journal.json");

  if (!existsSync(journalPath)) {
    throw new Error(`Migration journal not found: ${journalPath}`);
  }

  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;

  const db = createClient({
    url: merged.TURSO_DATABASE_URL,
    authToken: merged.TURSO_AUTH_TOKEN,
  });

  console.log("Ensuring migration metadata table...");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      "id" integer PRIMARY KEY,
      "hash" text NOT NULL,
      "created_at" numeric
    )
  `);

  console.log("Reading applied migrations...");
  const appliedRows = await db.execute(`SELECT hash FROM "__drizzle_migrations"`);
  const appliedHashes = new Set(appliedRows.rows.map(row => String(row.hash)));

  let appliedCount = 0;
  let skippedCount = 0;

  const orderedEntries = [...journal.entries].sort((left, right) => left.idx - right.idx);

  for (const entry of orderedEntries) {
    const sqlPath = resolve(migrationsDir, `${entry.tag}.sql`);
    if (!existsSync(sqlPath)) {
      throw new Error(`Migration file not found: ${sqlPath}`);
    }

    const sqlText = readFileSync(sqlPath, "utf8");
    const hash = createHash("sha256").update(sqlText).digest("hex");

    if (appliedHashes.has(hash)) {
      console.log(`↷ Skipped ${entry.tag} (already applied)`);
      skippedCount += 1;
      continue;
    }

    const statements = splitStatements(sqlText);

    try {
      for (const statement of statements) {
        try {
          await db.execute(statement);
        }
        catch (error) {
          if (isIgnorableMigrationError(error)) {
            console.warn(`↷ Ignored idempotent statement error in ${entry.tag}: ${formatError(error)}`);
            continue;
          }

          throw error;
        }
      }

      await db.execute({
        sql: `INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)` ,
        args: [hash, Date.now()] as any,
      });

      appliedHashes.add(hash);
      appliedCount += 1;
      console.log(`✓ Applied ${entry.tag}`);
    }
    catch (error) {
      throw new Error(`Failed on migration ${entry.tag}: ${formatError(error)}`);
    }
  }

  console.log("✅ Cloud schema migration finished.");
  console.log(`Applied: ${appliedCount}`);
  console.log(`Skipped: ${skippedCount}`);
}

main().catch((error) => {
  console.error("❌ Cloud schema migration failed:");
  console.error(formatError(error));
  process.exit(1);
});