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
    table: "tournaments",
    name: "website_url",
    ddl: "ALTER TABLE tournaments ADD COLUMN website_url TEXT",
  },
  {
    table: "tournaments",
    name: "payment_information",
    ddl: "ALTER TABLE tournaments ADD COLUMN payment_information TEXT",
  },
  {
    table: "tournaments",
    name: "facilities",
    ddl: "ALTER TABLE tournaments ADD COLUMN facilities TEXT",
  },
  {
    table: "tournaments",
    name: "registration_open_date",
    ddl: "ALTER TABLE tournaments ADD COLUMN registration_open_date INTEGER",
  },
  {
    table: "tournaments",
    name: "registration_close_date",
    ddl: "ALTER TABLE tournaments ADD COLUMN registration_close_date INTEGER",
  },
  {
    table: "tournaments",
    name: "is_sanctioned",
    ddl: "ALTER TABLE tournaments ADD COLUMN is_sanctioned INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "division_open",
    ddl: "ALTER TABLE tournaments ADD COLUMN division_open INTEGER NOT NULL DEFAULT true",
  },
  {
    table: "tournaments",
    name: "division_women",
    ddl: "ALTER TABLE tournaments ADD COLUMN division_women INTEGER NOT NULL DEFAULT true",
  },
  {
    table: "tournaments",
    name: "division_master",
    ddl: "ALTER TABLE tournaments ADD COLUMN division_master INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "division_grand_master",
    ddl: "ALTER TABLE tournaments ADD COLUMN division_grand_master INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "division_senior_grand_master",
    ddl: "ALTER TABLE tournaments ADD COLUMN division_senior_grand_master INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "division_legend",
    ddl: "ALTER TABLE tournaments ADD COLUMN division_legend INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "division_junior",
    ddl: "ALTER TABLE tournaments ADD COLUMN division_junior INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "keep_juniors_separate",
    ddl: "ALTER TABLE tournaments ADD COLUMN keep_juniors_separate INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "show_division_in_results",
    ddl: "ALTER TABLE tournaments ADD COLUMN show_division_in_results INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "has_golf",
    ddl: "ALTER TABLE tournaments ADD COLUMN has_golf INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "golf_rounds",
    ddl: "ALTER TABLE tournaments ADD COLUMN golf_rounds INTEGER",
  },
  {
    table: "tournaments",
    name: "golf_cumulative_rounds",
    ddl: "ALTER TABLE tournaments ADD COLUMN golf_cumulative_rounds INTEGER",
  },
  {
    table: "tournaments",
    name: "golf_pool_mode",
    ddl: "ALTER TABLE tournaments ADD COLUMN golf_pool_mode TEXT NOT NULL DEFAULT 'static'",
  },
  {
    table: "tournaments",
    name: "golf_pool_count",
    ddl: "ALTER TABLE tournaments ADD COLUMN golf_pool_count INTEGER NOT NULL DEFAULT 1",
  },
  {
    table: "tournaments",
    name: "golf_start_enabled",
    ddl: "ALTER TABLE tournaments ADD COLUMN golf_start_enabled INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "golf_round_pars",
    ddl: "ALTER TABLE tournaments ADD COLUMN golf_round_pars TEXT",
  },
  {
    table: "tournaments",
    name: "golf_round_layouts",
    ddl: "ALTER TABLE tournaments ADD COLUMN golf_round_layouts TEXT",
  },
  {
    table: "tournaments",
    name: "has_accuracy",
    ddl: "ALTER TABLE tournaments ADD COLUMN has_accuracy INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "accuracy_rounds",
    ddl: "ALTER TABLE tournaments ADD COLUMN accuracy_rounds INTEGER",
  },
  {
    table: "tournaments",
    name: "accuracy_cumulative_rounds",
    ddl: "ALTER TABLE tournaments ADD COLUMN accuracy_cumulative_rounds INTEGER",
  },
  {
    table: "tournaments",
    name: "has_distance",
    ddl: "ALTER TABLE tournaments ADD COLUMN has_distance INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "distance_rounds",
    ddl: "ALTER TABLE tournaments ADD COLUMN distance_rounds INTEGER",
  },
  {
    table: "tournaments",
    name: "distance_cumulative_rounds",
    ddl: "ALTER TABLE tournaments ADD COLUMN distance_cumulative_rounds INTEGER",
  },
  {
    table: "tournaments",
    name: "has_scf",
    ddl: "ALTER TABLE tournaments ADD COLUMN has_scf INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "scf_rounds",
    ddl: "ALTER TABLE tournaments ADD COLUMN scf_rounds INTEGER",
  },
  {
    table: "tournaments",
    name: "scf_cumulative_rounds",
    ddl: "ALTER TABLE tournaments ADD COLUMN scf_cumulative_rounds INTEGER",
  },
  {
    table: "tournaments",
    name: "has_discathon",
    ddl: "ALTER TABLE tournaments ADD COLUMN has_discathon INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "discathon_rounds",
    ddl: "ALTER TABLE tournaments ADD COLUMN discathon_rounds INTEGER",
  },
  {
    table: "tournaments",
    name: "discathon_cumulative_rounds",
    ddl: "ALTER TABLE tournaments ADD COLUMN discathon_cumulative_rounds INTEGER",
  },
  {
    table: "tournaments",
    name: "has_ddc",
    ddl: "ALTER TABLE tournaments ADD COLUMN has_ddc INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "ddc_rounds",
    ddl: "ALTER TABLE tournaments ADD COLUMN ddc_rounds INTEGER",
  },
  {
    table: "tournaments",
    name: "ddc_cumulative_rounds",
    ddl: "ALTER TABLE tournaments ADD COLUMN ddc_cumulative_rounds INTEGER",
  },
  {
    table: "tournaments",
    name: "has_freestyle",
    ddl: "ALTER TABLE tournaments ADD COLUMN has_freestyle INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "tournaments",
    name: "freestyle_rounds",
    ddl: "ALTER TABLE tournaments ADD COLUMN freestyle_rounds INTEGER",
  },
  {
    table: "tournaments",
    name: "freestyle_cumulative_rounds",
    ddl: "ALTER TABLE tournaments ADD COLUMN freestyle_cumulative_rounds INTEGER",
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
  {
    table: "user",
    name: "banned",
    ddl: "ALTER TABLE user ADD COLUMN banned INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "user",
    name: "banned_at",
    ddl: "ALTER TABLE user ADD COLUMN banned_at INTEGER",
  },
  {
    table: "user",
    name: "ban_reason",
    ddl: "ALTER TABLE user ADD COLUMN ban_reason TEXT",
  },
  {
    table: "user",
    name: "force_password_change",
    ddl: "ALTER TABLE user ADD COLUMN force_password_change INTEGER NOT NULL DEFAULT false",
  },
  {
    table: "invitation",
    name: "tournament_role",
    ddl: "ALTER TABLE invitation ADD COLUMN tournament_role TEXT",
  },
  {
    table: "invitation",
    name: "global_role_target",
    ddl: "ALTER TABLE invitation ADD COLUMN global_role_target TEXT",
  },
  {
    table: "player",
    name: "country",
    ddl: "ALTER TABLE player ADD COLUMN country TEXT",
  },
  {
    table: "player",
    name: "email",
    ddl: "ALTER TABLE player ADD COLUMN email TEXT",
  },
  {
    table: "session",
    name: "active_organization_id",
    ddl: "ALTER TABLE session ADD COLUMN active_organization_id TEXT",
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

  const legacyRoleCountResult = await db.execute("SELECT COUNT(*) AS count FROM user WHERE role IS NULL OR role NOT IN ('admin', 'user')");
  const legacyRoleCount = Number(legacyRoleCountResult.rows[0]?.count ?? 0);

  if (legacyRoleCount > 0) {
    await db.execute("UPDATE user SET role = 'user' WHERE role IS NULL OR role NOT IN ('admin', 'user')");
    console.log(`Normalized ${legacyRoleCount} legacy global role value(s) to 'user'`);
  }
  else {
    console.log("No legacy global role values found");
  }

  const playerInfo = await db.execute("PRAGMA table_info(player)");
  const userIdCol = playerInfo.rows.find(row => String(row.name) === "user_id");
  if (userIdCol && Number(userIdCol.notnull) === 1) {
    await db.execute("DROP INDEX IF EXISTS player_user_id_unique");
    await db.execute("DROP INDEX IF EXISTS player_pdga_number_idx");
    await db.execute("ALTER TABLE player ALTER COLUMN \"user_id\" TO \"user_id\" text REFERENCES user(id) ON DELETE set null");
    await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS player_user_id_unique ON player (user_id)");
    await db.execute("CREATE INDEX IF NOT EXISTS player_pdga_number_idx ON player (pdga_number)");
    console.log("Updated player.user_id to allow NULL for guest players");
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS venue_course_layout (
      id TEXT PRIMARY KEY NOT NULL,
      venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      par INTEGER NOT NULL,
      hole_count INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  const requiredIndexes = [
    "CREATE INDEX IF NOT EXISTS venue_course_layout_venue_id_idx ON venue_course_layout (venue_id)",
    "CREATE INDEX IF NOT EXISTS tournaments_organization_id_idx ON tournaments (organization_id)",
    "CREATE INDEX IF NOT EXISTS tournamentvenues_tournament_id_idx ON tournamentvenues (tournament_id)",
    "CREATE INDEX IF NOT EXISTS tournamentvenues_venue_id_idx ON tournamentvenues (venue_id)",
    "CREATE INDEX IF NOT EXISTS tournamentvenues_tournament_venue_idx ON tournamentvenues (tournament_id, venue_id)",
    "CREATE INDEX IF NOT EXISTS tournament_membership_user_id_idx ON tournament_membership (user_id)",
    "CREATE INDEX IF NOT EXISTS tournament_membership_tournament_id_idx ON tournament_membership (tournament_id)",
    "CREATE INDEX IF NOT EXISTS tournament_membership_organization_id_idx ON tournament_membership (organization_id)",
    "CREATE INDEX IF NOT EXISTS tournament_membership_user_tournament_idx ON tournament_membership (user_id, tournament_id)",
    "CREATE INDEX IF NOT EXISTS event_entry_tournament_status_idx ON event_entry (tournament_id, status)",
  ];

  for (const indexDdl of requiredIndexes) {
    await db.execute(indexDdl);
  }
  console.log("Verified required database indexes");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
