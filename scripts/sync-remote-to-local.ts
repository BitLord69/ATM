import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@libsql/client";
import { parse } from "dotenv";

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

function parseEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return {};
  }
  return parse(readFileSync(filePath, "utf8"));
}

function normalizeTursoToken(token: string) {
  const prefix = "TURSO_AUTH_TOKEN=";
  return token.startsWith(prefix) ? token.slice(prefix.length) : token;
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    const cause = (error as { cause?: { message?: string } }).cause;
    if (cause?.message) {
      return `${error.message} | cause: ${cause.message}`;
    }
    return error.message;
  }
  return String(error);
}

function isAlreadyExistsError(error: unknown) {
  const message = formatError(error).toLowerCase();
  return message.includes("already exists") || message.includes("duplicate");
}

function isIgnorableDropError(error: unknown) {
  const message = formatError(error).toLowerCase();
  return message.includes("no such table")
    || message.includes("no such index")
    || message.includes("no such trigger")
    || message.includes("no such view");
}

function getConfigFromEnvFiles() {
  const base = parseEnvFile(".env") as Record<string, string>;
  const cloud = parseEnvFile(".env.cloud") as Record<string, string>;

  return {
    localUrl: base.LOCAL_TURSO_DATABASE_URL || base.TURSO_DATABASE_URL || DEFAULT_LOCAL_URL,
    remoteUrl: cloud.REMOTE_TURSO_DATABASE_URL || cloud.TURSO_DATABASE_URL,
    remoteToken: normalizeTursoToken(cloud.REMOTE_TURSO_AUTH_TOKEN || cloud.TURSO_AUTH_TOKEN || ""),
  };
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

type SchemaObject = {
  type: string;
  name: string;
  sql: string;
};

async function getSchemaObjects(client: ReturnType<typeof createClient>) {
  const result = await client.execute(`
    SELECT type, name, sql
    FROM sqlite_master
    WHERE type IN ('table', 'index', 'view', 'trigger')
      AND name NOT LIKE 'sqlite_%'
      AND sql IS NOT NULL
    ORDER BY
      CASE type
        WHEN 'table' THEN 1
        WHEN 'view' THEN 2
        WHEN 'index' THEN 3
        WHEN 'trigger' THEN 4
        ELSE 5
      END,
      name
  `);

  return result.rows.map((row) => {
    const values = row as Record<string, unknown>;
    return {
      type: String(values.type),
      name: String(values.name),
      sql: String(values.sql),
    } satisfies SchemaObject;
  });
}

async function resetLocalSchema(local: ReturnType<typeof createClient>) {
  const localSchemaObjects = await getSchemaObjects(local);
  const dropOrder = {
    trigger: 1,
    index: 2,
    view: 3,
    table: 4,
  } as Record<string, number>;

  const orderedDrops = [...localSchemaObjects].sort((left, right) => {
    const leftOrder = dropOrder[left.type] ?? 99;
    const rightOrder = dropOrder[right.type] ?? 99;
    if (leftOrder === rightOrder) {
      return left.name.localeCompare(right.name);
    }
    return leftOrder - rightOrder;
  });

  await local.execute("PRAGMA foreign_keys = OFF");
  try {
    for (const object of orderedDrops) {
      const objectType = object.type.toUpperCase();
      const objectName = quoteIdentifier(object.name);
      try {
        await local.execute(`DROP ${objectType} IF EXISTS ${objectName}`);
      }
      catch (error) {
        if (isIgnorableDropError(error)) {
          continue;
        }
        throw error;
      }
    }
  }
  finally {
    await local.execute("PRAGMA foreign_keys = ON");
  }
}

async function ensureLocalSchemaFromRemote(
  remote: ReturnType<typeof createClient>,
  local: ReturnType<typeof createClient>,
) {
  await resetLocalSchema(local);

  const schemaObjects = await getSchemaObjects(remote);

  for (const object of schemaObjects) {
    try {
      await local.execute(object.sql);
    }
    catch (error) {
      if (isAlreadyExistsError(error)) {
        continue;
      }
      throw new Error(
        `Failed creating local ${object.type} ${object.name}: ${formatError(error)}`,
      );
    }
  }
}

async function getReferencedTables(
  client: ReturnType<typeof createClient>,
  table: string,
) {
  const result = await client.execute(`PRAGMA foreign_key_list(${quoteIdentifier(table)})`);
  const referenced = new Set<string>();

  for (const row of result.rows) {
    const parent = String((row as Record<string, unknown>).table || "").trim();
    if (parent) {
      referenced.add(parent);
    }
  }

  return referenced;
}

function resolveTableOrder(
  tables: string[],
  dependencies: Map<string, Set<string>>,
) {
  const tableSet = new Set(tables);
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, Set<string>>();

  for (const table of tables) {
    inDegree.set(table, 0);
    dependents.set(table, new Set());
  }

  for (const table of tables) {
    const deps = dependencies.get(table) || new Set<string>();
    for (const dep of deps) {
      if (!tableSet.has(dep)) {
        continue;
      }

      inDegree.set(table, (inDegree.get(table) || 0) + 1);
      dependents.get(dep)?.add(table);
    }
  }

  const queue: string[] = tables.filter(table => (inDegree.get(table) || 0) === 0);
  const ordered: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);

    for (const child of dependents.get(current) || []) {
      const next = (inDegree.get(child) || 0) - 1;
      inDegree.set(child, next);
      if (next === 0) {
        queue.push(child);
      }
    }
  }

  // Fallback: keep remaining tables in original order if there is a cycle.
  if (ordered.length < tables.length) {
    for (const table of tables) {
      if (!ordered.includes(table)) {
        ordered.push(table);
      }
    }
  }

  return ordered;
}

async function copyTable(
  table: string,
  remote: ReturnType<typeof createClient>,
  local: ReturnType<typeof createClient>,
) {
  const tableName = quoteIdentifier(table);
  const rowsResult = await remote.execute(`SELECT * FROM ${tableName}`);
  const rows = rowsResult.rows as Array<Record<string, unknown>>;

  if (rows.length === 0) {
    return 0;
  }

  const columns = Object.keys(rows[0]);

  if (columns.length === 0) {
    return 0;
  }

  const columnList = columns.map(col => quoteIdentifier(col)).join(",");
  const values = rows.map(row => {
    const rowValues = columns.map(col => {
      const value = row[col];
      if (value === null || value === undefined) {
        return "NULL";
      }
      if (typeof value === "string") {
        return `'${value.replace(/'/g, "''")}'`;
      }
      return String(value);
    });
    return `(${rowValues.join(",")})`;
  });

  const chunkSize = 100;
  const chunks: string[] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize).join(","));
  }

  let copied = 0;
  for (const chunk of chunks) {
    const query = `INSERT INTO ${tableName} (${columnList}) VALUES ${chunk}`;
    await local.execute(query);
    copied += chunk.split("),(").length;
  }

  return rows.length;
}

async function main() {
  try {
    const config = getConfigFromEnvFiles();

    if (!config.remoteUrl) {
      throw new Error(
        "Missing TURSO_DATABASE_URL in .env.cloud. Cannot restore from cloud.",
      );
    }

    if (!config.remoteToken) {
      throw new Error(
        "Missing TURSO_AUTH_TOKEN in .env.cloud. Cannot restore from cloud.",
      );
    }

    console.log("🔄 Syncing from cloud to local database...");
    console.log(`   Remote: ${config.remoteUrl}`);
    console.log(`   Local:  ${config.localUrl}\n`);

    const remote = createClient({ url: config.remoteUrl, authToken: config.remoteToken });
    const local = createClient({ url: config.localUrl });

    console.log("🏗️  Ensuring local schema matches cloud...");
    await ensureLocalSchemaFromRemote(remote, local);

    const tables = await getTables(remote);
    const dependencies = new Map<string, Set<string>>();

    for (const table of tables) {
      dependencies.set(table, await getReferencedTables(remote, table));
    }

    const orderedTables = resolveTableOrder(tables, dependencies);

    // Delete all data from local tables first (in reverse order to respect foreign keys)
    console.log("🗑️  Clearing local tables...");
    for (const table of [...orderedTables].reverse()) {
      try {
        await local.execute(`DELETE FROM ${quoteIdentifier(table)}`);
      }
      catch (error) {
        // Ignore errors if table doesn't exist locally
      }
    }

    console.log("📋 Copying data from cloud...\n");

    const summaries: TableSummary[] = [];

    for (const table of orderedTables) {
      const rowsCopied = await copyTable(table, remote, local);
      summaries.push({ table, rowsCopied });
      console.log(`   ✓ ${table}: ${rowsCopied} rows`);
    }

    console.log("\n✅ Sync complete!");
    console.log(
      `Total rows copied: ${summaries.reduce((sum, s) => sum + s.rowsCopied, 0)}`,
    );
  }
  catch (error) {
    console.error("❌ Sync failed:", error);
    process.exit(1);
  }
}

main();
