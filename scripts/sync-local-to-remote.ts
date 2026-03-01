import "dotenv/config";
import { createClient } from "@libsql/client";

type TableSummary = {
  table: string;
  rowsCopied: number;
};

const DEFAULT_LOCAL_URL = "file:local.db";
const INTERNAL_TABLES = new Set(["sqlite_sequence"]);

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function getRequiredEnv(name: string) {
  // eslint-disable-next-line node/no-process-env
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function getTables(client: ReturnType<typeof createClient>) {
  const result = await client.execute(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);

  return result.rows
    .map(row => String(row.name))
    .filter(name => !INTERNAL_TABLES.has(name));
}

async function copyTable(
  table: string,
  local: ReturnType<typeof createClient>,
  remote: ReturnType<typeof createClient>,
) {
  const tableName = quoteIdentifier(table);
  const rowsResult = await local.execute(`SELECT * FROM ${tableName}`);
  const rows = rowsResult.rows as Array<Record<string, unknown>>;

  if (rows.length === 0) {
    return 0;
  }

  const columns = Object.keys(rows[0]);

  if (columns.length === 0) {
    return 0;
  }

  const columnSql = columns.map(quoteIdentifier).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  const insertSql = `INSERT INTO ${tableName} (${columnSql}) VALUES (${placeholders})`;

  for (const row of rows) {
    const args = columns.map(column => row[column] ?? null);
    await remote.execute(insertSql, args as any);
  }

  return rows.length;
}

async function main() {
  // eslint-disable-next-line node/no-process-env
  const localUrl = process.env.LOCAL_TURSO_DATABASE_URL || DEFAULT_LOCAL_URL;
  const remoteUrl = getRequiredEnv("REMOTE_TURSO_DATABASE_URL");

  // eslint-disable-next-line node/no-process-env
  const remoteAuthToken = process.env.REMOTE_TURSO_AUTH_TOKEN;

  const local = createClient({ url: localUrl });
  const remote = createClient({
    url: remoteUrl,
    authToken: remoteAuthToken,
  });

  const localTables = await getTables(local);
  const remoteTables = new Set(await getTables(remote));

  const tables = localTables.filter(table => remoteTables.has(table));
  const missingRemoteTables = localTables.filter(table => !remoteTables.has(table));

  if (tables.length === 0) {
    throw new Error("No shared tables found between local and remote databases.");
  }

  if (missingRemoteTables.length > 0) {
    console.warn("Skipping tables missing from remote schema:");
    for (const table of missingRemoteTables) {
      console.warn(`  - ${table}`);
    }
  }

  console.log(`Local DB:  ${localUrl}`);
  console.log(`Remote DB: ${remoteUrl}`);
  console.log(`Copying ${tables.length} table(s)...`);

  await remote.execute("PRAGMA foreign_keys = OFF");
  await remote.execute("BEGIN");

  try {
    for (const table of tables) {
      await remote.execute(`DELETE FROM ${quoteIdentifier(table)}`);
    }

    const summary: TableSummary[] = [];

    for (const table of tables) {
      const rowsCopied = await copyTable(table, local, remote);
      summary.push({ table, rowsCopied });
      console.log(`✓ ${table}: ${rowsCopied} row(s)`);
    }

    await remote.execute("COMMIT");

    const totalRows = summary.reduce((sum, item) => sum + item.rowsCopied, 0);
    console.log("\n✅ Sync complete");
    console.log(`Tables copied: ${summary.length}`);
    console.log(`Rows copied: ${totalRows}`);
  }
  catch (error) {
    await remote.execute("ROLLBACK");
    throw error;
  }
  finally {
    await remote.execute("PRAGMA foreign_keys = ON");
  }
}

main().catch((error) => {
  console.error("❌ Sync failed:", error);
  process.exit(1);
});