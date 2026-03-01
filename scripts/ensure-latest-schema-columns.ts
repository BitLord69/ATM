import { createClient } from "@libsql/client";
import "dotenv/config";

type ColumnSpec = {
  table: string;
  name: string;
  ddl: string;
};

const REQUIRED_COLUMNS: ColumnSpec[] = [
  {
    table: "user",
    name: "distance_unit",
    ddl: "ALTER TABLE user ADD COLUMN distance_unit TEXT NOT NULL DEFAULT 'km'",
  },
  {
    table: "tournaments",
    name: "closed_at",
    ddl: "ALTER TABLE tournaments ADD COLUMN closed_at INTEGER",
  },
  {
    table: "tournaments",
    name: "director_name",
    ddl: "ALTER TABLE tournaments ADD COLUMN director_name TEXT",
  },
  {
    table: "tournaments",
    name: "director_email",
    ddl: "ALTER TABLE tournaments ADD COLUMN director_email TEXT",
  },
  {
    table: "tournaments",
    name: "director_phone",
    ddl: "ALTER TABLE tournaments ADD COLUMN director_phone TEXT",
  },
  {
    table: "venues",
    name: "has_golf",
    ddl: "ALTER TABLE venues ADD COLUMN has_golf INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "venues",
    name: "has_accuracy",
    ddl: "ALTER TABLE venues ADD COLUMN has_accuracy INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "venues",
    name: "has_distance",
    ddl: "ALTER TABLE venues ADD COLUMN has_distance INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "venues",
    name: "has_scf",
    ddl: "ALTER TABLE venues ADD COLUMN has_scf INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "venues",
    name: "has_discathon",
    ddl: "ALTER TABLE venues ADD COLUMN has_discathon INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "venues",
    name: "has_ddc",
    ddl: "ALTER TABLE venues ADD COLUMN has_ddc INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "venues",
    name: "has_freestyle",
    ddl: "ALTER TABLE venues ADD COLUMN has_freestyle INTEGER NOT NULL DEFAULT false",
  },
];

async function tableColumns(db: ReturnType<typeof createClient>, table: string) {
  const result = await db.execute(`PRAGMA table_info(${table})`);
  return new Set(result.rows.map(row => String(row.name)));
}

async function main() {
  // eslint-disable-next-line node/no-process-env
  const url = process.env.TURSO_DATABASE_URL;

  if (!url) {
    throw new Error("Missing TURSO_DATABASE_URL");
  }

  const db = createClient({ url });

  const grouped = REQUIRED_COLUMNS.reduce<Record<string, ColumnSpec[]>>((acc, item) => {
    if (!acc[item.table]) {
      acc[item.table] = [];
    }
    acc[item.table].push(item);
    return acc;
  }, {});

  for (const [table, specs] of Object.entries(grouped)) {
    const existing = await tableColumns(db, table);

    for (const spec of specs) {
      if (existing.has(spec.name)) {
        console.log(`${table}.${spec.name} already exists`);
        continue;
      }

      await db.execute(spec.ddl);
      console.log(`Added ${table}.${spec.name}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
