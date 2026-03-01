import { and, eq, ne } from "drizzle-orm";

import db from "../../lib/db";
import { tournament } from "../../lib/db/schema";

export function slugifyTournamentName(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "tournament";
}

async function slugExists(slug: string, excludeTournamentId?: number) {
  const where = excludeTournamentId != null
    ? and(eq(tournament.slug, slug), ne(tournament.id, excludeTournamentId))
    : eq(tournament.slug, slug);

  const rows = await db
    .select({ id: tournament.id })
    .from(tournament)
    .where(where)
    .limit(1);

  return rows.length > 0;
}

export async function buildUniqueTournamentSlug(
  input: string,
  excludeTournamentId?: number,
) {
  const base = slugifyTournamentName(input);

  let candidate = base;
  let suffix = 2;

  while (await slugExists(candidate, excludeTournamentId)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}
