# Database Migrations & Schema Verification Rule (ATM)

Whenever updating Drizzle schema files in `lib/db/schema/*` or migrating data to Turso Cloud:

1. **Keep Migration Files & Schema Guards in Sync**:
   - Every table or column added or altered in `lib/db/schema/*` must have a corresponding SQL migration in `lib/db/migrations/` (including `lib/db/migrations/meta/_journal.json`) and, where applicable, be registered in `scripts/ensure-latest-schema-columns.ts`.
   - Update `docs/database-er-diagram.md` when entity relationships or core tables change.

2. **Automated Verification Step**:
   - Run `pnpm db:ensure-latest-schema` locally and `pnpm db:migrate:cloud` (`scripts/migrate-cloud-schema.ts`) when syncing schema changes to Turso Cloud.
   - Verify local vs remote table integrity when needed using `tsx scripts/check-local-vs-remote-counts.ts`.

3. **Verify API Endpoints & Authorization**:
   - Ensure all endpoints using relational queries or tournament-scoped mutations enforce proper permissions (as documented in `docs/tournament-authorization.md`) and handle database errors gracefully.
