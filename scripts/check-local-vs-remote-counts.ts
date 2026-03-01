import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@libsql/client";
import { parse } from "dotenv";

function parseEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return {};
  }
  return parse(readFileSync(filePath, "utf8"));
}

function required(values: Record<string, string>, key: string) {
  const value = values[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required value for ${key}`);
  }
  return value;
}

function normalizeTursoToken(token: string) {
  const prefix = "TURSO_AUTH_TOKEN=";
  return token.startsWith(prefix) ? token.slice(prefix.length) : token;
}

async function getTables(client: ReturnType<typeof createClient>) {
  const result = await client.execute(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);

  return result.rows.map(row => String(row.name));
}

async function countRows(client: ReturnType<typeof createClient>, table: string) {
  const result = await client.execute(`SELECT COUNT(*) as count FROM "${table}"`);
  return Number(result.rows[0]?.count ?? 0);
}

async function main() {
  const base = parseEnvFile(".env") as Record<string, string>;
  const cloud = parseEnvFile(".env.cloud") as Record<string, string>;

  const localUrl = base.LOCAL_TURSO_DATABASE_URL || base.TURSO_DATABASE_URL || "file:local.db";
  const remoteUrl = required(cloud, "TURSO_DATABASE_URL");
  const remoteToken = normalizeTursoToken(required(cloud, "TURSO_AUTH_TOKEN"));

  const local = createClient({ url: localUrl });
  const remote = createClient({ url: remoteUrl, authToken: remoteToken });

  const localTables = new Set(await getTables(local));
  const remoteTables = new Set(await getTables(remote));

  const sharedTables = Array.from(localTables).filter(table => remoteTables.has(table)).sort();
  const onlyLocal = Array.from(localTables).filter(table => !remoteTables.has(table)).sort();
  const onlyRemote = Array.from(remoteTables).filter(table => !localTables.has(table)).sort();

  console.log(`Local DB:  ${localUrl}`);
  console.log(`Remote DB: ${remoteUrl}`);
  console.log(`Shared tables: ${sharedTables.length}`);

  if (onlyLocal.length > 0) {
    console.log("\nTables only in local:");
    onlyLocal.forEach(table => console.log(`  - ${table}`));
  }

  if (onlyRemote.length > 0) {
    console.log("\nTables only in remote:");
    onlyRemote.forEach(table => console.log(`  - ${table}`));
  }

  let diffCount = 0;

  console.log("\nRow counts (local -> remote):");
  for (const table of sharedTables) {
    const localCount = await countRows(local, table);
    const remoteCount = await countRows(remote, table);
    const differs = localCount !== remoteCount;

    if (differs) {
      diffCount += 1;
    }

    const marker = differs ? "DIFF" : "OK  ";
    console.log(`  ${marker} ${table}: ${localCount} -> ${remoteCount}`);
  }

  console.log(`\nSummary: ${diffCount} shared table(s) have different row counts.`);
}

main().catch((error) => {
  console.error("❌ Count check failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});